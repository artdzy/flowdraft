import { getNodesBounds } from '@xyflow/react';
import { toCanvas, toPng, toSvg } from 'html-to-image';
import type { FlowDoc, FlowNode } from '../flow/types';
import { t } from '../i18n';
import { buildPdf, layoutPdf, type PdfPage } from './pdf';
import { nativeApp, postNative } from './platform';

const PADDING = 48;
const MAX_SIDE = 8000;

export type ExportKind = 'png' | 'svg' | 'json' | 'pdfA4' | 'pdfA3';

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

/** Renders the whole flow, whatever part of it the canvas shows, with the editing chrome hidden. */
async function capture<T>(nodes: FlowNode[], render: (viewport: HTMLElement, options: CaptureOptions) => Promise<T>) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || !nodes.length) throw new Error(t('Dışa aktarılacak bir şey yok.', 'There’s nothing to export.'));

  const bounds = getNodesBounds(nodes);
  const rawW = bounds.width + PADDING * 2;
  const rawH = bounds.height + PADDING * 2;
  const scale = Math.min(1, MAX_SIDE / Math.max(rawW, rawH));
  const width = Math.round(rawW * scale);
  const height = Math.round(rawH * scale);
  const x = (-bounds.x + PADDING) * scale;
  const y = (-bounds.y + PADDING) * scale;

  document.documentElement.classList.add('fd-exporting');
  try {
    return await render(viewport, {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111',
      width,
      height,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${scale})` },
    });
  } finally {
    document.documentElement.classList.remove('fd-exporting');
  }
}

type CaptureOptions = { backgroundColor: string; width: number; height: number; style: Record<string, string> };

export async function exportImage(kind: 'png' | 'svg', nodes: FlowNode[], title: string) {
  const dataUrl = await capture(nodes, (viewport, options) =>
    kind === 'png' ? toPng(viewport, { ...options, pixelRatio: 2 }) : toSvg(viewport, { ...options, pixelRatio: 1 }),
  );
  download(dataUrl, `${slug(title)}.${kind}`);
}

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The flow as a picture on one A4 or A3 page, landscape or portrait to suit its shape. */
export async function exportPdf(page: PdfPage, nodes: FlowNode[], title: string) {
  const blob = await capture(nodes, async (viewport, options) => {
    const layout = layoutPdf(page, options.width, options.height);
    const canvas = await toCanvas(viewport, { ...options, pixelRatio: layout.pixelRatio });
    return buildPdf(canvas, layout, title);
  });
  const filename = `${slug(title)}-${page}.pdf`;
  if (nativeApp) {
    download(await readAsDataUrl(blob), filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
