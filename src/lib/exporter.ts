import { getNodesBounds } from '@xyflow/react';
import { getFontEmbedCSS, toJpeg, toPng, toSvg } from 'html-to-image';
import type { FlowDoc, FlowNode } from '../flow/types';
import { t } from '../i18n';
import { nativeApp, postNative } from './platform';

const PADDING = 48;
const MAX_SIDE = 8000;

export type ExportKind = 'png' | 'svg' | 'json';

function slug(title: string) {
  const base = title
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'flowdraft';
}

function download(href: string, filename: string) {
  if (nativeApp) {
    postNative({ type: 'export', filename, dataUrl: href });
    return;
  }
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

/** Where to draw the whole diagram so it fits in at most `maxSide` pixels. */
function frame(nodes: FlowNode[], maxSide: number) {
  const bounds = getNodesBounds(nodes);
  const rawW = bounds.width + PADDING * 2;
  const rawH = bounds.height + PADDING * 2;
  const scale = Math.min(1, maxSide / Math.max(rawW, rawH));
  const width = Math.round(rawW * scale);
  const height = Math.round(rawH * scale);
  const x = (-bounds.x + PADDING) * scale;
  const y = (-bounds.y + PADDING) * scale;
  return {
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111',
    width,
    height,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${scale})` },
  };
}

/** Editor chrome that never belongs in a picture of the diagram (also hidden by .fd-exporting in styles.css). */
const CHROME = ['react-flow__handle', 'react-flow__resize-control', 'fd-review-pin'];

export async function exportImage(kind: 'png' | 'svg', nodes: FlowNode[], title: string) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || !nodes.length) throw new Error(t('Dışa aktarılacak bir şey yok.', 'There’s nothing to export.'));

  document.documentElement.classList.add('fd-exporting');
  try {
    const options = { ...frame(nodes, MAX_SIDE), pixelRatio: kind === 'png' ? 2 : 1 };
    const dataUrl = kind === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options);
    download(dataUrl, `${slug(title)}.${kind}`);
  } finally {
    document.documentElement.classList.remove('fd-exporting');
  }
}

const PREVIEW_SIDE = 1600;
let previewFonts: Promise<string> | null = null;

/**
 * A small JPEG of the whole diagram for connected AI tools (src/lib/live.ts). Taken in the background while the user
 * works, so it filters editor chrome out instead of toggling .fd-exporting, which would make the canvas flicker.
 */
export async function renderPreview(nodes: FlowNode[]): Promise<string | null> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || !nodes.length) return null;
  const filter = (el: HTMLElement) => !CHROME.some((c) => el.classList?.contains(c));
  // Fonts are the slow part of every capture and never change, so they are embedded once per page.
  previewFonts ??= getFontEmbedCSS(viewport).catch(() => '');
  return toJpeg(viewport, { ...frame(nodes, PREVIEW_SIDE), pixelRatio: 1, quality: 0.82, filter, fontEmbedCSS: await previewFonts });
}

export function exportJson(doc: FlowDoc, title: string) {
  const text = JSON.stringify({ title, ...doc }, null, 2);
  if (nativeApp) {
    download(`data:application/json;charset=utf-8,${encodeURIComponent(text)}`, `${slug(title)}.flowdraft.json`);
    return;
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `${slug(title)}.flowdraft.json`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
