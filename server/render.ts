import { Resvg } from '@resvg/resvg-js';
import { getBezierPath, getSmoothStepPath, getStraightPath, Position } from '@xyflow/system';
import { CircleAlert, CircleCheck, Info, OctagonAlert, StickyNote, TriangleAlert, type LucideIcon } from 'lucide-react';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EDGE_DEFAULTS, NODE_SIZE } from '../src/flow/defaults';
import { getIcon } from '../src/flow/icons';
import type { EdgeColor, FlowEdge, FlowEdgeData, FlowNode, NoteKind, SimpleTone, Tone } from '../src/flow/types';

/**
 * Draws a diagram as a PNG on the server, so AI tools can show the result in the chat without flowdraft being open.
 * Mirrors the editor's node styles (src/styles.css, light theme) as SVG, then rasterises it with resvg.
 * Everything runs in-process with free, open-source parts: resvg, opentype.js and the Geist fonts (OFL, server/fonts).
 */

// ---------- Fonts ----------

type FontKey = 'sans' | 'bold' | 'mono';

const FONT_DIR = fileURLToPath(new URL('../server/fonts/', import.meta.url));
const FONT_FILES: Record<FontKey, string> = {
  sans: 'Geist-Regular.ttf',
  bold: 'Geist-SemiBold.ttf',
  mono: 'GeistMono-Regular.ttf',
};
const FAMILY: Record<FontKey, string> = { sans: 'Geist', bold: 'Geist', mono: 'Geist Mono' };
const WEIGHT: Record<FontKey, number> = { sans: 400, bold: 600, mono: 400 };

let fonts: Record<FontKey, opentype.Font> | null = null;

function loadFonts() {
  fonts ??= {
    sans: opentype.loadSync(FONT_DIR + FONT_FILES.sans),
    bold: opentype.loadSync(FONT_DIR + FONT_FILES.bold),
    mono: opentype.loadSync(FONT_DIR + FONT_FILES.mono),
  };
  return fonts;
}

// ---------- Palette (light theme: readable on both light and dark chat backgrounds) ----------

const C = {
  bg: '#f5f5f3',
  panel: '#ffffff',
  panel3: '#efefed',
  line: '#e4e4e0',
  line2: '#d3d3ce',
  text: '#161616',
  text2: '#52524e',
  text3: '#7a7a75',
  accent: '#e5484d',
  accentText: '#b4232c',
  blue: '#2f6fe4',
  green: '#14925b',
  amber: '#c27803',
  noteYellow: '#b08a1e',
  edgeInk: '#3d3d3a',
  edgeMuted: '#9a9a94',
  nodeBg: '#ffffff',
  nodeBg2: '#fafaf9',
};

const EDGE_COLOR: Record<EdgeColor, string> = {
  light: C.edgeInk,
  accent: C.accent,
  muted: C.edgeMuted,
  blue: C.blue,
  green: C.green,
  amber: C.amber,
};

const NOTE_COLOR: Record<NoteKind, string> = {
  note: C.noteYellow,
  info: C.blue,
  warning: C.amber,
  danger: C.accent,
  success: C.green,
};

const NOTE_ICON: Record<NoteKind, LucideIcon> = {
  note: StickyNote,
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
};

/** CSS color-mix(in srgb, a p%, b) for two #rrggbb colors. */
function mix(a: string, p: number, b: string) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Text ----------

const BODY_LH = 1.4;

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

function measure(text: string, font: FontKey, size: number, spacing = 0) {
  return loadFonts()[font].getAdvanceWidth(text, size, { kerning: true }) + spacing * [...text].length;
}

/** Greedy word wrap like the browser's; `pre` keeps the user's line breaks (white-space: pre-wrap). */
function wrap(text: string, font: FontKey, size: number, max: number, spacing = 0, pre = true): string[] {
  const paragraphs = pre ? text.split('\n') : [text.replace(/\s*\n\s*/g, ' ')];
  const lines: string[] = [];
  for (const para of paragraphs) {
    let line = '';
    for (const word of para.split(/(?<=\s)/)) {
      const next = line + word;
      if (!line || measure(next.trimEnd(), font, size, spacing) <= max) {
        line = next;
        continue;
      }
      lines.push(line.trimEnd());
      line = word;
      // A single word wider than the box breaks between characters.
      while (measure(line.trimEnd(), font, size, spacing) > max && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut), font, size, spacing) > max) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

/** Baseline of text of `size` centred in a line box starting at `top` (Geist: ascender 1.005, descender 0.295). */
function baseline(top: number, lineHeight: number, size: number) {
  return top + (lineHeight - 1.3 * size) / 2 + 1.005 * size;
}

type TextOpts = {
  font: FontKey;
  size: number;
  fill: string;
  lineHeight: number;
  spacing?: number;
  anchor?: 'start' | 'middle' | 'end';
};

function textLines(lines: string[], x: number, top: number, o: TextOpts) {
  const attrs =
    `font-family="${FAMILY[o.font]}" font-weight="${WEIGHT[o.font]}" font-size="${o.size}" fill="${o.fill}"` +
    (o.spacing ? ` letter-spacing="${o.spacing}"` : '') +
    (o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : '');
  return lines
    .map((line, i) =>
      line ? `<text x="${x}" y="${baseline(top + i * o.lineHeight, o.lineHeight, o.size).toFixed(2)}" ${attrs} xml:space="preserve">${esc(line)}</text>` : '',
    )
    .join('');
}

function icon(Icon: LucideIcon | null, x: number, y: number, size: number, color: string, strokeWidth = 1.75) {
  if (!Icon) return '';
  const markup = renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth, absoluteStrokeWidth: false }));
  return markup.replace('<svg ', `<svg x="${x}" y="${y}" `);
}

// ---------- Nodes ----------

type Box = { x: number; y: number; w: number; h: number };
type Laid = Box & { draw: () => string };

const upper = (s: string) => s.toUpperCase();

function rect(b: Box, fill: string, stroke: string, extra = '', rx = 8) {
  return `<rect x="${b.x + 0.5}" y="${b.y + 0.5}" width="${b.w - 1}" height="${b.h - 1}" rx="${rx}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
}

function layCard(n: Extract<FlowNode, { type: 'card' }>): Laid {
  const d = n.data;
  const w = n.width ?? NODE_SIZE.card?.width ?? 200;
  const inner = w - 26;
  const Icon = getIcon(d.icon);
  const tag = upper(d.tag ?? '');
  const topH = Math.max(tag ? 20 : 0, Icon ? 16 : 0);
  const titleLines = wrap(d.title || ' ', 'bold', 16.5, inner - (d.highlight ? 10 : 0), -0.165, false);
  const subLines = d.subtitle ? wrap(d.subtitle, 'mono', 12, inner, 0, false) : [];
  const titleLh = 16.5 * 1.3;
  const subLh = 12 * BODY_LH;
  const content = 11 + topH + 8 + titleLines.length * titleLh + (subLines.length ? 4 + subLines.length * subLh : 0) + 13;
  const h = n.height ?? Math.max(92, Math.ceil(content));
  const b = { x: n.position.x, y: n.position.y, w, h };
  const tone: Tone = d.tone ?? 'default';

  const draw = () => {
    let out = '';
    if (tone === 'accent') out += rect(b, 'url(#fd-accent-card)', C.accent);
    else if (tone === 'gate') out += `<rect x="${b.x + 0.75}" y="${b.y + 0.75}" width="${w - 1.5}" height="${h - 1.5}" rx="8" fill="${C.nodeBg2}" stroke="${C.text}" stroke-width="1.5"/>`;
    else if (tone === 'muted') out += rect(b, C.nodeBg2, C.line);
    else out += rect(b, C.nodeBg, C.line2);

    const top = b.y + 11;
    if (tag) {
      const tw = measure(tag, 'mono', 10.5, 1.05) + 14;
      const accent = tone === 'accent';
      out += `<rect x="${b.x + 13.5}" y="${top + 0.5}" width="${tw - 1}" height="19" rx="4" fill="${accent ? mix(C.accent, 0.2, C.nodeBg) : C.panel3}" stroke="${accent ? C.accent : C.line2}" ${accent ? 'stroke-opacity="0.5"' : ''}/>`;
      out += textLines([tag], b.x + 20, top, { font: 'mono', size: 10.5, fill: accent ? C.accentText : C.text2, lineHeight: 20, spacing: 1.05 });
    }
    if (Icon) {
      const color = tone === 'accent' || tone === 'gate' ? C.accent : C.text2;
      out += icon(Icon, b.x + w - 13 - 16, top + (topH - 16) / 2, 16, color);
    }
    let y = top + topH + 8;
    const cx = b.x + w / 2;
    if (d.highlight) {
      titleLines.forEach((line, i) => {
        const lw = measure(line, 'bold', 16.5, -0.165) + 10;
        out += `<rect x="${cx - lw / 2}" y="${y + i * titleLh + 1}" width="${lw}" height="${titleLh - 2}" rx="3" fill="${C.accent}" fill-opacity="0.32"/>`;
      });
    }
    out += textLines(titleLines, cx, y, {
      font: 'bold',
      size: 16.5,
      spacing: -0.165,
      fill: tone === 'muted' ? C.text2 : C.text,
      lineHeight: titleLh,
      anchor: 'middle',
    });
    y += titleLines.length * titleLh + 4;
    out += textLines(subLines, cx, y, { font: 'mono', size: 12, fill: C.text2, lineHeight: subLh, anchor: 'middle' });
    return out;
  };
  return { ...b, draw };
}

function layLane(n: Extract<FlowNode, { type: 'lane' }>): Laid {
  const d = n.data;
  const b = { x: n.position.x, y: n.position.y, w: n.width ?? 1100, h: n.height ?? 130 };
  const tone: SimpleTone = d.tone ?? 'default';
  const draw = () => {
    let out = '';
    if (d.dashed) {
      out += rect(b, 'none', C.line2, 'stroke-dasharray="4 3"');
    } else {
      const accent = tone === 'accent';
      const fill = accent ? `fill="${C.accent}" fill-opacity="0.045"` : tone === 'muted' ? 'fill="none"' : 'fill="#000" fill-opacity="0.018"';
      const stroke = accent ? `stroke="${C.accent}" stroke-opacity="0.3"` : `stroke="${C.line}"`;
      out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" ${fill}/>`;
      out += `<path d="M${b.x} ${b.y + 0.5}H${b.x + b.w}M${b.x} ${b.y + b.h - 0.5}H${b.x + b.w}" ${stroke}/>`;
    }
    const headW = Math.min(130, b.w);
    out += `<path d="M${b.x + headW - 0.5} ${b.y}V${b.y + b.h}" stroke="${C.line}"/>`;
    const Icon = getIcon(d.icon);
    const color = tone === 'accent' ? C.accentText : C.text2;
    const lines = wrap(upper(d.label ?? ''), 'mono', 11.5, headW - 16, 1.61, false);
    const lh = 11.5 * BODY_LH;
    const blockH = (Icon ? 16 + 8 : 0) + lines.length * lh;
    let y = b.y + (b.h - blockH) / 2;
    const cx = b.x + headW / 2;
    if (Icon) {
      out += icon(Icon, cx - 8, y, 16, color);
      y += 24;
    }
    out += textLines(lines, cx + 0.8, y, { font: 'mono', size: 11.5, spacing: 1.61, fill: color, lineHeight: lh, anchor: 'middle' });
    return out;
  };
  return { ...b, draw };
}

function layNote(n: Extract<FlowNode, { type: 'note' }>): Laid {
  const d = n.data;
  const kind: NoteKind = d.kind ?? 'note';
  const w = n.width ?? NODE_SIZE.note?.width ?? 240;
  const bodyW = w - 26 - 18 - 10;
  const titleLh = 13.5 * BODY_LH;
  const textLh = 13 * 1.45;
  const titleLines = d.title ? wrap(d.title, 'bold', 13.5, bodyW, 0, false) : [];
  const bodyLines = d.text ? wrap(d.text, 'sans', 13, bodyW) : [];
  const bodyH = titleLines.length * titleLh + (titleLines.length && bodyLines.length ? 3 : 0) + bodyLines.length * textLh;
  const h = n.height ?? Math.ceil(22 + Math.max(19, bodyH));
  const b = { x: n.position.x, y: n.position.y, w, h };
  const color = NOTE_COLOR[kind];
  const draw = () => {
    let out = `<rect x="${b.x + 0.5}" y="${b.y + 0.5}" width="${w - 1}" height="${h - 1}" rx="8" fill="${mix(color, 0.09, C.panel)}" stroke="${color}" stroke-opacity="0.45"/>`;
    out += icon(NOTE_ICON[kind] ?? CircleAlert, b.x + 13, b.y + 12, 18, color, 1.9);
    const x = b.x + 13 + 18 + 10;
    let y = b.y + 11;
    out += textLines(titleLines, x, y, { font: 'bold', size: 13.5, fill: C.text, lineHeight: titleLh });
    y += titleLines.length * titleLh + (titleLines.length ? 3 : 0);
    out += textLines(bodyLines, x, y, { font: 'sans', size: 13, fill: C.text2, lineHeight: textLh });
    return out;
  };
  return { ...b, draw };
}

function layDecision(n: Extract<FlowNode, { type: 'decision' }>): Laid {
  const d = n.data;
  const b = { x: n.position.x, y: n.position.y, w: n.width ?? 150, h: n.height ?? 110 };
  const tone: SimpleTone = d.tone ?? 'default';
  const draw = () => {
    const px = (p: number) => b.x + (b.w * p) / 100;
    const py = (p: number) => b.y + (b.h * p) / 100;
    const points = [
      [px(50), py(1.5)],
      [px(98.5), py(50)],
      [px(50), py(98.5)],
      [px(1.5), py(50)],
    ]
      .map((p) => p.join(','))
      .join(' ');
    const fill = tone === 'accent' ? mix(C.accent, 0.1, C.nodeBg) : tone === 'muted' ? C.panel : C.nodeBg;
    const stroke = tone === 'accent' ? C.accent : tone === 'muted' ? C.line : C.line2;
    let out = `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.25" stroke-linejoin="round"/>`;
    const lh = 13.5 * 1.25;
    const lines = wrap(d.title || ' ', 'bold', 13.5, b.w * 0.64, 0, false);
    out += textLines(lines, b.x + b.w / 2, b.y + (b.h - lines.length * lh) / 2, {
      font: 'bold',
      size: 13.5,
      fill: C.text,
      lineHeight: lh,
      anchor: 'middle',
    });
    return out;
  };
  return { ...b, draw };
}

function layTerminal(n: Extract<FlowNode, { type: 'terminal' }>): Laid {
  const d = n.data;
  const title = d.title ?? '';
  const b = {
    x: n.position.x,
    y: n.position.y,
    w: n.width ?? Math.max(120, Math.ceil(measure(title, 'bold', 14) + 42)),
    h: n.height ?? 44,
  };
  const tone: SimpleTone = d.tone ?? 'default';
  const draw = () => {
    const r = b.h / 2;
    let out =
      tone === 'accent'
        ? rect(b, C.accent, C.accent, '', r)
        : tone === 'muted'
          ? rect(b, C.panel, C.line2, 'stroke-dasharray="4 3"', r)
          : rect(b, C.panel3, C.line2, '', r);
    out += textLines([title], b.x + b.w / 2, b.y + (b.h - 14 * BODY_LH) / 2, {
      font: 'bold',
      size: 14,
      fill: tone === 'accent' ? '#fff' : tone === 'muted' ? C.text2 : C.text,
      lineHeight: 14 * BODY_LH,
      anchor: 'middle',
    });
    return out;
  };
  return { ...b, draw };
}

const TEXT_VARIANT = {
  heading: { font: 'bold' as FontKey, size: 30, spacing: -0.6, lineHeight: 36, fill: C.text, upper: false },
  label: { font: 'mono' as FontKey, size: 12, spacing: 1.92, lineHeight: 14.4, fill: C.text2, upper: true },
  body: { font: 'sans' as FontKey, size: 15, spacing: 0, lineHeight: 22.5, fill: C.text2, upper: false },
};

function layText(n: Extract<FlowNode, { type: 'text' }>): Laid {
  const d = n.data;
  const v = TEXT_VARIANT[d.variant] ?? TEXT_VARIANT.body;
  const text = v.upper ? upper(d.text ?? '') : (d.text ?? '');
  const lines = n.width ? wrap(text, v.font, v.size, n.width, v.spacing) : text.split('\n');
  const w = n.width ?? Math.ceil(Math.max(20, ...lines.map((l) => measure(l, v.font, v.size, v.spacing))));
  const b = { x: n.position.x, y: n.position.y, w, h: n.height ?? Math.ceil(lines.length * v.lineHeight) };
  const fill = d.tone === 'accent' ? C.accent : d.tone === 'muted' ? C.text3 : v.fill;
  return { ...b, draw: () => textLines(lines, b.x, b.y, { ...v, fill }) };
}

function layChip(n: Extract<FlowNode, { type: 'chip' }>): Laid {
  const d = n.data;
  const Icon = getIcon(d.icon);
  const text = d.text ?? '';
  const b = {
    x: n.position.x,
    y: n.position.y,
    w: n.width ?? Math.ceil(30 + (Icon ? 24 : 0) + measure(text, 'mono', 14)),
    h: n.height ?? 40,
  };
  const tone: SimpleTone = d.tone ?? 'default';
  const draw = () => {
    let out =
      tone === 'accent'
        ? rect(b, mix(C.accent, 0.12, C.nodeBg), C.accent)
        : rect(b, tone === 'muted' ? C.panel : C.nodeBg, C.line2);
    let x = b.x + 15;
    if (Icon) {
      out += icon(Icon, x, b.y + (b.h - 16) / 2, 16, tone === 'accent' ? C.accent : C.text2);
      x += 24;
    }
    out += textLines([text], x, b.y + (b.h - 14 * BODY_LH) / 2, {
      font: 'mono',
      size: 14,
      fill: tone === 'muted' ? C.text2 : C.text,
      lineHeight: 14 * BODY_LH,
    });
    return out;
  };
  return { ...b, draw };
}

function layBubble(n: Extract<FlowNode, { type: 'bubble' }>): Laid {
  const d = n.data;
  const w = n.width ?? NODE_SIZE.bubble?.width ?? 260;
  const inner = w - 30;
  const speaker = upper(d.speaker ?? '');
  const speakerLh = 10.5 * BODY_LH;
  const textLh = 14.5 * 1.45;
  const speakerLines = speaker ? wrap(speaker, 'mono', 10.5, inner, 1.47, false) : [];
  const lines = wrap(d.text || ' ', 'sans', 14.5, inner);
  const h = n.height ?? Math.ceil(24 + (speakerLines.length ? speakerLines.length * speakerLh + 4 : 0) + lines.length * textLh);
  const b = { x: n.position.x, y: n.position.y, w, h };
  const right = d.side === 'right';
  const tone: SimpleTone = d.tone ?? 'default';
  const draw = () => {
    // Rounded corners 14 everywhere except the one pointing at the speaker (4).
    const [tl, tr, br, bl] = right ? [14, 14, 4, 14] : [14, 14, 14, 4];
    const x0 = b.x + 0.5;
    const y0 = b.y + 0.5;
    const x1 = b.x + w - 0.5;
    const y1 = b.y + h - 0.5;
    const path =
      `M${x0 + tl} ${y0}H${x1 - tr}A${tr} ${tr} 0 0 1 ${x1} ${y0 + tr}V${y1 - br}A${br} ${br} 0 0 1 ${x1 - br} ${y1}` +
      `H${x0 + bl}A${bl} ${bl} 0 0 1 ${x0} ${y1 - bl}V${y0 + tl}A${tl} ${tl} 0 0 1 ${x0 + tl} ${y0}Z`;
    const fill = tone === 'accent' ? mix(C.accent, 0.16, C.nodeBg) : tone === 'muted' ? C.panel : C.nodeBg;
    const stroke =
      tone === 'accent' ? `stroke="${C.accent}" stroke-opacity="0.5"` : `stroke="${C.line2}"${tone === 'muted' ? ' stroke-dasharray="4 3"' : ''}`;
    let out = `<path d="${path}" fill="${fill}" ${stroke}/>`;
    const x = right ? b.x + w - 15 : b.x + 15;
    const anchor = right ? 'end' : 'start';
    let y = b.y + 11;
    out += textLines(speakerLines, x, y, {
      font: 'mono',
      size: 10.5,
      spacing: 1.47,
      fill: tone === 'accent' ? C.accentText : C.text3,
      lineHeight: speakerLh,
      anchor,
    });
    y += speakerLines.length ? speakerLines.length * speakerLh + 4 : 0;
    out += textLines(lines, x, y, { font: 'sans', size: 14.5, fill: C.text, lineHeight: textLh, anchor });
    return out;
  };
  return { ...b, draw };
}

function layNode(n: FlowNode): Laid {
  switch (n.type) {
    case 'card':
      return layCard(n);
    case 'lane':
      return layLane(n);
    case 'note':
      return layNote(n);
    case 'decision':
      return layDecision(n);
    case 'terminal':
      return layTerminal(n);
    case 'text':
      return layText(n);
    case 'chip':
      return layChip(n);
    case 'bubble':
      return layBubble(n);
  }
}

// ---------- Edges ----------

const SIDE: Record<string, Position> = { t: Position.Top, r: Position.Right, b: Position.Bottom, l: Position.Left };

function handlePoint(b: Box, side: string) {
  if (side === 't') return { x: b.x + b.w / 2, y: b.y };
  if (side === 'b') return { x: b.x + b.w / 2, y: b.y + b.h };
  if (side === 'l') return { x: b.x, y: b.y + b.h / 2 };
  return { x: b.x + b.w, y: b.y + b.h / 2 };
}

/** Sides facing each other, for edges stored without handles. */
function facing(a: Box, b: Box): [string, string] {
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
  return dy >= 0 ? ['b', 't'] : ['t', 'b'];
}

type LaidEdge = { line: string; label: (Box & { draw: () => string }) | null };

function markerId(color: EdgeColor, start: boolean) {
  return `fd-arrow-${color}${start ? '-start' : ''}`;
}

function layEdge(e: FlowEdge, boxes: Map<string, Box>): LaidEdge | null {
  const a = boxes.get(e.source);
  const b = boxes.get(e.target);
  if (!a || !b) return null;
  const d: FlowEdgeData = { ...EDGE_DEFAULTS, ...e.data };
  const [fs, ft] = facing(a, b);
  const sh = e.sourceHandle && SIDE[e.sourceHandle] ? e.sourceHandle : fs;
  const th = e.targetHandle && SIDE[e.targetHandle] ? e.targetHandle : ft;
  const s = handlePoint(a, sh);
  const t = handlePoint(b, th);
  const geo = { sourceX: s.x, sourceY: s.y, targetX: t.x, targetY: t.y, sourcePosition: SIDE[sh], targetPosition: SIDE[th] };
  const [path, lx, ly] =
    d.path === 'bezier'
      ? getBezierPath(geo)
      : d.path === 'straight'
        ? getStraightPath(geo)
        : getSmoothStepPath({ ...geo, borderRadius: 10, offset: 24 });
  const color = EDGE_COLOR[d.color] ?? C.edgeInk;
  const dotted = d.line === 'dotted';
  const dash = d.line === 'dashed' || (d.line === 'solid' && d.animated) ? '7 6' : dotted ? '0.1 6' : '';
  const markers =
    (d.arrow !== 'none' ? ` marker-end="url(#${markerId(d.color, false)})"` : '') +
    (d.arrow === 'both' ? ` marker-start="url(#${markerId(d.color, true)})"` : '');
  const line =
    `<path d="${path}" fill="none" stroke="${color}" stroke-width="${dotted ? 2.2 : 1.5}"` +
    (dash ? ` stroke-dasharray="${dash}"` : '') +
    (dotted ? ' stroke-linecap="round"' : '') +
    `${markers}/>`;

  let label: LaidEdge['label'] = null;
  if (d.label) {
    const tw = measure(d.label, 'mono', 11, 0.44);
    const w = tw + 16;
    const h = 11 * BODY_LH + 6;
    const box = { x: lx - w / 2, y: ly - h / 2, w, h };
    const tint: Partial<Record<EdgeColor, string>> = { accent: C.accent, green: C.green, amber: C.amber, blue: C.blue };
    const tc = tint[d.color];
    label = {
      ...box,
      draw: () =>
        `<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${w - 1}" height="${h - 1}" rx="5" fill="${C.bg}" stroke="${tc ?? C.line2}"${tc ? ' stroke-opacity="0.45"' : ''}/>` +
        textLines([d.label], lx, box.y + 3, {
          font: 'mono',
          size: 11,
          spacing: 0.44,
          fill: d.color === 'accent' ? C.accentText : (tc ?? C.text2),
          lineHeight: 11 * BODY_LH,
          anchor: 'middle',
        }),
    };
  }
  return { line, label };
}

function markerDefs() {
  return (Object.keys(EDGE_COLOR) as EdgeColor[])
    .map((c) => {
      const color = EDGE_COLOR[c];
      // Same shape and size as React Flow's ArrowClosed marker (14 × 14, scaled by the stroke width).
      const m = (id: string, points: string) =>
        `<marker id="${id}" viewBox="-10 -10 20 20" markerWidth="14" markerHeight="14" refX="0" refY="0" orient="auto">` +
        `<polyline points="${points}" fill="${color}" stroke="${color}" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></marker>`;
      return m(markerId(c, false), '-5,-4 0,0 -5,4 -5,-4') + m(markerId(c, true), '5,-4 0,0 5,4 5,-4');
    })
    .join('');
}

// ---------- Watermark ----------

const WATERMARK = 'flowdraft.tech';

/**
 * Pictures that leave flowdraft (the chat) carry the brand: a faint diagonal pattern over the whole image, so it can't
 * simply be cropped away, and a clearer mark in the bottom-right corner. Light enough to keep the diagram readable.
 */
function watermark(minX: number, minY: number, width: number, height: number) {
  const cx = minX + width / 2;
  const cy = minY + height / 2;
  // The rotated pattern must still cover the corners, so it is laid out over the diagonal in both directions.
  const reach = Math.hypot(width, height) / 2 + 200;
  const stepX = 300;
  const stepY = 140;
  const size = 20;
  let tiles = '';
  for (let row = 0, y = cy - reach; y <= cy + reach; y += stepY, row++) {
    for (let x = cx - reach + (row % 2) * (stepX / 2); x <= cx + reach; x += stepX) {
      tiles += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${WATERMARK}</text>`;
    }
  }
  const pattern =
    `<g transform="rotate(-24 ${cx} ${cy})" font-family="${FAMILY.bold}" font-weight="${WEIGHT.bold}" font-size="${size}" ` +
    `fill="${C.text}" fill-opacity="0.06" text-anchor="middle">${tiles}</g>`;
  const badgeSize = 15;
  const badgeW = measure(WATERMARK, 'bold', badgeSize) + 24;
  const bx = minX + width - badgeW - 14;
  const by = minY + height - 30 - 12;
  const badge =
    `<rect x="${bx}" y="${by}" width="${badgeW}" height="30" rx="15" fill="${C.panel}" fill-opacity="0.85" stroke="${C.line2}"/>` +
    textLines([WATERMARK], bx + badgeW / 2, by, { font: 'bold', size: badgeSize, fill: C.text2, lineHeight: 30, anchor: 'middle' });
  return pattern + badge;
}

// ---------- Document ----------

const PADDING = 48;
const MAX_SIDE = 2400;
const MAX_SCALE = 2;

export function renderDiagramSvg(doc: { nodes: FlowNode[]; edges: FlowEdge[] }, opts: { watermark?: boolean } = {}) {
  if (!doc.nodes.length) return null;
  const laid = new Map<string, Laid>();
  for (const n of doc.nodes) laid.set(n.id, layNode(n));
  const edges = doc.edges.map((e) => layEdge(e, laid)).filter((e): e is LaidEdge => !!e);

  const all: Box[] = [...laid.values(), ...edges.flatMap((e) => (e.label ? [e.label] : []))];
  const minX = Math.min(...all.map((b) => b.x)) - PADDING;
  const minY = Math.min(...all.map((b) => b.y)) - PADDING;
  const width = Math.ceil(Math.max(...all.map((b) => b.x + b.w)) + PADDING - minX);
  const height = Math.ceil(Math.max(...all.map((b) => b.y + b.h)) + PADDING - minY);

  // Lanes behind everything, then lines, then labels, then the other nodes: the editor's stacking order.
  const lanes = doc.nodes.filter((n) => n.type === 'lane');
  const others = doc.nodes.filter((n) => n.type !== 'lane');
  const accent = [mix(C.accent, 0.12, C.nodeBg), mix(C.accent, 0.04, C.nodeBg)];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}">` +
    `<defs>${markerDefs()}<linearGradient id="fd-accent-card" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${accent[0]}"/><stop offset="1" stop-color="${accent[1]}"/></linearGradient></defs>` +
    `<rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${C.bg}"/>` +
    lanes.map((n) => laid.get(n.id)!.draw()).join('') +
    edges.map((e) => e.line).join('') +
    edges.map((e) => e.label?.draw() ?? '').join('') +
    others.map((n) => laid.get(n.id)!.draw()).join('') +
    (opts.watermark ? watermark(minX, minY, width, height) : '') +
    '</svg>';
  return { svg, width, height };
}

/** PNG of the whole diagram on an opaque background, or null for an empty one. */
export function renderDiagramPng(doc: { nodes: FlowNode[]; edges: FlowEdge[] }, opts: { watermark?: boolean } = {}) {
  const out = renderDiagramSvg(doc, opts);
  if (!out) return null;
  const scale = Math.min(MAX_SCALE, MAX_SIDE / Math.max(out.width, out.height));
  const resvg = new Resvg(out.svg, {
    background: C.bg,
    fitTo: { mode: 'width', value: Math.max(1, Math.round(out.width * scale)) },
    font: {
      fontFiles: Object.values(FONT_FILES).map((f) => FONT_DIR + f),
      loadSystemFonts: false,
      defaultFontFamily: FAMILY.sans,
    },
  });
  const image = resvg.render();
  return { png: image.asPng(), width: image.width, height: image.height };
}
