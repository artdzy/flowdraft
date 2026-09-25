import { t } from '../i18n';
import type { EdgeColor, FlowEdgeData, NodeDataMap, NodeKind } from './types';

export const NODE_KINDS: NodeKind[] = ['card', 'lane', 'note', 'decision', 'terminal', 'text', 'chip', 'bubble'];

export const NODE_DEFAULTS: { [K in NodeKind]: NodeDataMap[K] } = {
  card: { tag: t('ADIM', 'STEP'), title: t('Yeni adım', 'New step'), subtitle: t('kısa açıklama', 'short description'), icon: 'Zap', tone: 'default', highlight: false },
  lane: { label: t('KULVAR', 'LANE'), icon: 'Rows3', dashed: false, tone: 'default' },
  note: { kind: 'note', title: t('Not', 'Note'), text: t('Buraya bir not yaz.', 'Write a note here.') },
  decision: { title: t('Uygun mu?', 'Is it OK?'), tone: 'default' },
  terminal: { title: t('Başla', 'Start'), tone: 'default' },
  text: { text: t('Başlık', 'Heading'), variant: 'heading', tone: 'default' },
  chip: { text: t('etiket', 'tag'), icon: 'Tag', tone: 'default' },
  bubble: { speaker: t('KİŞİ', 'PERSON'), text: t('Merhaba!', 'Hello!'), side: 'left', tone: 'default' },
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

/** CSS color values; theme-dependent ones resolve through tokens in styles.css. */
export const EDGE_COLOR: Record<EdgeColor, string> = {
  light: 'var(--edge-ink)',
  accent: 'var(--accent)',
  muted: 'var(--edge-muted)',
  blue: 'var(--blue)',
  green: 'var(--green)',
  amber: 'var(--amber)',
};

export const HANDLE_IDS = ['t', 'r', 'b', 'l'] as const;
