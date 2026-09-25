import { t } from '../i18n';
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
      node('text', 'kicker', 0, -118, { text: t('SÜREÇ · HAFTALIK SEO OTOPİLOT · KANITTAN ONAYA', 'PROCESS · WEEKLY SEO AUTOPILOT · FROM EVIDENCE TO APPROVAL'), variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -86, { text: t('Her pazartesi ajan sana onaylayacağın tek bir sayfa getirir.', 'Every Monday, the agent brings you a single page to approve.'), variant: 'heading' }),
      lane('l1', 0, t('ARAMA VERİSİ', 'SEARCH DATA'), 'Search'),
      lane('l2', 1, t('ZAMANLAMA', 'SCHEDULE'), 'Calendar'),
      lane('l3', 2, t('KAYIT VERİSİ', 'SIGNUP DATA'), 'UserPlus'),
      lane('l4', 3, t('AJAN', 'AGENT'), 'Bot'),
      lane('l5', 4, t('SEN', 'YOU'), 'Eye'),
      c('search', 1, 0, { tag: t('ARAMA', 'SEARCH'), title: t('Arama verisi', 'Search data'), subtitle: t('geçen hafta', 'last week'), icon: 'Search' }),
      c('monday', 0, 1, { tag: t('HAFTA', 'WEEKLY'), title: t('Pazartesi çalışır', 'Runs on Monday'), subtitle: t('her hafta 09:00', 'every week at 9 AM'), icon: 'Calendar', tone: 'accent' }),
      c('signup', 1, 2, { tag: t('KAYIT', 'SIGNUP'), title: t('Kayıtlar', 'Signups'), subtitle: t('sayfa başına', 'per page'), icon: 'UserPlus' }),
      c('lineup', 2, 3, { tag: 'BOT', title: t('Eşleştir', 'Match up'), subtitle: t('arama × kayıt', 'search × signups'), icon: 'Rows3' }),
      c('pick', 3, 3, { tag: 'BOT', title: t('Bir sayfa seç', 'Pick one page'), subtitle: t('ilgiyi hak eden', 'the one worth attention'), icon: 'Target', tone: 'accent', highlight: true }),
      c('link', 4, 3, { tag: 'BOT', title: t('Nedenleri bağla', 'Link the reasons'), subtitle: t('neden → bağlantı', 'reason → link'), icon: 'Link' }),
      c('brief', 4, 4, { tag: t('SEN', 'YOU'), title: t('Özeti oku', 'Read the brief'), subtitle: t('tek sayfa, bağlantılı', 'one page, with links'), icon: 'FileText' }),
      c('approve', 5, 4, { tag: t('SEN', 'YOU'), title: t('Onayla', 'Approve'), subtitle: t('insan onayı', 'human approval'), icon: 'CircleCheck', tone: 'gate' }),
      node('note', 'autopilot', 160, 4 * 130 + 22, { kind: 'info', title: t('Otopilot', 'Autopilot'), text: t('1–5. adımlar sensiz çalışır. Sen sadece son sayfayı onaylarsın.', 'Steps 1–5 run without you. You only approve the final page.') }, { width: 380 }),
    ],
    edges: [
      edge('monday', 'r', 'search', 'b', { line: 'dashed', label: t('haftalık tetik', 'weekly trigger') }),
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
      node('text', 'kicker', 0, -84, { text: t('YAZILIM AKIŞI · GİRİŞ', 'SOFTWARE FLOW · SIGN-IN'), variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -54, { text: t('Kullanıcı girişi: istemci, API ve veritabanı', 'User sign-in: client, API and database'), variant: 'heading' }),
      lane('client', 0, t('İSTEMCİ', 'CLIENT'), 'Monitor'),
      lane('api', 1, 'API', 'Server'),
      lane('data', 2, t('VERİ', 'DATA'), 'Database'),
      node('terminal', 'start', 160, 53, { title: t('Giriş ekranı', 'Sign-in screen') }),
      node('card', 'form', 380, 27, { tag: 'WEB', title: t('Giriş formu', 'Sign-in form'), subtitle: t('e-posta + şifre', 'email + password'), icon: 'Monitor' }, { width: 190 }),
      node('card', 'post', 380, 177, { tag: 'API', title: 'POST /login', subtitle: t('istek doğrulanır', 'request is validated'), icon: 'Server' }, { width: 190 }),
      node('card', 'lookup', 380, 327, { tag: 'DB', title: t('Kullanıcıyı bul', 'Find the user'), subtitle: t('users tablosu', 'users table'), icon: 'Database', tone: 'muted' }, { width: 190 }),
      node('decision', 'check', 620, 170, { title: t('Şifre doğru mu?', 'Password correct?') }),
      node('note', 'deny', 590, 22, { kind: 'danger', title: t('401 · Yetkisiz', '401 · Unauthorized'), text: t('Hata mesajı göster.', 'Show an error message.') }, { width: 210 }),
      node('card', 'token', 840, 177, { tag: 'API', title: t('Token üret', 'Issue a token'), subtitle: t('JWT · 1 saat', 'JWT · 1 hour'), icon: 'Key' }, { width: 190 }),
      node('card', 'panel', 840, 27, { tag: 'WEB', title: t('Panel açılır', 'Dashboard opens'), subtitle: t('oturum hazır', 'session ready'), icon: 'Monitor', tone: 'accent', highlight: true }, { width: 190 }),
      node('terminal', 'end', 1080, 53, { title: t('Bitti', 'Done'), tone: 'muted' }),
    ],
    edges: [
      edge('start', 'r', 'form', 'l'),
      edge('form', 'b', 'post', 't'),
      edge('post', 'b', 'lookup', 't'),
      edge('lookup', 'r', 'check', 'b'),
      edge('check', 'r', 'token', 'l', { color: 'green', label: t('evet', 'yes') }),
      edge('check', 't', 'deny', 'b', { color: 'accent', line: 'dashed', label: t('hayır', 'no') }),
      edge('token', 't', 'panel', 'b', { color: 'accent' }),
      edge('panel', 'r', 'end', 'l'),
    ],
  };
}

function conversation(): FlowDoc {
  return {
    version: 1,
    nodes: [
      node('text', 'kicker', 0, -96, { text: t('KONUŞMA AKIŞI · SİPARİŞ TAKİBİ', 'CONVERSATION FLOW · ORDER TRACKING'), variant: 'label', tone: 'accent' }),
      node('text', 'headline', 0, -66, { text: t('Müşteri destek görüşmesi', 'Customer support chat'), variant: 'heading' }),
      node('bubble', 'm1', 0, 0, { speaker: t('MÜŞTERİ', 'CUSTOMER'), text: t('Siparişim nerede? 3 gündür bekliyorum.', "Where's my order? I've been waiting for 3 days.") }),
      node('bubble', 'm2', 320, 110, { speaker: t('DESTEK', 'SUPPORT'), text: t('Çok üzgünüz! Sipariş numaranızı paylaşır mısınız?', 'So sorry about that! Could you share your order number?'), side: 'right', tone: 'accent' }),
      node('bubble', 'm3', 0, 230, { speaker: t('MÜŞTERİ', 'CUSTOMER'), text: '#48213' }),
      node('decision', 'shipped', 215, 340, { title: t('Kargoda mı?', 'Shipped yet?') }),
      node('bubble', 'm4', 440, 480, { speaker: t('DESTEK', 'SUPPORT'), text: t('Kargoda, yarın teslim edilecek. Takip: TR123', "It's on the way and arrives tomorrow. Tracking: TR123"), side: 'right', tone: 'accent' }),
      node('note', 'escalate', -60, 480, { kind: 'warning', title: t('Depoya aktar', 'Escalate to warehouse'), text: t('48 saat içinde çıkmazsa ekip devralır.', "If it hasn't shipped within 48 hours, the team takes over.") }, { width: 250 }),
      node('card', 'warehouse', -35, 620, { tag: t('EKİP', 'TEAM'), title: t('Depo ekibi', 'Warehouse team'), subtitle: t('manuel kontrol', 'manual check'), icon: 'Package' }),
      node('terminal', 'close', 505, 640, { title: t('Görüşme kapanır', 'Chat closed'), tone: 'muted' }),
    ],
    edges: [
      edge('m1', 'b', 'm2', 'l'),
      edge('m2', 'b', 'm3', 'r'),
      edge('m3', 'b', 'shipped', 'l'),
      edge('shipped', 'r', 'm4', 't', { color: 'green', label: t('evet', 'yes') }),
      edge('shipped', 'b', 'escalate', 't', { color: 'amber', line: 'dashed', label: t('hayır', 'no') }),
      edge('escalate', 'b', 'warehouse', 't', { line: 'dotted' }),
      edge('m4', 'b', 'close', 't'),
    ],
  };
}

export type TemplateId = 'blank' | 'automation' | 'software' | 'conversation';

export const TEMPLATES: { id: TemplateId; title: string; description: string; icon: string; build: () => FlowDoc }[] = [
  { id: 'blank', title: t('Boş tuval', 'Blank canvas'), description: t('Sıfırdan başla', 'Start from scratch'), icon: 'PenLine', build: () => ({ version: 1, nodes: [], edges: [] }) },
  { id: 'automation', title: t('Otomasyon', 'Automation'), description: t('Tetik → ajan → insan onayı', 'Trigger → agent → human approval'), icon: 'Workflow', build: automation },
  { id: 'software', title: t('Yazılım', 'Software'), description: t('İstemci, API, veritabanı', 'Client, API, database'), icon: 'CodeXml', build: software },
  { id: 'conversation', title: t('Konuşma', 'Conversation'), description: t('Müşteri ↔ destek diyaloğu', 'Customer ↔ support chat'), icon: 'MessageCircle', build: conversation },
];
