import type { XYPosition } from '@xyflow/react';
import { useEffect } from 'react';
import { NODE_SIZE } from '../flow/defaults';
import type { FlowDoc } from '../flow/types';
import { t } from '../i18n';
import { useEditor } from '../store/editor';
import { toast } from '../store/ui';
import { MAX_TEXT, parseDoc, serializeDoc } from './doc';
import { isTyping } from './keys';

/** Marks clipboard text as ours; anything else pasted becomes a text box. */
const MARK = 'flowdraft';

/** Last copy, for browsers that refuse clipboard access and for the right-click menu. */
let memory: FlowDoc | null = null;
let memoryText = '';
/** How many times the same clipboard content was pasted, so each paste lands a little further. */
let pasted = { text: '', count: 0 };

const snap = (v: number) => Math.round(v / 10) * 10;

function selection(): FlowDoc | null {
  const { nodes, edges } = useEditor.getState();
  const picked = nodes.filter((n) => n.selected);
  if (!picked.length) return null;
  const ids = new Set(picked.map((n) => n.id));
  return serializeDoc(
    picked,
    edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
  );
}

/** Copies the selected nodes and the connections between them. False when nothing is selected. */
export function copySelection(): boolean {
  const doc = selection();
  if (!doc) return false;
  memory = doc;
  memoryText = JSON.stringify({ [MARK]: 1, ...doc });
  pasted = { text: '', count: 0 };
  navigator.clipboard?.writeText(memoryText).catch(() => {
    // Clipboard blocked (permissions, insecure context): the in-memory copy still pastes within this tab.
  });
  return true;
}

export function cutSelection(): boolean {
  if (!copySelection()) return false;
  useEditor.getState().deleteSelection();
  return true;
}

function docFromText(text: string): FlowDoc | null {
  if (!text.startsWith('{')) return null;
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    return raw[MARK] ? parseDoc(raw) : null;
  } catch {
    return null;
  }
}

function bounds(doc: FlowDoc) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of doc.nodes) {
    const size = NODE_SIZE[n.type] ?? {};
    const w = n.width ?? size.width ?? 160;
    const h = n.height ?? size.height ?? 60;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Pastes a copied selection centred on `at` (the pointer) or, without one, a little below and right of the original. */
function pasteDoc(doc: FlowDoc, key: string, at: XYPosition | null) {
  if (!doc.nodes.length) return;
  pasted = pasted.text === key ? { text: key, count: pasted.count + 1 } : { text: key, count: 0 };
  let offset: XYPosition;
  if (at) {
    const b = bounds(doc);
    offset = { x: snap(at.x - b.x - b.w / 2), y: snap(at.y - b.y - b.h / 2) };
  } else {
    const step = 30 * (pasted.count + 1);
    offset = { x: step, y: step };
  }
  useEditor.getState().pasteDoc(doc, offset);
}

/**
 * Pastes clipboard text: a flowdraft selection comes back as nodes, anything else becomes a text box.
 * False when there was nothing usable.
 */
export function pasteText(text: string, at: XYPosition | null): boolean {
  const trimmed = text.replace(/\r\n?/g, '\n').trim();
  const doc = docFromText(trimmed) ?? (!trimmed || trimmed === memoryText ? memory : null);
  if (doc) {
    pasteDoc(doc, trimmed || memoryText, at);
    return true;
  }
  if (!trimmed) return false;
  const size = NODE_SIZE.text ?? {};
  const position = at
    ? { x: snap(at.x - (size.width ?? 160) / 2), y: snap(at.y - 20) }
    : { x: snap(Math.random() * 60), y: snap(Math.random() * 60) };
  useEditor.getState().addNode('text', { text: trimmed.slice(0, MAX_TEXT), variant: 'body' }, position);
  return true;
}

/** Paste from the right-click menu: asks the browser for the clipboard, falls back to the last in-app copy. */
export async function pasteFromClipboard(at: XYPosition | null) {
  let text = '';
  try {
    text = (await navigator.clipboard?.readText()) ?? '';
  } catch {
    // Permission refused: use what was copied here.
  }
  if (!pasteText(text, at) && !memory) toast(t('Yapıştırılacak bir şey yok.', 'Nothing to paste.'));
}

/**
 * ⌘C / ⌘X copy the selection; ⌘V comes in through the browser's own paste event so no clipboard permission is
 * needed. `pointer` gives the canvas position under the mouse, where a paste lands.
 */
export function useClipboard(pointer: () => XYPosition | null) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'c' && copySelection()) e.preventDefault();
      else if (key === 'x' && cutSelection()) e.preventDefault();
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      if (pasteText(e.clipboardData?.getData('text/plain') ?? '', pointer())) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('paste', onPaste);
    };
  }, [pointer]);
}
