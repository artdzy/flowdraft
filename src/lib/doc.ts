import { EDGE_DEFAULTS, HANDLE_IDS, NODE_DEFAULTS, NODE_KINDS } from '../flow/defaults';
import type { FlowDoc, FlowEdge, FlowEdgeData, FlowNode, NodeKind } from '../flow/types';

// Also imported by the MCP server (server/mcp.ts), so this module must stay free of browser-only code.

export const MAX_NODES = 600;
export const MAX_EDGES = 1200;
export const MAX_TEXT = 2000;

/** Allowed values for enum-like data fields, keyed by field name. */
export const ENUMS = {
  tone: ['default', 'accent', 'gate', 'muted'],
  kind: ['note', 'info', 'warning', 'danger', 'success'],
  variant: ['heading', 'label', 'body'],
  side: ['left', 'right'],
  line: ['solid', 'dashed', 'dotted'],
  color: ['light', 'accent', 'muted', 'blue', 'green', 'amber'],
  path: ['smooth', 'bezier', 'straight'],
  arrow: ['end', 'both', 'none'],
} as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;

/** Keeps only keys known in `defaults`, with matching primitive types and allowed enum values. */
function cleanData<T extends Record<string, unknown>>(defaults: T, raw: unknown): T {
  const out: Record<string, unknown> = { ...defaults };
  if (!isObj(raw)) return out as T;
  for (const key of Object.keys(defaults)) {
    const def = defaults[key];
    const val = raw[key];
    if (typeof def === 'string' && typeof val === 'string') {
      const allowed = (ENUMS as Record<string, readonly string[]>)[key];
      if (!allowed) out[key] = val.slice(0, MAX_TEXT);
      else if (allowed.includes(val)) out[key] = val;
    } else if (typeof def === 'boolean' && typeof val === 'boolean') {
      out[key] = val;
    }
  }
  return out as T;
}

export function serializeDoc(nodes: FlowNode[], edges: FlowEdge[]): FlowDoc {
  return {
    version: 1,
    nodes: nodes.map((n) => {
      const out: Record<string, unknown> = {
        id: n.id,
        type: n.type,
        position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        data: n.data,
      };
      if (n.width) out.width = Math.round(n.width);
      if (n.height) out.height = Math.round(n.height);
      return out as FlowNode;
    }),
    edges: edges.map(
      (e) =>
        ({
          id: e.id,
          type: 'flow',
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
          data: e.data,
        }) as FlowEdge,
    ),
  };
}

/** Validates untrusted JSON (cloud rows, imports, drafts) into a safe document. Edge markers are added by loadDoc. */
export function parseDoc(raw: unknown): FlowDoc | null {
  if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) return null;
  const ids = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const r of raw.nodes.slice(0, MAX_NODES)) {
    if (!isObj(r) || typeof r.id !== 'string' || ids.has(r.id)) continue;
    const kind = r.type as NodeKind;
    if (!NODE_KINDS.includes(kind) || !isObj(r.position)) continue;
    const x = num(r.position.x, -1e6, 1e6);
    const y = num(r.position.y, -1e6, 1e6);
    if (x === undefined || y === undefined) continue;
    const node = {
      id: r.id.slice(0, 64),
      type: kind,
      position: { x, y },
      data: cleanData(NODE_DEFAULTS[kind] as Record<string, unknown>, r.data),
      width: num(r.width, 20, 8000),
      height: num(r.height, 20, 8000),
      zIndex: kind === 'lane' ? -1 : undefined,
    } as FlowNode;
    ids.add(node.id);
    nodes.push(node);
  }
  const handles = HANDLE_IDS as readonly string[];
  const edges: FlowEdge[] = [];
  const edgeIds = new Set<string>();
  for (const r of raw.edges.slice(0, MAX_EDGES)) {
    if (!isObj(r) || typeof r.id !== 'string' || edgeIds.has(r.id)) continue;
    if (typeof r.source !== 'string' || typeof r.target !== 'string') continue;
    if (!ids.has(r.source) || !ids.has(r.target)) continue;
    const sh = typeof r.sourceHandle === 'string' && handles.includes(r.sourceHandle) ? r.sourceHandle : null;
    const th = typeof r.targetHandle === 'string' && handles.includes(r.targetHandle) ? r.targetHandle : null;
    edgeIds.add(r.id);
    edges.push({
      id: r.id.slice(0, 64),
      type: 'flow',
      source: r.source,
      target: r.target,
      sourceHandle: sh,
      targetHandle: th,
      data: cleanData(EDGE_DEFAULTS as Record<string, unknown>, r.data) as FlowEdgeData,
    });
  }
  return { version: 1, nodes, edges };
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}
