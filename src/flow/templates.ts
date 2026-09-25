import { EDGE_DEFAULTS, NODE_DEFAULTS, NODE_SIZE } from './defaults';
import type { FlowDoc, FlowEdge, FlowEdgeData, FlowNode, NodeDataMap, NodeKind } from './types';

type H = 't' | 'r' | 'b' | 'l';

function node<K extends NodeKind>(
  kind: K,
  id: string,
  x: number,
  y: number,
  data: Partial<NodeDataMap[K]> = {},
  size: { width?: number; height?: number } = {},
): FlowNode {
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

function edge(source: string, sh: H, target: string, th: H, data: Partial<FlowEdgeData> = {}): FlowEdge {
  return {
    id: `e_${source}_${target}`,
    type: 'flow',
    source,
    sourceHandle: sh,
    target,
    targetHandle: th,
    data: { ...EDGE_DEFAULTS, ...data },
  };
}

function automation(): FlowDoc {
  const W = 190;
  const lane = (id: string, i: number, label: string, icon: string) =>
    node('lane', id, 0, i * 130, { label, icon }, { width: 1480, height: 130 });
  const c = (id: string, col: number, row: number, d: Partial<NodeDataMap['card']>) =>
    node('card', id, 160 + col * 220, row * 130 + 17, d, { width: W });
  return {
    version: 1,
    nodes: [
      node('text', 'kicker', 0, -118, { text: 'SÜREÇ · HAFTALIK SEO OTOPİLOT · KANITTAN ONAYA', variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -86, { text: 'Her pazartesi ajan sana onaylayacağın tek bir sayfa getirir.', variant: 'heading' }),
      lane('l1', 0, 'ARAMA VERİSİ', 'Search'),
      lane('l2', 1, 'ZAMANLAMA', 'Calendar'),
      lane('l3', 2, 'KAYIT VERİSİ', 'UserPlus'),
      lane('l4', 3, 'AJAN', 'Bot'),
      lane('l5', 4, 'SEN', 'Eye'),
      c('search', 1, 0, { tag: 'ARAMA', title: 'Arama verisi', subtitle: 'geçen hafta', icon: 'Search' }),
      c('monday', 0, 1, { tag: 'HAFTA', title: 'Pazartesi çalışır', subtitle: 'her hafta 09:00', icon: 'Calendar', tone: 'accent' }),
      c('signup', 1, 2, { tag: 'KAYIT', title: 'Kayıtlar', subtitle: 'sayfa başına', icon: 'UserPlus' }),
      c('lineup', 2, 3, { tag: 'BOT', title: 'Eşleştir', subtitle: 'arama × kayıt', icon: 'Rows3' }),
      c('pick', 3, 3, { tag: 'BOT', title: 'Bir sayfa seç', subtitle: 'ilgiyi hak eden', icon: 'Target', tone: 'accent', highlight: true }),
      c('link', 4, 3, { tag: 'BOT', title: 'Nedenleri bağla', subtitle: 'neden → bağlantı', icon: 'Link' }),
      c('brief', 4, 4, { tag: 'SEN', title: 'Özeti oku', subtitle: 'tek sayfa, bağlantılı', icon: 'FileText' }),
      c('approve', 5, 4, { tag: 'SEN', title: 'Onayla', subtitle: 'insan onayı', icon: 'CircleCheck', tone: 'gate' }),
      node('note', 'autopilot', 160, 4 * 130 + 22, { kind: 'info', title: 'Otopilot', text: '1–5. adımlar sensiz çalışır. Sen sadece son sayfayı onaylarsın.' }, { width: 380 }),
    ],
    edges: [
      edge('monday', 'r', 'search', 'b', { line: 'dashed', label: 'haftalık tetik' }),
      edge('monday', 'r', 'signup', 't', { line: 'dashed' }),
      edge('search', 'r', 'lineup', 't'),
      edge('signup', 'r', 'lineup', 't'),
      edge('lineup', 'r', 'pick', 'l', { color: 'accent' }),
      edge('pick', 'r', 'link', 'l', { color: 'accent' }),
      edge('link', 'b', 'brief', 't', { line: 'dotted', color: 'accent' }),
      edge('brief', 'r', 'approve', 'l'),
    ],
  };
}

function software(): FlowDoc {
  const lane = (id: string, i: number, label: string, icon: string) =>
    node('lane', id, 0, i * 150, { label, icon }, { width: 1320, height: 150 });
  return {
    version: 1,
    nodes: [
      node('text', 'kicker', 0, -84, { text: 'YAZILIM AKIŞI · GİRİŞ', variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -54, { text: 'Kullanıcı girişi: istemci, API ve veritabanı', variant: 'heading' }),
      lane('client', 0, 'İSTEMCİ', 'Monitor'),
      lane('api', 1, 'API', 'Server'),
      lane('data', 2, 'VERİ', 'Database'),
      node('terminal', 'start', 160, 53, { title: 'Giriş ekranı' }),
      node('card', 'form', 380, 27, { tag: 'WEB', title: 'Giriş formu', subtitle: 'e-posta + şifre', icon: 'Monitor' }, { width: 190 }),
      node('card', 'post', 380, 177, { tag: 'API', title: 'POST /login', subtitle: 'istek doğrulanır', icon: 'Server' }, { width: 190 }),
      node('card', 'lookup', 380, 327, { tag: 'DB', title: 'Kullanıcıyı bul', subtitle: 'users tablosu', icon: 'Database', tone: 'muted' }, { width: 190 }),
      node('decision', 'check', 620, 170, { title: 'Şifre doğru mu?' }),
      node('note', 'deny', 590, 22, { kind: 'danger', title: '401 · Yetkisiz', text: 'Hata mesajı göster.' }, { width: 210 }),
      node('card', 'token', 840, 177, { tag: 'API', title: 'Token üret', subtitle: 'JWT · 1 saat', icon: 'Key' }, { width: 190 }),
      node('card', 'panel', 840, 27, { tag: 'WEB', title: 'Panel açılır', subtitle: 'oturum hazır', icon: 'Monitor', tone: 'accent', highlight: true }, { width: 190 }),
      node('terminal', 'end', 1080, 53, { title: 'Bitti', tone: 'muted' }),
    ],
    edges: [
      edge('start', 'r', 'form', 'l'),
      edge('form', 'b', 'post', 't'),
      edge('post', 'b', 'lookup', 't'),
      edge('lookup', 'r', 'check', 'b'),
      edge('check', 'r', 'token', 'l', { color: 'green', label: 'evet' }),
      edge('check', 't', 'deny', 'b', { color: 'accent', line: 'dashed', label: 'hayır' }),
      edge('token', 't', 'panel', 'b', { color: 'accent' }),
      edge('panel', 'r', 'end', 'l'),
    ],
  };
}

function conversation(): FlowDoc {
  return {
    version: 1,
    nodes: [
      node('text', 'kicker', 0, -96, { text: 'KONUŞMA AKIŞI · SİPARİŞ TAKİBİ', variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -66, { text: 'Müşteri destek görüşmesi', variant: 'heading' }),
      node('bubble', 'm1', 0, 0, { speaker: 'MÜŞTERİ', text: 'Siparişim nerede? 3 gündür bekliyorum.' }),
      node('bubble', 'm2', 320, 110, { speaker: 'DESTEK', text: 'Çok üzgünüz! Sipariş numaranızı paylaşır mısınız?', side: 'right', tone: 'accent' }),
      node('bubble', 'm3', 0, 230, { speaker: 'MÜŞTERİ', text: '#48213' }),
      node('decision', 'shipped', 215, 340, { title: 'Kargoda mı?' }),
      node('bubble', 'm4', 440, 480, { speaker: 'DESTEK', text: 'Kargoda, yarın teslim edilecek. Takip: TR123', side: 'right', tone: 'accent' }),
      node('note', 'escalate', -60, 480, { kind: 'warning', title: 'Depoya aktar', text: '48 saat içinde çıkmazsa ekip devralır.' }, { width: 250 }),
      node('card', 'warehouse', -35, 620, { tag: 'EKİP', title: 'Depo ekibi', subtitle: 'manuel kontrol', icon: 'Package' }),
      node('terminal', 'close', 505, 640, { title: 'Görüşme kapanır', tone: 'muted' }),
    ],
    edges: [
      edge('m1', 'b', 'm2', 'l'),
      edge('m2', 'b', 'm3', 'r'),
      edge('m3', 'b', 'shipped', 'l'),
      edge('shipped', 'r', 'm4', 't', { color: 'green', label: 'evet' }),
      edge('shipped', 'b', 'escalate', 't', { color: 'amber', line: 'dashed', label: 'hayır' }),
      edge('escalate', 'b', 'warehouse', 't', { line: 'dotted' }),
      edge('m4', 'b', 'close', 't'),
    ],
  };
}

export type TemplateId = 'blank' | 'automation' | 'software' | 'conversation';

export const TEMPLATES: { id: TemplateId; title: string; description: string; icon: string; build: () => FlowDoc }[] = [
  { id: 'blank', title: 'Boş tuval', description: 'Sıfırdan başla', icon: 'PenLine', build: () => ({ version: 1, nodes: [], edges: [] }) },
  { id: 'automation', title: 'Otomasyon', description: 'Tetik → ajan → insan onayı', icon: 'Workflow', build: automation },
  { id: 'software', title: 'Yazılım', description: 'İstemci, API, veritabanı', icon: 'CodeXml', build: software },
  { id: 'conversation', title: 'Konuşma', description: 'Müşteri ↔ destek diyaloğu', icon: 'MessageCircle', build: conversation },
];
