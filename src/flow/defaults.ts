import type { EdgeColor, FlowEdgeData, NodeDataMap, NodeKind } from './types';

export const NODE_KINDS: NodeKind[] = ['card', 'lane', 'note', 'decision', 'terminal', 'text', 'chip', 'bubble'];

export const NODE_DEFAULTS: { [K in NodeKind]: NodeDataMap[K] } = {
  card: { tag: 'ADIM', title: 'Yeni adım', subtitle: 'kısa açıklama', icon: 'Zap', tone: 'default', highlight: false },
  lane: { label: 'KULVAR', icon: 'Rows3', dashed: false, tone: 'default' },
  note: { kind: 'note', title: 'Not', text: 'Buraya bir not yaz.' },
  decision: { title: 'Uygun mu?', tone: 'default' },
  terminal: { title: 'Başla', tone: 'default' },
  text: { text: 'Başlık', variant: 'heading', tone: 'default' },
  chip: { text: 'etiket', icon: 'Tag', tone: 'default' },
  bubble: { speaker: 'KİŞİ', text: 'Merhaba!', side: 'left', tone: 'default' },
};

/** Initial box size per kind; kinds without an entry size to their content. */
export const NODE_SIZE: Partial<Record<NodeKind, { width?: number; height?: number }>> = {
  card: { width: 200 },
  lane: { width: 1100, height: 130 },
  note: { width: 240 },
  decision: { width: 150, height: 110 },
  bubble: { width: 260 },
};

export const EDGE_DEFAULTS: FlowEdgeData = {
  line: 'solid',
  color: 'light',
  path: 'smooth',
  arrow: 'end',
  animated: false,
  label: '',
};

export const EDGE_HEX: Record<EdgeColor, string> = {
  light: '#d4d4d4',
  accent: '#e5484d',
  muted: '#6b6b6b',
  blue: '#5b9dff',
  green: '#3ecf8e',
  amber: '#f5a524',
};

export const HANDLE_IDS = ['t', 'r', 'b', 'l'] as const;
