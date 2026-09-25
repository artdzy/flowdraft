import { t } from '../i18n';
import type { NodeDataMap, NodeKind } from './types';

export type PaletteItem = {
  [K in NodeKind]: { id: string; label: string; icon: string; kind: K; data: Partial<NodeDataMap[K]> };
}[NodeKind];

export type PaletteGroup = { title: string; items: PaletteItem[] };

export const DND_MIME = 'application/x-flowdraft-item';

export const PALETTE: PaletteGroup[] = [
  {
    title: t('Adımlar', 'Steps'),
    items: [
      { id: 'step', label: t('Adım', 'Step'), icon: 'Zap', kind: 'card', data: {} },
      { id: 'step-accent', label: t('Vurgulu adım', 'Highlighted step'), icon: 'Target', kind: 'card', data: { tag: t('ÖNEMLİ', 'IMPORTANT'), title: t('Kritik adım', 'Critical step'), icon: 'Target', tone: 'accent', highlight: true } },
      { id: 'gate', label: t('İnsan onayı', 'Human approval'), icon: 'CircleCheck', kind: 'card', data: { tag: t('SEN', 'YOU'), title: t('Onayla', 'Approve'), subtitle: t('insan onayı', 'human approval'), icon: 'CircleCheck', tone: 'gate' } },
      { id: 'decision', label: t('Karar', 'Decision'), icon: 'Split', kind: 'decision', data: {} },
      { id: 'start', label: t('Başla / Bitir', 'Start / End'), icon: 'Play', kind: 'terminal', data: {} },
    ],
  },
  {
    title: t('Aktörler', 'Actors'),
    items: [
      { id: 'person', label: t('Kişi', 'Person'), icon: 'User', kind: 'card', data: { tag: t('KİŞİ', 'PERSON'), title: t('Kullanıcı', 'User'), subtitle: t('rolü', 'role'), icon: 'User' } },
      { id: 'bot', label: t('Ajan / Bot', 'Agent / Bot'), icon: 'Bot', kind: 'card', data: { tag: 'BOT', title: t('Ajan', 'Agent'), subtitle: t('otomatik çalışır', 'runs automatically'), icon: 'Bot' } },
      { id: 'system', label: t('Sistem', 'System'), icon: 'Server', kind: 'card', data: { tag: 'API', title: t('Servis', 'Service'), subtitle: t('istek işler', 'handles requests'), icon: 'Server' } },
      { id: 'db', label: t('Veritabanı', 'Database'), icon: 'Database', kind: 'card', data: { tag: 'DB', title: t('Veritabanı', 'Database'), subtitle: t('tablo', 'table'), icon: 'Database', tone: 'muted' } },
    ],
  },
  {
    title: t('Konuşma', 'Conversation'),
    items: [
      { id: 'bubble-left', label: t('Mesaj (sol)', 'Message (left)'), icon: 'MessageCircle', kind: 'bubble', data: { speaker: t('MÜŞTERİ', 'CUSTOMER'), text: t('Merhaba, bir sorum var.', 'Hi, I have a question.') } },
      { id: 'bubble-right', label: t('Mesaj (sağ)', 'Message (right)'), icon: 'MessageSquare', kind: 'bubble', data: { speaker: t('DESTEK', 'SUPPORT'), text: t('Tabii, nasıl yardımcı olabilirim?', 'Sure, how can I help?'), side: 'right', tone: 'accent' } },
    ],
  },
  {
    title: t('Not ve uyarı', 'Notes and alerts'),
    items: [
      { id: 'note', label: t('Not', 'Note'), icon: 'PenLine', kind: 'note', data: {} },
      { id: 'info', label: t('Bilgi', 'Info'), icon: 'Info', kind: 'note', data: { kind: 'info', title: t('Bilgi', 'Info'), text: t('Açıklama ekle.', 'Add a description.') } },
      { id: 'warning', label: t('Uyarı', 'Warning'), icon: 'TriangleAlert', kind: 'note', data: { kind: 'warning', title: t('Dikkat', 'Caution'), text: t('Bu adımda risk var.', 'This step is risky.') } },
      { id: 'danger', label: t('Hata', 'Error'), icon: 'OctagonAlert', kind: 'note', data: { kind: 'danger', title: t('Hata', 'Error'), text: t('İşlem başarısız olursa ne olur?', 'What happens if this fails?') } },
      { id: 'success', label: t('Başarılı', 'Success'), icon: 'CircleCheck', kind: 'note', data: { kind: 'success', title: t('Tamam', 'Done'), text: t('Beklenen sonuç.', 'Expected outcome.') } },
    ],
  },
  {
    title: t('Düzen', 'Layout'),
    items: [
      { id: 'lane', label: t('Kulvar', 'Lane'), icon: 'Rows3', kind: 'lane', data: {} },
      { id: 'lane-dashed', label: t('Otomatik bölge', 'Automation zone'), icon: 'Workflow', kind: 'lane', data: { label: t('OTOPİLOT', 'AUTOPILOT'), icon: 'Workflow', dashed: true } },
      { id: 'heading', label: t('Başlık', 'Heading'), icon: 'PenLine', kind: 'text', data: {} },
      { id: 'label', label: t('Etiket yazı', 'Label'), icon: 'Hash', kind: 'text', data: { text: t('BÖLÜM ETİKETİ', 'SECTION LABEL'), variant: 'label', tone: 'muted' } },
      { id: 'chip', label: t('Çip', 'Chip'), icon: 'Tag', kind: 'chip', data: {} },
    ],
  },
];

export const PALETTE_BY_ID: Record<string, PaletteItem> = Object.fromEntries(
  PALETTE.flatMap((g) => g.items).map((item) => [item.id, item]),
);
