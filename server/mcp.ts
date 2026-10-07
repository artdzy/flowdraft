import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import express, { type NextFunction, type Request, type Response } from 'express';
import * as z from 'zod';
import { HANDLE_IDS, NODE_DEFAULTS, NODE_SIZE } from '../src/flow/defaults';
import { ICON_OPTIONS } from '../src/flow/icons';
import type { FlowEdge, FlowNode, NodeKind, SimpleTone } from '../src/flow/types';
import { ENUMS, MAX_EDGES, MAX_NODES, MAX_TEXT, parseDoc, serializeDoc, uid } from '../src/lib/doc';
import { renderDiagramPng } from './render';
import { VIEW_HTML, VIEW_MIME, VIEW_URI } from './view';

/**
 * Remote MCP server: lets ChatGPT, Claude and other MCP clients read and write the signed-in user's diagrams.
 * Supabase Auth is the OAuth 2.1 authorization server; this module is only the protected resource.
 * Every query runs with the user's own access token, so the existing RLS policies decide what is reachable.
 */

export type McpConfig = { supabaseUrl: string; supabaseAnonKey: string };

// server.js draws the example diagrams of the guide pages (seo/guides.js) with the same code and checks them
// against the same node fields, enums and icon names.
export { ENUMS, ICON_OPTIONS, NODE_DEFAULTS, NODE_SIZE, parseDoc, renderDiagramPng };
export { renderDiagramSvg } from './render';

type Handle = (typeof HANDLE_IDS)[number];

const MCP_PATH = '/mcp';
const VERIFIED_TTL = 60_000;
const METADATA_PATH = '/.well-known/oauth-protected-resource';

// ---------- Input schemas ----------

const text = (description: string) => z.string().max(MAX_TEXT).optional().describe(description);
const tone = z.enum(ENUMS.tone).optional().describe('Color: default, accent (red highlight), gate (human approval), muted.');
const simpleTone = z
  .enum(['default', 'accent', 'muted'] as const satisfies readonly SimpleTone[])
  .optional()
  .describe('Color: default, accent (red highlight) or muted.');
const icon = z.string().max(40).optional().describe('Icon name from the list in the tool description.');

// Described once in DIAGRAM_FORMAT instead of per field: the node union repeats these for every type.
const nodeBase = {
  id: z.string().min(1).max(64),
  position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().min(20).max(8000).optional(),
  height: z.number().min(20).max(8000).optional(),
};

const nodeSchema = z.discriminatedUnion('type', [
  z
    .object({
      ...nodeBase,
      type: z.literal('card'),
      data: z
        .object({
          tag: text('Small uppercase label above the title, e.g. "API", "BOT", "STEP".'),
          title: text('Short title, 1–4 words.'),
          subtitle: text('One short line under the title.'),
          icon,
          tone,
          highlight: z.boolean().optional().describe('Marker highlight on the title for the key step.'),
        })
        .optional(),
    })
    .describe('Process step / actor / system box. The main building block. Default size 200 wide, ~80 tall.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('lane'),
      data: z
        .object({
          label: text('Uppercase lane name shown at the top-left, e.g. "CLIENT".'),
          icon,
          dashed: z.boolean().optional().describe('Dashed border, e.g. for an automated zone.'),
          tone: simpleTone,
        })
        .optional(),
    })
    .describe('Swimlane: a wide background band drawn behind other nodes. Default 1100×130; set width/height to fit.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('note'),
      data: z
        .object({
          kind: z.enum(ENUMS.kind).optional().describe('note, info, warning, danger or success.'),
          title: text('Short title.'),
          text: text('One or two sentences.'),
        })
        .optional(),
    })
    .describe('Callout for explanations, warnings or outcomes. Default 240 wide.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('decision'),
      data: z.object({ title: text('The question, e.g. "Paid?".'), tone: simpleTone }).optional(),
    })
    .describe('Diamond for a yes/no branch. Default 150×110. Label the outgoing edges.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('terminal'),
      data: z.object({ title: text('e.g. "Start", "Done".'), tone: simpleTone }).optional(),
    })
    .describe('Pill for the start or end of a flow. About 130×40.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('text'),
      data: z
        .object({
          text: text('The text.'),
          variant: z.enum(ENUMS.variant).optional().describe('heading (large), label (small uppercase) or body.'),
          tone: simpleTone,
        })
        .optional(),
    })
    .describe('Free text without a box: diagram headings and section labels.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('chip'),
      data: z.object({ text: text('One or two words.'), icon, tone: simpleTone }).optional(),
    })
    .describe('Small rounded tag with an icon. About 110×32.'),
  z
    .object({
      ...nodeBase,
      type: z.literal('bubble'),
      data: z
        .object({
          speaker: text('Uppercase speaker name, e.g. "CUSTOMER".'),
          text: text('The message.'),
          side: z.enum(ENUMS.side).optional().describe('left or right; put the two parties on different sides.'),
          tone: simpleTone,
        })
        .optional(),
    })
    .describe('Chat message bubble for conversation flows. Default 260 wide.'),
]);

const handle = z.enum(HANDLE_IDS).optional();

const edgeSchema = z.object({
  id: z.string().min(1).max(64).optional().describe('Generated when omitted.'),
  source: z.string().describe('Source node id.'),
  target: z.string().describe('Target node id.'),
  sourceHandle: handle.describe('Side the line leaves from: t, r, b or l. Picked from positions when omitted.'),
  targetHandle: handle.describe('Side the line enters: t, r, b or l. Picked from positions when omitted.'),
  data: z
    .object({
      label: z.string().max(MAX_TEXT).optional().describe('Short text on the line, e.g. "yes".'),
      line: z.enum(ENUMS.line).optional().describe('solid, dashed (optional/async) or dotted.'),
      color: z.enum(ENUMS.color).optional().describe('light (default), accent, muted, blue, green or amber.'),
      path: z.enum(ENUMS.path).optional().describe('smooth (right angles, default), bezier or straight.'),
      arrow: z.enum(ENUMS.arrow).optional().describe('end (default), both or none.'),
      animated: z.boolean().optional().describe('Moving dashes.'),
    })
    .optional(),
});

const title = z.string().trim().min(1).max(120);
const diagramId = z.string().uuid().describe('Diagram id from list_diagrams.');
const nodes = z.array(nodeSchema).max(MAX_NODES);
const edges = z.array(edgeSchema).max(MAX_EDGES);

type NodeInput = z.infer<typeof nodeSchema>;
type EdgeInput = z.infer<typeof edgeSchema>;

const DIAGRAM_FORMAT =
  'Node position is the top-left corner in pixels (y grows downward); width/height are optional, each type has a sensible default. ' +
  'Node ids must be unique; edges refer to them. ' +
  `Icons: ${ICON_OPTIONS.map((o) => o.name).join(', ')}.`;

const INSTRUCTIONS = `flowdraft (flowdraft.tech) is a flowchart editor. These tools read and write the signed-in user's saved diagrams.

Workflow
- To change a diagram: get_diagram, edit its JSON, then update_diagram with the complete nodes and edges arrays.
- After creating or updating, give the user the returned url; it opens the diagram in flowdraft.
- Write every visible text in the user's language. Keep titles to 1–4 words; put detail in subtitles and notes.

Layout (pixels, y grows downward, position = top-left corner)
- Nodes must not overlap. Good spacing: columns 220–240 px apart, rows 130–150 px apart.
- Left-to-right flows: connect "r" → "l". Top-down flows: "b" → "t".
- Swimlanes: lane nodes at x = 0, y = i × 130, height 130, wide enough for every column (e.g. 1300). Place nodes from x = 160 on, centred in their lane (cards at laneY + 25). Lanes sit behind other nodes automatically.
- Optional title block above the diagram: a text node variant "label" tone "accent" at y ≈ -90 and a text node variant "heading" at y ≈ -60.
- Label decision branches ("yes" / "no"); use color green for the happy path and amber or accent for the other, dashed for optional or async links.
- Use tone "gate" on cards where a human must approve, tone "accent" plus highlight for the single most important step.

Pictures and the chat loop
- create_diagram, update_diagram, get_diagram and get_open_diagram return a PNG of the diagram; hosts that support it show it to the user in the chat. The user may never open flowdraft: they judge the picture and tell you what to change.
- Look at the picture after every change. If boxes overlap, text is cut off, lines cross needlessly or the layout is cramped, fix it with update_diagram before you answer.
- Keep your reply short: say what you changed and invite corrections. Then apply the user's feedback with get_diagram + update_diagram on the same id; do not create a new diagram for a revision.
- When the user talks about "my flow", "this diagram" or what they have open in flowdraft, call get_open_diagram. If the open canvas has no id or has unsaved edits, ask them to save it before you change it.`;

// ---------- Diagram helpers ----------

/** Rough rendered size, used only to choose connection sides. */
function boxOf(n: NodeInput) {
  const size = NODE_SIZE[n.type] ?? {};
  const w = n.width ?? size.width ?? (n.type === 'terminal' ? 130 : 120);
  const h = n.height ?? size.height ?? (n.type === 'card' || n.type === 'note' || n.type === 'bubble' ? 80 : 40);
  return { cx: n.position.x + w / 2, cy: n.position.y + h / 2 };
}

function facingHandles(from: NodeInput, to: NodeInput): [Handle, Handle] {
  const a = boxOf(from);
  const b = boxOf(to);
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
  return dy >= 0 ? ['b', 't'] : ['t', 'b'];
}

/** Turns tool input into a stored document, filling defaults and reporting anything that had to be dropped. */
function buildDoc(nodeInput: NodeInput[], edgeInput: EdgeInput[]) {
  const warnings: string[] = [];
  const byId = new Map<string, NodeInput>();
  for (const n of nodeInput) {
    if (byId.has(n.id)) warnings.push(`Duplicate node id "${n.id}": only the first one was kept.`);
    else byId.set(n.id, n);
  }

  const rawNodes = [...byId.values()].map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...NODE_DEFAULTS[n.type as NodeKind], ...n.data },
    ...NODE_SIZE[n.type],
    ...(n.width !== undefined && { width: n.width }),
    ...(n.height !== undefined && { height: n.height }),
  }));

  const edgeIds = new Set<string>();
  const rawEdges = [];
  for (const e of edgeInput) {
    const from = byId.get(e.source);
    const to = byId.get(e.target);
    if (!from || !to) {
      warnings.push(`Edge ${e.source} → ${e.target} was dropped: node "${from ? e.target : e.source}" does not exist.`);
      continue;
    }
    let id = e.id ?? uid('e');
    if (edgeIds.has(id)) id = uid('e');
    edgeIds.add(id);
    const [sh, th] = facingHandles(from, to);
    rawEdges.push({
      id,
      type: 'flow',
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? sh,
      targetHandle: e.targetHandle ?? th,
      data: e.data,
    });
  }

  const doc = parseDoc({ nodes: rawNodes, edges: rawEdges })!;
  return { content: serializeDoc(doc.nodes, doc.edges), warnings };
}

/** Normalises a stored row through the same validation the editor uses. */
function readContent(content: unknown): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const doc = parseDoc(content) ?? { version: 1, nodes: [], edges: [] };
  const { nodes: n, edges: e } = serializeDoc(doc.nodes, doc.edges);
  return { nodes: n, edges: e };
}

// ---------- Tool results ----------

function ok(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/**
 * Adds a PNG of the diagram, drawn here on the server, so the chat can show it without flowdraft being open.
 * Watermarked: a clean file comes from flowdraft's own export, which needs an account.
 */
function withPicture(result: CallToolResult, doc: { nodes: FlowNode[]; edges: FlowEdge[] }): CallToolResult {
  try {
    const picture = renderDiagramPng(doc, { watermark: true });
    if (picture) result.content.push({ type: 'image', mimeType: 'image/png', data: picture.png.toString('base64') });
  } catch (err) {
    console.error('diagram render failed', err);
  }
  return result;
}

/** Tool metadata that has MCP Apps hosts (Claude, ChatGPT, …) show the returned picture in the chat (server/view.ts). */
const SHOWS_PICTURE = { ui: { resourceUri: VIEW_URI }, 'ui/resourceUri': VIEW_URI };

function dbMessage(error: { message?: string; code?: string }): string {
  const msg = error.message ?? '';
  if (msg.includes('projects_content_size')) return 'The diagram is too large (max 512 KB). Use fewer or shorter nodes.';
  if (msg.includes('projects_no_images')) return 'Diagrams cannot contain images.';
  if (msg.includes('project quota')) return 'The user has reached the limit of 200 diagrams. Ask them to delete old ones first.';
  if (msg.includes('live_canvas_content_size')) return 'The open canvas is too large (max 512 KB).';
  if (error.code === 'PGRST205' || error.code === '42P01')
    return 'This flowdraft server is missing a database update (supabase/migrations). Tell the user the feature is not available yet.';
  if (msg.includes('JWT') || error.code === 'PGRST301') return 'The session has expired. Reconnect flowdraft and try again.';
  return `Database error: ${msg || 'unknown'}`;
}

const NOT_FOUND = 'No diagram with this id belongs to the user. Call list_diagrams to see the available ids.';
const NOTHING_OPEN =
  'flowdraft has not reported an open canvas for this user yet. Ask them to open flowdraft.tech (or the app), signed in with ' +
  'the account they connected, and try again; or use list_diagrams and get_diagram to read a saved diagram.';
const STALE_AFTER = 10 * 60_000;

type LiveRow = { project_id: string | null; title: string; content: unknown; dirty: boolean; updated_at: string };

function minutesAgo(iso: string) {
  return Math.round((Date.now() - Date.parse(iso)) / 60_000);
}

// ---------- MCP server (one per request; the transport is stateless) ----------

function buildServer(db: SupabaseClient, origin: string) {
  const openUrl = (id: string) => `${origin}/?p=${id}`;

  const server = new McpServer(
    {
      name: 'flowdraft',
      title: 'flowdraft',
      version: '1.0.0',
      websiteUrl: origin,
      icons: [{ src: `${origin}/icon-192.png`, mimeType: 'image/png', sizes: ['192x192'] }],
    },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    'list_diagrams',
    {
      title: 'Akışları listele',
      description: "List the user's saved flowdraft diagrams, newest first.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { data, error } = await db
        .from('projects')
        .select('id,title,updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) return fail(dbMessage(error));
      return ok({ diagrams: data.map((p) => ({ ...p, url: openUrl(p.id) })) });
    },
  );

  server.registerTool(
    'get_diagram',
    {
      title: 'Akışı oku',
      description:
        'Get a diagram with all of its nodes and edges, in the same format update_diagram accepts, plus a PNG of it.',
      inputSchema: { id: diagramId },
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: SHOWS_PICTURE,
    },
    async ({ id }) => {
      const { data, error } = await db.from('projects').select('id,title,content,updated_at').eq('id', id).maybeSingle();
      if (error) return fail(dbMessage(error));
      if (!data) return fail(NOT_FOUND);
      const doc = readContent(data.content);
      return withPicture(ok({ id: data.id, title: data.title, updated_at: data.updated_at, url: openUrl(data.id), ...doc }), doc);
    },
  );

  server.registerTool(
    'create_diagram',
    {
      title: 'Akış oluştur',
      description:
        "Create a new diagram in the user's flowdraft account. Returns a link that opens it and a PNG of the result: " +
        `check the picture and fix any layout problems with update_diagram. ${DIAGRAM_FORMAT}`,
      inputSchema: { title, nodes, edges },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      _meta: SHOWS_PICTURE,
    },
    async (input) => {
      const { content, warnings } = buildDoc(input.nodes, input.edges);
      const { data, error } = await db.from('projects').insert({ title: input.title, content }).select('id').single();
      if (error) return fail(dbMessage(error));
      return withPicture(
        ok({ id: data.id, title: input.title, url: openUrl(data.id), nodes: content.nodes.length, edges: content.edges.length, warnings }),
        content,
      );
    },
  );

  server.registerTool(
    'update_diagram',
    {
      title: 'Akışı güncelle',
      description:
        'Replace the content and/or title of an existing diagram. nodes and edges are complete replacements, not patches: ' +
        'call get_diagram first and send back every node and edge that should remain. Omitted arrays are kept as they are. ' +
        `Returns a PNG of the result; if the user has the diagram open in flowdraft, it reloads there too. ${DIAGRAM_FORMAT}`,
      inputSchema: { id: diagramId, title: title.optional(), nodes: nodes.optional(), edges: edges.optional() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      _meta: SHOWS_PICTURE,
    },
    async (input) => {
      const patch: { title?: string; content?: unknown } = {};
      let summary: { nodes?: number; edges?: number; warnings: string[] } = { warnings: [] };
      if (input.title) patch.title = input.title;
      if (input.nodes || input.edges) {
        let current: { nodes: NodeInput[]; edges: EdgeInput[] } | null = null;
        if (!input.nodes || !input.edges) {
          const { data, error } = await db.from('projects').select('content').eq('id', input.id).maybeSingle();
          if (error) return fail(dbMessage(error));
          if (!data) return fail(NOT_FOUND);
          current = readContent(data.content) as unknown as { nodes: NodeInput[]; edges: EdgeInput[] };
        }
        const { content, warnings } = buildDoc(input.nodes ?? current!.nodes, input.edges ?? current!.edges);
        patch.content = content;
        summary = { nodes: content.nodes.length, edges: content.edges.length, warnings };
      }
      if (!patch.title && !patch.content) return fail('Nothing to update: pass a title, nodes or edges.');
      const { data, error } = await db.from('projects').update(patch).eq('id', input.id).select('id,title,content');
      if (error) return fail(dbMessage(error));
      if (!data.length) return fail(NOT_FOUND);
      return withPicture(ok({ id: input.id, title: data[0].title, url: openUrl(input.id), ...summary }), readContent(data[0].content));
    },
  );

  server.registerTool(
    'delete_diagram',
    {
      title: 'Akışı sil',
      description: 'Permanently delete a diagram. This cannot be undone; only do it when the user clearly asked for it.',
      inputSchema: { id: diagramId },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      const { data, error } = await db.from('projects').delete().eq('id', id).select('id,title');
      if (error) return fail(dbMessage(error));
      if (!data.length) return fail(NOT_FOUND);
      return ok({ deleted: data[0] });
    },
  );

  server.registerTool(
    'get_open_diagram',
    {
      title: 'Açık akışı oku',
      description:
        'Get the diagram the user has open in flowdraft right now, unsaved edits included, plus a PNG of it. ' +
        'Use it when the user refers to "my flow", "this diagram" or what they have open. ' +
        'Nodes and edges come in the same format update_diagram accepts.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: SHOWS_PICTURE,
    },
    async () => {
      const { data, error } = await db.from('live_canvas').select('project_id,title,content,dirty,updated_at').maybeSingle<LiveRow>();
      if (error) return fail(dbMessage(error));
      if (!data) return fail(NOTHING_OPEN);
      const notes: string[] = [];
      if (!data.project_id) {
        notes.push('This canvas is not saved to the account yet, so update_diagram cannot change it. Ask the user to save it first.');
      } else if (data.dirty) {
        notes.push('The canvas has unsaved edits; update_diagram would replace them. Ask the user to save before you change it.');
      }
      const idle = minutesAgo(data.updated_at);
      if (idle * 60_000 > STALE_AFTER) {
        notes.push(`flowdraft last reported this canvas ${idle} minutes ago; it may be closed or showing something else now.`);
      }
      const doc = readContent(data.content);
      return withPicture(
        ok({
          id: data.project_id,
          title: data.title,
          saved: !!data.project_id && !data.dirty,
          url: data.project_id ? openUrl(data.project_id) : null,
          reported_at: data.updated_at,
          notes,
          ...doc,
        }),
        doc,
      );
    },
  );

  server.registerResource(
    'diagram-view',
    VIEW_URI,
    { title: 'flowdraft diagram', description: 'Shows the picture of a flowdraft diagram in the chat.', mimeType: VIEW_MIME },
    async () => ({ contents: [{ uri: VIEW_URI, mimeType: VIEW_MIME, text: VIEW_HTML, _meta: { ui: { prefersBorder: false } } }] }),
  );

  return server;
}

// ---------- HTTP ----------

function originOf(req: Request) {
  return `${req.protocol}://${req.get('host')}`;
}

function allowCors(_req: Request, res: Response, next: NextFunction) {
  // Bearer tokens only (no cookies), so any origin may call; browser-based MCP clients need this.
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
    'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version',
    'Access-Control-Max-Age': '86400',
  });
  next();
}

export function createMcpRouter({ supabaseUrl, supabaseAnonKey }: McpConfig) {
  const router = express.Router();
  const configured = !!(supabaseUrl && supabaseAnonKey);
  const issuer = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
  // Verifies access tokens (JWKS for asymmetric keys, otherwise a call to Supabase Auth).
  // A client sends several requests per tool call, so a verified token is trusted for a short while.
  const verified = new Map<string, number>();
  const verifier = configured
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }).auth
    : null;

  const metadata = (req: Request, res: Response) => {
    if (!configured) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }
    const origin = originOf(req);
    res.set('Cache-Control', 'public, max-age=3600').json({
      resource: `${origin}${MCP_PATH}`,
      authorization_servers: [issuer],
      scopes_supported: ['email'],
      bearer_methods_supported: ['header'],
      resource_name: 'flowdraft',
      resource_documentation: `${origin}${MCP_PATH}`,
    });
  };
  router.options([METADATA_PATH, `${METADATA_PATH}${MCP_PATH}`, MCP_PATH], allowCors, (_req, res) => {
    res.sendStatus(204);
  });
  router.get([METADATA_PATH, `${METADATA_PATH}${MCP_PATH}`], allowCors, metadata);

  const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    if (!verifier) {
      res.status(503).json({ error: 'not_configured', error_description: 'Supabase is not configured on this server.' });
      return;
    }
    const challenge = (description?: string) => {
      const params = [`resource_metadata="${originOf(req)}${METADATA_PATH}${MCP_PATH}"`];
      if (description) params.push('error="invalid_token"', `error_description="${description}"`);
      res
        .status(401)
        .set('WWW-Authenticate', `Bearer ${params.join(', ')}`)
        .json({ error: description ? 'invalid_token' : 'unauthorized', error_description: description ?? 'Sign in to flowdraft.' });
    };
    const match = /^Bearer\s+(\S+)$/i.exec(req.get('authorization') ?? '');
    if (!match) {
      challenge();
      return;
    }
    const token = match[1];
    const now = Date.now();
    if (!((verified.get(token) ?? 0) > now)) {
      try {
        const { data, error } = await verifier.getClaims(token);
        if (error || !data?.claims.sub || data.claims.role !== 'authenticated' || data.claims.is_anonymous) {
          challenge('The access token is invalid or expired.');
          return;
        }
        if (verified.size >= 1000) verified.clear();
        verified.set(token, Math.min(now + VERIFIED_TTL, data.claims.exp * 1000));
      } catch {
        challenge('The access token could not be verified.');
        return;
      }
    }
    res.locals.token = token;
    next();
  };

  // A person or a search crawler opening the address gets the setup guide (a page of the SPA). MCP clients
  // always ask for an event stream or JSON on GET; crawlers often send "*/*" or no Accept at all. Media types are
  // case-insensitive (RFC 9110).
  router.get(MCP_PATH, (req, _res, next) => {
    const accept = req.get('accept') ?? '';
    const client = !!req.get('authorization') || /text\/event-stream|application\/json/i.test(accept);
    next(client ? undefined : 'router');
  });

  router.post(MCP_PATH, allowCors, authenticate, express.json({ limit: '2mb' }), async (req, res) => {
    const token = res.locals.token as string;
    const db = createClient(supabaseUrl, supabaseAnonKey, { accessToken: async () => token });
    const server = buildServer(db, originOf(req));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('mcp request failed', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  // Stateless server: there is no session to resume or stream to open.
  router.all(MCP_PATH, allowCors, authenticate, (_req, res) => {
    res
      .status(405)
      .set('Allow', 'POST')
      .json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  });

  return router;
}
