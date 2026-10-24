import type { NodeChange, XYPosition } from '@xyflow/react';
import { useUi, type Guides } from '../store/ui';
import type { FlowNode } from './types';

type Rect = { x: number; y: number; w: number; h: number };
type Move = Extract<NodeChange<FlowNode>, { type: 'position' }> & { position: XYPosition };

/** Snapping distance on screen; the canvas keeps the zoom here so it feels the same at any zoom level. */
const SNAP_PX = 8;
let zoom = 1;
export function setCanvasZoom(z: number) {
  zoom = z;
}

export function rectOf(n: FlowNode): Rect {
  return { x: n.position.x, y: n.position.y, w: n.measured?.width ?? n.width ?? 0, h: n.measured?.height ?? n.height ?? 0 };
}

function centreInside(r: Rect, box: Rect): boolean {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return cx >= box.x && cx <= box.x + box.w && cy >= box.y && cy <= box.y + box.h;
}

/** What each moving lane carries, decided when the move starts so a lane doesn't pick up nodes it passes over. */
let cargo: Map<string, string[]> | null = null;
/** True between the first and the last position change of a pointer drag. */
let dragActive = false;

function cargoOf(lane: FlowNode, nodes: FlowNode[]): string[] {
  const box = rectOf(lane);
  return nodes.filter((n) => n.type !== 'lane' && !n.selected && centreInside(rectOf(n), box)).map((n) => n.id);
}

type Snap = { d: number; at: number };
const lines = (r: Rect, axis: 'x' | 'y') => (axis === 'x' ? [r.x, r.x + r.w / 2, r.x + r.w] : [r.y, r.y + r.h / 2, r.y + r.h]);

/** The nearest edge or centre line of the other boxes that the moving box can snap to on one axis. */
function closest(moving: Rect, others: Rect[], axis: 'x' | 'y', limit: number): Snap | null {
  let best: Snap | null = null;
  const mine = lines(moving, axis);
  for (const other of others) {
    for (const at of lines(other, axis)) {
      for (const m of mine) {
        const d = at - m;
        if (Math.abs(d) <= limit && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at };
      }
    }
  }
  return best;
}

let shown: Guides | null = null;
function showGuides(next: Guides | null) {
  if (!!next === !!shown && next?.x === shown?.x && next?.y === shown?.y) return;
  shown = next;
  useUi.setState({ guides: next });
}

/**
 * Shapes position changes before they are applied:
 * - a moving lane takes the nodes inside it along;
 * - while dragging, the moved node snaps to the edges and centres of nearby nodes, and guide lines show where.
 */
export function shapeMoves(changes: NodeChange<FlowNode>[], nodes: FlowNode[]): NodeChange<FlowNode>[] {
  const moves = changes.filter((c): c is Move => c.type === 'position' && !!c.position);
  if (!moves.length) return changes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const resizing = new Set(changes.filter((c) => c.type === 'dimensions').map((c) => c.id));
  const moving = new Set(moves.map((c) => c.id));
  const dragging = moves.some((c) => c.dragging);

  // A drag ends with one more position change from React Flow, computed from the pointer rather than from where the
  // last move (and its snapping) left the nodes; everything stays where it is, and carried nodes settle too.
  if (!dragging && dragActive) {
    dragActive = false;
    showGuides(null);
    const carriedIds = [...(cargo?.values() ?? [])].flat();
    cargo = null;
    const settled: NodeChange<FlowNode>[] = changes.map((c) =>
      c.type === 'position' && c.position && byId.has(c.id) ? { ...c, position: byId.get(c.id)!.position } : c,
    );
    for (const id of carriedIds) {
      if (!moving.has(id) && byId.has(id)) settled.push({ id, type: 'position', position: byId.get(id)!.position, dragging: false });
    }
    return settled;
  }
  if (dragging) dragActive = true;

  // Lanes carry what sits inside them (a resize from the top or left edge is not a move).
  const carried = new Map<string, XYPosition>();
  for (const c of moves) {
    const lane = byId.get(c.id);
    if (!lane || lane.type !== 'lane' || resizing.has(c.id)) continue;
    cargo ??= new Map();
    let ids = cargo.get(c.id);
    if (!ids) {
      ids = cargoOf(lane, nodes);
      cargo.set(c.id, ids);
    }
    const delta = { x: c.position.x - lane.position.x, y: c.position.y - lane.position.y };
    for (const id of ids) if (!moving.has(id) && !carried.has(id)) carried.set(id, delta);
  }

  // The dragged node (the first of a group) snaps to its neighbours of the same kind: lanes to lanes, boxes to boxes.
  let dx = 0;
  let dy = 0;
  let guides: Guides | null = null;
  const lead = moves[0];
  const leadNode = byId.get(lead.id);
  if (dragging && leadNode && !resizing.has(lead.id)) {
    const isLane = leadNode.type === 'lane';
    const box = { ...rectOf(leadNode), x: lead.position.x, y: lead.position.y };
    const others = nodes
      .filter((n) => !moving.has(n.id) && !carried.has(n.id) && (n.type === 'lane') === isLane)
      .map(rectOf)
      .filter((r) => r.w && r.h);
    const limit = SNAP_PX / zoom;
    const sx = closest(box, others, 'x', limit);
    const sy = closest(box, others, 'y', limit);
    if (sx || sy) {
      guides = {};
      if (sx) {
        dx = sx.d;
        guides.x = sx.at;
      }
      if (sy) {
        dy = sy.d;
        guides.y = sy.at;
      }
    }
  }
  showGuides(dragging ? guides : null);
  if (!dragging) cargo = null;

  const shifted =
    dx || dy
      ? changes.map((c) => (c.type === 'position' && c.position ? { ...c, position: { x: c.position.x + dx, y: c.position.y + dy } } : c))
      : changes;
  if (!carried.size) return shifted;
  const extra: NodeChange<FlowNode>[] = [];
  for (const [id, delta] of carried) {
    const n = byId.get(id)!;
    extra.push({ id, type: 'position', position: { x: n.position.x + delta.x + dx, y: n.position.y + delta.y + dy }, dragging });
  }
  return [...shifted, ...extra];
}
