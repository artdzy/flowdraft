// Also imported by the MCP server (server/mcp.ts), so this module must stay free of browser-only code.

export const SEVERITIES = ['problem', 'warning', 'suggestion', 'praise'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const MAX_REVIEW_ITEMS = 30;
export const MAX_REVIEW_TEXT = 600;
export const MAX_REVIEW_SUMMARY = 2000;

/** One finding of an AI review, optionally pinned to a node or an edge of the diagram. */
export type ReviewItem = {
  severity: Severity;
  title: string;
  text: string;
  node_id?: string;
  edge_id?: string;
};

export type Review = {
  id: string;
  project_id: string | null;
  summary: string;
  items: ReviewItem[];
  created_at: string;
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Validates untrusted review rows (the database, Realtime payloads) into safe items. */
export function parseReviewItems(raw: unknown): ReviewItem[] {
  if (!Array.isArray(raw)) return [];
  const out: ReviewItem[] = [];
  for (const r of raw.slice(0, MAX_REVIEW_ITEMS)) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const severity = SEVERITIES.includes(o.severity as Severity) ? (o.severity as Severity) : 'suggestion';
    const item: ReviewItem = { severity, title: str(o.title, 120), text: str(o.text, MAX_REVIEW_TEXT) };
    if (!item.title && !item.text) continue;
    if (typeof o.node_id === 'string' && o.node_id) item.node_id = o.node_id.slice(0, 64);
    if (typeof o.edge_id === 'string' && o.edge_id) item.edge_id = o.edge_id.slice(0, 64);
    out.push(item);
  }
  return out;
}

export function parseReview(raw: unknown): Review | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return {
    id: o.id,
    project_id: typeof o.project_id === 'string' ? o.project_id : null,
    summary: str(o.summary, MAX_REVIEW_SUMMARY),
    items: parseReviewItems(o.items),
    created_at: typeof o.created_at === 'string' ? o.created_at : new Date().toISOString(),
  };
}
