import { t } from '../i18n';
import { EDGE_DEFAULTS, NODE_DEFAULTS, NODE_SIZE } from './defaults';
import type { FlowDoc, FlowEdge, FlowEdgeData, FlowNode, NodeDataMap, NodeKind } from './types';

/**
 * A flow as described by a language model (the on-device model in the iOS app): only what happens, who does it
 * and where it goes next. sketchToDoc repairs what small models get wrong and does the whole layout.
 */
export type SketchStepKind = 'start' | 'step' | 'approval' | 'decision' | 'end';
export type SketchStep = { id: string; kind: SketchStepKind; title: string; detail?: string; lane?: string };
export type SketchLink = { from: string; to: string; label?: string };
export type FlowSketch = { title?: string; lanes?: string[]; steps: SketchStep[]; links: SketchLink[] };

type H = 't' | 'r' | 'b' | 'l';
type Step = { id: string; kind: SketchStepKind; title: string; detail: string; lane: string };
type Link = { from: string; to: string; label: string };

const COL = 270; // column pitch: room for a decision's answer between two cards
const ROW = 150; // lane / row pitch
const LANE_X = 160; // first column inside swimlanes

const KINDS: SketchStepKind[] = ['start', 'step', 'approval', 'decision', 'end'];
const clean = (s: unknown, max = 60) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Fixes ids, lanes and links so every step is reachable, every path ends and decisions branch. */
export function repairSketch(input: FlowSketch): { lanes: string[]; steps: Step[]; links: Link[] } {
  const lanes: string[] = [];
  for (const raw of input.lanes ?? []) {
    const lane = clean(raw, 40);
    if (lane && !lanes.some((l) => l.toLocaleLowerCase() === lane.toLocaleLowerCase())) lanes.push(lane);
  }
  const laneOf = (raw: unknown) => lanes.find((l) => l.toLocaleLowerCase() === clean(raw, 40).toLocaleLowerCase()) ?? '';

  const steps: Step[] = [];
  const idMap = new Map<string, string>();
  for (const [i, raw] of (input.steps ?? []).entries()) {
    const kind = KINDS.includes(raw.kind) ? raw.kind : 'step';
    const title = clean(raw.title) || (kind === 'end' ? t('Bitti', 'Done') : kind === 'start' ? t('Başla', 'Start') : '');
    if (!title) continue;
    let id = clean(raw.id, 20) || `s${i + 1}`;
    if (steps.some((s) => s.id === id)) id = `${id}_${i}`;
    if (!idMap.has(clean(raw.id, 20))) idMap.set(clean(raw.id, 20), id);
    steps.push({ id, kind, title, detail: clean(raw.detail), lane: laneOf(raw.lane) });
  }

  const byId = new Map(steps.map((s) => [s.id, s]));
  const links: Link[] = [];
  for (const raw of input.links ?? []) {
    const from = idMap.get(clean(raw.from, 20));
    const to = idMap.get(clean(raw.to, 20));
    if (!from || !to || from === to || byId.get(from)?.kind === 'end') continue;
    if (links.some((l) => l.from === from && l.to === to)) continue;
    links.push({ from, to, label: clean(raw.label, 18) });
  }
  const outs = (id: string) => links.filter((l) => l.from === id);
  const ins = (id: string) => links.filter((l) => l.to === id);

  if (steps.length && !steps.some((s) => s.kind === 'start')) steps[0].kind = 'start';
  // A decision with a single answer is just a step.
  for (const s of steps) if (s.kind === 'decision' && outs(s.id).length < 2) s.kind = 'step';

  // Unreachable steps continue from the step listed before them.
  for (const [i, s] of steps.entries()) {
    if (s.kind === 'start' || ins(s.id).length) continue;
    const prev = steps.slice(0, i).reverse().find((p) => p.kind !== 'end');
    if (prev) links.push({ from: prev.id, to: s.id, label: '' });
  }
  // Every path ends: dead ends go to the next end step in the list, or to a new one.
  for (const [i, s] of steps.entries()) {
    if (s.kind === 'end' || outs(s.id).length) continue;
    let end = steps.slice(i + 1).find((e) => e.kind === 'end') ?? steps.find((e) => e.kind === 'end');
    if (!end) {
      end = { id: 'end', kind: 'end', title: t('Bitti', 'Done'), detail: '', lane: '' };
      steps.push(end);
    }
    links.push({ from: s.id, to: end.id, label: '' });
  }

  // Steps without a lane take the lane of a neighbour (start/end usually come without one).
  if (lanes.length) {
    for (let pass = 0; pass < 3; pass++) {
      for (const s of steps) {
        if (s.lane) continue;
        const near = [...ins(s.id).map((l) => byId.get(l.from)), ...outs(s.id).map((l) => byId.get(l.to))];
        s.lane = near.find((n) => n?.lane)?.lane ?? (pass === 2 ? lanes[0] : '');
      }
    }
  }
  // Lanes nobody works in would be empty rows.
  const used = lanes.filter((l) => steps.some((s) => s.lane === l));
  return { lanes: used, steps, links };
}

/** Longest-path column per step, ignoring links that loop back. */
function columns(steps: Step[], links: Link[]) {
  const order = new Map(steps.map((s, i) => [s.id, i]));
  const back = new Set<Link>();
  const state = new Map<string, 1 | 2>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const l of links.filter((l) => l.from === id)) {
      const st = state.get(l.to);
      if (st === 1) back.add(l);
      else if (!st) visit(l.to);
    }
    state.set(id, 2);
  };
  for (const s of steps) if (!state.has(s.id)) visit(s.id);

  const col = new Map(steps.map((s) => [s.id, 0]));
  const forward = links.filter((l) => !back.has(l));
  for (let i = 0; i < steps.length; i++) {
    let changed = false;
    for (const l of forward) {
      const c = col.get(l.from)! + 1;
      if (c > col.get(l.to)!) {
        col.set(l.to, c);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { col, back, order };
}

function node<K extends NodeKind>(kind: K, id: string, x: number, y: number, data: Partial<NodeDataMap[K]>, size = {}): FlowNode {
  return {
    id,
    type: kind,
    position: { x, y },
    data: { ...NODE_DEFAULTS[kind], ...data },
    ...NODE_SIZE[kind],
    ...size,
    zIndex: kind === 'lane' ? -1 : undefined,
  } as FlowNode;
}

const YES = /^(yes|y|ok|true|evet|var|olumlu|onay|approved?|uygun|doğru|başarılı|success)/i;
const NO = /^(no|n|false|hayır|hayir|yok|red|reject|olumsuz|uygun değil|yanlış|hata|fail)/i;

export function sketchToDoc(input: FlowSketch): FlowDoc {
  const { lanes, steps, links } = repairSketch(input);
  const { col, back } = columns(steps, links);
  const swim = lanes.length >= 2;

  // Grid slot per step: swimlanes are rows and columns grow to the right; without lanes the flow runs top-down.
  const slots = new Map<string, number>(); // how many steps already sit in a cell
  const place = new Map<string, { x: number; y: number }>();
  const laneRows = new Map(lanes.map((l) => [l, 1]));
  for (const s of steps) {
    const c = col.get(s.id)!;
    const key = swim ? `${s.lane}|${c}` : `${c}`;
    const k = slots.get(key) ?? 0;
    slots.set(key, k + 1);
    if (swim) laneRows.set(s.lane, Math.max(laneRows.get(s.lane)!, k + 1));
    place.set(s.id, { x: c, y: k });
  }

  const laneTop = new Map<string, number>();
  let y = 0;
  for (const l of lanes) {
    laneTop.set(l, y);
    y += laneRows.get(l)! * ROW;
  }
  const maxCol = Math.max(0, ...col.values());

  const size = (s: Step) =>
    s.kind === 'decision' ? { w: 150, h: 110 } : s.kind === 'start' || s.kind === 'end' ? { w: 140, h: 40 } : { w: 190, h: 80 };
  const centre = new Map<string, { cx: number; cy: number }>();
  const nodes: FlowNode[] = [];

  if (input.title) nodes.push(node('text', 'headline', 0, -60, { text: clean(input.title, 80), variant: 'heading' }));
  if (swim) {
    for (const l of lanes) {
      nodes.push(node('lane', `lane_${lanes.indexOf(l)}`, 0, laneTop.get(l)!, { label: l.toLocaleUpperCase(), icon: 'Rows3' }, {
        width: LANE_X + maxCol * COL + 230,
        height: laneRows.get(l)! * ROW,
      }));
    }
  }

  // Top-down: centre each row of siblings under the widest row.
  const rowWidth = new Map<number, number>();
  if (!swim) for (const [, p] of place) rowWidth.set(p.x, Math.max(rowWidth.get(p.x) ?? 0, p.y + 1));
  const widest = Math.max(1, ...rowWidth.values());

  for (const s of steps) {
    const p = place.get(s.id)!;
    const { w, h } = size(s);
    let cx: number, cy: number;
    if (swim) {
      cx = LANE_X + p.x * COL + 95;
      cy = laneTop.get(s.lane)! + p.y * ROW + ROW / 2;
    } else {
      const n = rowWidth.get(p.x)!;
      cx = (p.y - (n - 1) / 2) * COL + ((widest - 1) / 2) * COL + 95;
      cy = p.x * ROW + 55;
    }
    centre.set(s.id, { cx, cy });
    const x = Math.round(cx - w / 2);
    const top = Math.round(cy - h / 2);
    if (s.kind === 'start' || s.kind === 'end') {
      nodes.push(node('terminal', s.id, x, top, { title: s.title, tone: s.kind === 'end' ? 'muted' : 'default' }));
    } else if (s.kind === 'decision') {
      nodes.push(node('decision', s.id, x, top, { title: s.title }));
    } else {
      nodes.push(node('card', s.id, x, top, {
        tag: (s.lane || (s.kind === 'approval' ? t('ONAY', 'APPROVAL') : t('ADIM', 'STEP'))).toLocaleUpperCase().slice(0, 18),
        title: s.title,
        subtitle: s.detail,
        icon: s.kind === 'approval' ? 'CircleCheck' : 'Zap',
        tone: s.kind === 'approval' ? 'gate' : 'default',
      }, { width: 190 }));
    }
  }

  const edges: FlowEdge[] = links.map((l, i) => {
    const a = centre.get(l.from)!;
    const b = centre.get(l.to)!;
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const horizontal = swim ? Math.abs(dx) >= Math.abs(dy) * 0.6 : Math.abs(dx) > Math.abs(dy) * 1.5;
    const [sh, th]: [H, H] = horizontal ? (dx >= 0 ? ['r', 'l'] : ['l', 'r']) : dy >= 0 ? ['b', 't'] : ['t', 'b'];
    const data: Partial<FlowEdgeData> = { label: l.label };
    if (YES.test(l.label)) data.color = 'green';
    else if (NO.test(l.label)) Object.assign(data, { color: 'amber', line: 'dashed' });
    if (back.has(l)) Object.assign(data, { line: 'dashed', color: data.color ?? 'muted' });
    return {
      id: `e${i}_${l.from}_${l.to}`,
      type: 'flow',
      source: l.from,
      sourceHandle: sh,
      target: l.to,
      targetHandle: th,
      data: { ...EDGE_DEFAULTS, ...data },
    };
  });

  // A decision's answers leave from different sides, so their labels don't end up on one line.
  for (const s of steps) {
    if (s.kind !== 'decision') continue;
    const from = centre.get(s.id)!;
    const dist = (e: FlowEdge) => Math.abs(centre.get(e.target)!.cy - from.cy);
    const used = new Set<string>();
    for (const e of edges.filter((e) => e.source === s.id).sort((a, b) => dist(a) - dist(b))) {
      const side = e.sourceHandle ?? 'r';
      if (!used.has(side)) {
        used.add(side);
        continue;
      }
      const { cx, cy } = centre.get(e.target)!;
      const ahead = cx >= from.cx ? 'r' : 'l';
      const options = cy >= from.cy ? [ahead, 'b'] : [ahead, 't'];
      const free = options.find((h) => !used.has(h));
      if (!free) continue;
      used.add(free);
      e.sourceHandle = free;
    }
  }

  return { version: 1, nodes, edges };
}
