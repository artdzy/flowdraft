import type { NodeDataMap, NodeKind } from './types';

export type PaletteItem = {
  [K in NodeKind]: { id: string; label: string; icon: string; kind: K; data: Partial<NodeDataMap[K]> };
}[NodeKind];

export type PaletteGroup = { title: string; items: PaletteItem[] };

export const DND_MIME = 'application/x-flowdraft-item';

export const PALETTE: PaletteGroup[] = [
  {
    title: 'Adımlar',
    items: [
      { id: 'step', label: 'Adım', icon: 'Zap', kind: 'card', data: {} },
      { id: 'step-accent', label: 'Vurgulu adım', icon: 'Target', kind: 'card', data: { tag: 'ÖNEMLİ', title: 'Kritik adım', icon: 'Target', tone: 'accent', highlight: true } },
      { id: 'gate', label: 'İnsan onayı', icon: 'CircleCheck', kind: 'card', data: { tag: 'SEN', title: 'Onayla', subtitle: 'insan onayı', icon: 'CircleCheck', tone: 'gate' } },
      { id: 'decision', label: 'Karar', icon: 'Split', kind: 'decision', data: {} },
      { id: 'start', label: 'Başla / Bitir', icon: 'Play', kind: 'terminal', data: {} },
    ],
  },
  {
    title: 'Aktörler',
    items: [
      { id: 'person', label: 'Kişi', icon: 'User', kind: 'card', data: { tag: 'KİŞİ', title: 'Kullanıcı', subtitle: 'rolü', icon: 'User' } },
      { id: 'bot', label: 'Ajan / Bot', icon: 'Bot', kind: 'card', data: { tag: 'BOT', title: 'Ajan', subtitle: 'otomatik çalışır', icon: 'Bot' } },
      { id: 'system', label: 'Sistem', icon: 'Server', kind: 'card', data: { tag: 'API', title: 'Servis', subtitle: 'istek işler', icon: 'Server' } },
      { id: 'db', label: 'Veritabanı', icon: 'Database', kind: 'card', data: { tag: 'DB', title: 'Veritabanı', subtitle: 'tablo', icon: 'Database', tone: 'muted' } },
    ],
  },
  {
    title: 'Konuşma',
    items: [
      { id: 'bubble-left', label: 'Mesaj (sol)', icon: 'MessageCircle', kind: 'bubble', data: { speaker: 'MÜŞTERİ', text: 'Merhaba, bir sorum var.' } },
      { id: 'bubble-right', label: 'Mesaj (sağ)', icon: 'MessageSquare', kind: 'bubble', data: { speaker: 'DESTEK', text: 'Tabii, nasıl yardımcı olabilirim?', side: 'right', tone: 'accent' } },
    ],
  },
  {
    title: 'Not ve uyarı',
    items: [
      { id: 'note', label: 'Not', icon: 'PenLine', kind: 'note', data: {} },
      { id: 'info', label: 'Bilgi', icon: 'Info', kind: 'note', data: { kind: 'info', title: 'Bilgi', text: 'Açıklama ekle.' } },
      { id: 'warning', label: 'Uyarı', icon: 'TriangleAlert', kind: 'note', data: { kind: 'warning', title: 'Dikkat', text: 'Bu adımda risk var.' } },
      { id: 'danger', label: 'Hata', icon: 'OctagonAlert', kind: 'note', data: { kind: 'danger', title: 'Hata', text: 'İşlem başarısız olursa ne olur?' } },
      { id: 'success', label: 'Başarılı', icon: 'CircleCheck', kind: 'note', data: { kind: 'success', title: 'Tamam', text: 'Beklenen sonuç.' } },
    ],
  },
  {
    title: 'Düzen',
    items: [
      { id: 'lane', label: 'Kulvar', icon: 'Rows3', kind: 'lane', data: {} },
      { id: 'lane-dashed', label: 'Otomatik bölge', icon: 'Workflow', kind: 'lane', data: { label: 'OTOPİLOT', icon: 'Workflow', dashed: true } },
      { id: 'heading', label: 'Başlık', icon: 'PenLine', kind: 'text', data: {} },
      { id: 'label', label: 'Etiket yazı', icon: 'Hash', kind: 'text', data: { text: 'BÖLÜM ETİKETİ', variant: 'label', tone: 'muted' } },
      { id: 'chip', label: 'Çip', icon: 'Tag', kind: 'chip', data: {} },
    ],
  },
];

export const PALETTE_BY_ID: Record<string, PaletteItem> = Object.fromEntries(
  PALETTE.flatMap((g) => g.items).map((item) => [item.id, item]),
);
