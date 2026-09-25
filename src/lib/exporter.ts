import { getNodesBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import type { FlowDoc, FlowNode } from '../flow/types';
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

export async function exportImage(kind: 'png' | 'svg', nodes: FlowNode[], title: string) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || !nodes.length) throw new Error('Dışa aktarılacak bir şey yok.');

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
    const options = {
      backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#111111',
      width,
      height,
      pixelRatio: kind === 'png' ? 2 : 1,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${scale})` },
    };
    const dataUrl = kind === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options);
    download(dataUrl, `${slug(title)}.${kind}`);
  } finally {
    document.documentElement.classList.remove('fd-exporting');
  }
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
