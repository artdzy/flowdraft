import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Guide pages: server-rendered articles that target flowchart searches in Turkish and English. One file per TR/EN
 * page pair (seo/guides/<id>.json; files starting with "_" are skipped). Pages are complete HTML documents with their
 * own head, JSON-LD and inline styles, readable without JavaScript. Example diagrams are drawn by the MCP renderer
 * (server/render.ts) and served as PNG under a descriptive file name per language (the example's "slug"), and as JSON
 * for the editor (?ornek=<id> in src/App.tsx).
 * Everything is checked at startup: a mistake in a file stops the server with a list of what to fix.
 */

const LANGS = ['tr', 'en'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PAGE_PATH = /^(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HANDLES = ['t', 'r', 'b', 'l'];
const BLOCKS = ['p', 'h3', 'ul', 'ol', 'table', 'example', 'symbols', 'tip', 'cta'];
const PAGE_FIELDS = ['path', 'title', 'description', 'h1', 'lead', 'breadcrumb'];
const NODE_KEYS = ['id', 'type', 'position', 'width', 'height', 'data'];
const EDGE_KEYS = ['id', 'type', 'source', 'target', 'sourceHandle', 'targetHandle', 'data'];
const EDGE_FIELDS = { label: '', line: 'solid', color: 'light', path: 'smooth', arrow: 'end', animated: false };
const MAX_TEXT = 2000;
const TITLE_SUFFIX = ' · flowdraft';
// The usual order in menus; guides added later follow these.
const ORDER = ['guide', 'symbols', 'examples', 'ai'];
// Paths the app or server already uses, so a guide can never shadow them.
const RESERVED = ['/ornekler', '/assets', '/oauth', '/yonetim', '/profil', '/healthz', '/.well-known'];
const LINK = /\[([^\]\n]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g;

// Standard flowchart symbols (ISO 5807 and common practice), drawn on a 64 × 40 box with the current text color.
const SHAPES = {
  terminal: '<rect x="4" y="9" width="56" height="22" rx="11"/>',
  process: '<rect x="6" y="7" width="52" height="26" rx="1.5"/>',
  decision: '<path d="M32 3 61 20 32 37 3 20Z"/>',
  io: '<path d="M15 7H61L49 33H3Z"/>',
  predefined: '<rect x="5" y="7" width="54" height="26" rx="1.5"/><path d="M12 7V33M52 7V33"/>',
  document: '<path d="M6 6H58V30C49 24 41 28 32 32S15 36 6 30Z"/>',
  'multi-document': '<path d="M14 8V4H60V24H56M10 12V8H56V28H52"/><path d="M5 12H52V31C44 26 37 30 29 33S12 36 5 31Z"/>',
  database: '<ellipse cx="32" cy="9" rx="22" ry="5"/><path d="M10 9V31C10 34 20 36 32 36S54 34 54 31V9"/>',
  'manual-input': '<path d="M6 17 58 6V34H6Z"/>',
  'manual-operation': '<path d="M4 7H60L50 33H14Z"/>',
  preparation: '<path d="M16 7H48L60 20 48 33H16L4 20Z"/>',
  delay: '<path d="M8 7H40A13 13 0 0 1 40 33H8Z"/>',
  connector: '<circle cx="32" cy="20" r="13"/>',
  'off-page': '<path d="M17 4H47V25L32 36 17 25Z"/>',
  display: '<path d="M4 20 15 7H47C55 7 60 13 60 20S55 33 47 33H15Z"/>',
  annotation: '<path d="M30 6H20V34H30"/><path d="M20 20H6" stroke-dasharray="3 3"/><path d="M35 14H56M35 20H52M35 26H54" opacity=".45"/>',
  flowline: '<path d="M5 20H52"/><path d="M50 13 59 20 50 27Z" fill="currentColor"/>',
  merge: '<path d="M10 7H54L32 34Z"/>',
  'loop-limit': '<path d="M14 7H50L58 15V33H6V15Z"/>',
};

const UI = {
  tr: {
    locale: 'tr-TR',
    ogLocale: 'tr_TR',
    skip: 'İçeriğe geç',
    guides: 'Rehberler',
    open: 'Editörü aç',
    other: 'English',
    otherLabel: 'Bu sayfanın İngilizcesi',
    kicker: 'Rehber',
    updated: 'Güncellendi',
    reading: (n) => `${n} dk okuma`,
    toc: 'Bu sayfada',
    faq: 'Sık sorulan sorular',
    faqId: 'sss',
    tip: 'İpucu',
    openExample: 'Bu örneği flowdraft’ta aç',
    inFlowdraft: 'flowdraft’ta:',
    crumbs: 'Konum',
    bandTitle: 'Akış diyagramını şimdi çiz',
    bandText:
      'Ücretsiz; hesap açmadan tarayıcıda, telefonda ve tablette çiz. Ücretsiz hesapla buluta kaydet, PNG, SVG ya da JSON olarak dışa aktar.',
    product: 'flowdraft',
    legal: 'Yasal',
    tagline: 'Ücretsiz online akış diyagramı editörü.',
    imageAlt: 'flowdraft akış diyagramı editörü',
    links: {
      '/tanitim': 'Tanıtım videosu',
      '/mcp': 'Yapay zekâ bağlantısı (MCP)',
      '/destek': 'Destek',
      '/gizlilik': 'Gizlilik',
      '/kullanim-sartlari': 'Kullanım şartları',
    },
  },
  en: {
    locale: 'en-US',
    ogLocale: 'en_US',
    skip: 'Skip to content',
    guides: 'Guides',
    open: 'Open the editor',
    other: 'Türkçe',
    otherLabel: 'This page in Turkish',
    kicker: 'Guide',
    updated: 'Updated',
    reading: (n) => `${n} min read`,
    toc: 'On this page',
    faq: 'Frequently asked questions',
    faqId: 'faq',
    tip: 'Tip',
    openExample: 'Open this example in flowdraft',
    inFlowdraft: 'In flowdraft:',
    crumbs: 'Breadcrumb',
    bandTitle: 'Draw your flowchart now',
    bandText:
      'Free, and no account needed to draw: works in your browser, on phones and tablets. Sign in with a free account to save and export PNG, SVG or JSON.',
    product: 'flowdraft',
    legal: 'Legal',
    tagline: 'The free online flowchart maker.',
    imageAlt: 'flowdraft flowchart editor',
    links: {
      '/tanitim': 'Product tour',
      '/mcp': 'Connect AI tools (MCP)',
      '/destek': 'Support',
      '/gizlilik': 'Privacy',
      '/kullanim-sartlari': 'Terms of use',
    },
  },
};

/**
 * @param {object} opts
 * @param {string} opts.root  project root (seo/pages.json lives there)
 * @param {string} [opts.dir] folder with the guide files, seo/guides by default
 * @param {object} opts.diagram  the dist-server/mcp.js module: parseDoc, renderDiagramPng, NODE_DEFAULTS, NODE_SIZE, ENUMS, ICON_OPTIONS
 */
export function createGuides({ root, dir = path.join(root, 'seo/guides'), diagram }) {
  const site = JSON.parse(readFileSync(path.join(root, 'seo/pages.json'), 'utf8'));
  const { origin } = site;
  const sitePaths = new Set(Object.keys(site.pages));
  const enumKeys = new Set(Object.keys(diagram.ENUMS));
  const iconNames = new Set(diagram.ICON_OPTIONS.map((o) => o.name));
  const errors = [];
  const warnings = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);
  const warn = (where, message) => warnings.push(`${where}: ${message}`);

  // ---------- Loading ----------

  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .sort()
    : [];
  const guides = [];
  for (const file of files) {
    try {
      guides.push({ file, ...JSON.parse(readFileSync(path.join(dir, file), 'utf8')) });
    } catch (err) {
      fail(file, `not valid JSON (${err.message})`);
    }
  }
  guides.sort((a, b) => rank(a.id) - rank(b.id) || String(a.id).localeCompare(String(b.id)));

  /** Example id → { guide, text: { tr: {title, caption}, en }, docs: { tr, en } } */
  const examples = new Map();
  /** Page path → { guide, lang, page } */
  const byPath = new Map();
  // Examples with a problem of their own, so the pages showing them don't add an "unknown example" on top.
  const broken = new Set();

  for (const g of guides) {
    const where = g.file;
    if (g.id !== g.file.replace(/\.json$/, '')) fail(where, `"id" must be "${g.file.replace(/\.json$/, '')}" (the file name)`);
    if (!/^(0(\.\d)?|1(\.0)?)$/.test(g.priority ?? '')) fail(where, '"priority" must be a string from "0.0" to "1.0"');
    for (const key of ['published', 'updated']) {
      if (!DATE.test(g[key] ?? '') || Number.isNaN(Date.parse(g[key]))) fail(where, `"${key}" must be a date like "2026-10-01"`);
    }
    if (g.examples !== undefined && !isObj(g.examples)) fail(where, '"examples" must be an object');
    for (const [id, ex] of Object.entries(isObj(g.examples) ? g.examples : {})) checkExample(g, id, ex);
    for (const lang of LANGS) {
      const page = g[lang];
      if (!isObj(page)) {
        fail(where, `"${lang}" page is missing`);
        continue;
      }
      if (!isStr(page.path)) continue;
      if (byPath.has(page.path)) fail(`${where} ${lang}`, `path ${page.path} is already used by ${byPath.get(page.path).guide.file}`);
      else byPath.set(page.path, { guide: g, lang, page });
    }
  }
  // Pages are checked once every example and path is known, so links and example blocks can be resolved.
  for (const g of guides) {
    for (const lang of LANGS) if (isObj(g[lang])) checkPage(g, lang, g[lang]);
  }
  for (const [id, ex] of examples) {
    for (const lang of LANGS) checkLinks(lang, ex.text[lang].caption, `${ex.guide.file} example "${id}" ${lang} caption`);
  }
  /** "<lang>/<name>" → example id. A name is an example's slug, or its id (which redirects to the slug when there is one). */
  const fileIds = new Map();
  for (const lang of LANGS) {
    for (const id of examples.keys()) fileIds.set(`${lang}/${id}`, id);
    for (const [id, ex] of examples) {
      const slug = ex.text[lang].slug;
      if (slug === undefined || slug === id) continue;
      const taken = fileIds.get(`${lang}/${slug}`);
      if (taken) fail(`${ex.guide.file} example "${id}"`, `${lang} slug "${slug}" is already used by example "${taken}"`);
      else fileIds.set(`${lang}/${slug}`, id);
    }
  }
  const used = new Set();
  for (const g of guides) {
    for (const lang of LANGS) for (const id of exampleIds(g[lang])) used.add(id);
  }
  for (const [id, ex] of examples) if (!used.has(id)) warn(ex.guide.file, `example "${id}" is not shown on any page`);

  if (errors.length) {
    throw new Error(`seo/guides: ${errors.length} problem(s) to fix:\n  - ${errors.join('\n  - ')}`);
  }

  // ---------- Validation ----------

  function checkPage(g, lang, page) {
    const where = `${g.file} ${lang}`;
    for (const key of PAGE_FIELDS) if (!isStr(page[key])) fail(where, `"${key}" must be a non-empty string`);
    for (const key of Object.keys(page)) {
      if (![...PAGE_FIELDS, 'sections', 'faq'].includes(key)) fail(where, `unknown field "${key}"`);
    }
    if (isStr(page.path)) {
      if (!PAGE_PATH.test(page.path)) fail(where, `path "${page.path}" must be lowercase ASCII kebab-case like "/akis-diyagrami", no trailing slash`);
      if (sitePaths.has(page.path)) fail(where, `path ${page.path} clashes with a page in seo/pages.json`);
      if (RESERVED.some((r) => page.path === r || page.path.startsWith(`${r}/`))) fail(where, `path ${page.path} is reserved`);
    }
    if (isStr(page.title)) {
      if (!page.title.endsWith(TITLE_SUFFIX)) fail(where, `"title" must end with "${TITLE_SUFFIX}"`);
      const n = [...page.title].length;
      if (n < 45 || n > 62) warn(where, `title is ${n} characters (aim for 45–62)`);
    }
    if (isStr(page.description)) {
      const n = [...page.description].length;
      if (n < 130 || n > 158) warn(where, `description is ${n} characters (aim for 130–158)`);
    }
    for (const key of ['title', 'description', 'h1', 'breadcrumb']) {
      if (isStr(page[key]) && /\*\*|\]\(/.test(page[key])) warn(where, `"${key}" is plain text; markup shows literally`);
    }
    if (isStr(page.lead)) checkLinks(lang, page.lead, `${where} lead`);
    const sectionIds = new Set(['main', 'toc', UI[lang].faqId]);
    if (!Array.isArray(page.sections) || !page.sections.length) fail(where, '"sections" must be a non-empty array');
    else
      page.sections.forEach((s, i) => {
        const at = `${where} section ${i + 1}`;
        if (!isObj(s)) return fail(at, 'must be an object');
        for (const key of Object.keys(s)) if (!['h2', 'id', 'blocks'].includes(key)) fail(at, `unknown field "${key}"`);
        if (!isStr(s.h2)) fail(at, '"h2" must be a non-empty string');
        if (!isStr(s.id) || !KEBAB.test(s.id)) fail(at, '"id" must be a kebab-case anchor');
        else if (sectionIds.has(s.id)) fail(at, `id "${s.id}" is already used on this page`);
        else sectionIds.add(s.id);
        if (!Array.isArray(s.blocks) || !s.blocks.length) fail(at, '"blocks" must be a non-empty array');
        else s.blocks.forEach((b, j) => checkBlock(g, lang, b, `${at} block ${j + 1}`));
      });
    if (!Array.isArray(page.faq)) fail(where, '"faq" must be an array');
    else {
      if (page.faq.length < 4 || page.faq.length > 7) warn(where, `faq has ${page.faq.length} items (aim for 4–7)`);
      page.faq.forEach((f, i) => {
        if (!isObj(f) || !isStr(f.q) || !isStr(f.a)) fail(`${where} faq ${i + 1}`, 'needs "q" and "a" strings');
        else if (/\*\*|\]\(/.test(f.a)) warn(`${where} faq ${i + 1}`, 'answers are plain text; markup shows literally');
      });
    }
  }

  function checkBlock(g, lang, block, at) {
    const keys = isObj(block) ? Object.keys(block) : [];
    if (keys.length !== 1 || !BLOCKS.includes(keys[0])) {
      return fail(at, `must be exactly one of ${BLOCKS.join(', ')} (got ${keys.join(', ') || typeof block})`);
    }
    const [type] = keys;
    const value = block[type];
    if (['p', 'h3', 'tip', 'cta'].includes(type)) {
      if (!isStr(value)) return fail(at, `"${type}" must be a non-empty string`);
      if (type !== 'h3' && type !== 'cta') checkLinks(lang, value, at);
    } else if (type === 'ul' || type === 'ol') {
      if (!Array.isArray(value) || !value.length || !value.every(isStr)) return fail(at, `"${type}" must be a non-empty array of strings`);
      value.forEach((item) => checkLinks(lang, item, at));
    } else if (type === 'table') {
      // An empty first heading is fine: a comparison table's corner cell.
      if (!isObj(value) || !Array.isArray(value.head) || !value.head.every((h) => typeof h === 'string') || !value.head.some(isStr)) {
        return fail(at, 'table needs "head": an array of strings');
      }
      if (!Array.isArray(value.rows) || !value.rows.length) return fail(at, 'table needs "rows": a non-empty array');
      value.head.forEach((h) => checkLinks(lang, h, at));
      value.rows.forEach((row, r) => {
        if (!Array.isArray(row) || row.length !== value.head.length || !row.every((c) => typeof c === 'string')) {
          fail(at, `table row ${r + 1} must be ${value.head.length} strings, like "head"`);
        } else row.forEach((cell) => checkLinks(lang, cell, at));
      });
    } else if (type === 'example') {
      if (!isStr(value) || !(examples.has(value) || broken.has(value))) fail(at, `unknown example "${value}"`);
    } else if (type === 'symbols') {
      if (!Array.isArray(value) || !value.length) return fail(at, '"symbols" must be a non-empty array');
      value.forEach((s, i) => {
        if (!isObj(s) || !['name', 'meaning', 'flowdraft'].every((k) => isStr(s[k]))) {
          fail(`${at} symbol ${i + 1}`, 'needs "shape", "name", "meaning" and "flowdraft"');
        }
        if (!isObj(s) || !Object.hasOwn(SHAPES, s.shape)) {
          fail(`${at} symbol ${i + 1}`, `unknown shape "${s?.shape}" (one of ${Object.keys(SHAPES).join(', ')})`);
        } else {
          checkLinks(lang, s.meaning, at);
          checkLinks(lang, s.flowdraft, at);
        }
      });
    }
  }

  /** Internal links must point at a page that exists, in the page's own language. */
  function checkLinks(lang, text, at) {
    for (const m of String(text).matchAll(LINK)) {
      const url = m[2];
      if (!url.startsWith('/')) continue;
      const target = url.split(/[?#]/)[0];
      if (target === '/' || sitePaths.has(target)) continue;
      const hit = byPath.get(target);
      if (!hit) fail(at, `link to unknown page ${url}`);
      else if (hit.lang !== lang) fail(at, `link ${url} goes to the ${hit.lang.toUpperCase()} page; use the ${lang.toUpperCase()} one`);
    }
  }

  function checkExample(g, id, ex) {
    const where = `${g.file} example "${id}"`;
    if (!KEBAB.test(id)) return fail(where, 'id must be lowercase kebab-case ASCII');
    if (examples.has(id) || broken.has(id)) return fail(where, 'id is already used by another example');
    broken.add(id);
    if (!id.startsWith(`${g.id}-`)) warn(where, `id should start with "${g.id}-"`);
    if (!isObj(ex)) return fail(where, 'must be an object');
    const text = {};
    for (const lang of LANGS) {
      if (!isObj(ex[lang]) || !isStr(ex[lang].title) || !isStr(ex[lang].caption)) {
        fail(where, `"${lang}" needs "title" and "caption"`);
        continue;
      }
      for (const key of Object.keys(ex[lang])) if (!['title', 'caption', 'slug'].includes(key)) fail(where, `"${lang}" has an unknown field "${key}"`);
      const { slug } = ex[lang];
      if (slug !== undefined && !(typeof slug === 'string' && KEBAB.test(slug) && slug.length <= 100)) {
        fail(where, `"${lang}" slug must be lowercase kebab-case ASCII like "tek-cift-sayi-akis-diyagrami" (the picture's file name)`);
      } else text[lang] = ex[lang];
    }
    const raw = ex.doc;
    if (!isObj(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges) || !raw.nodes.length) {
      return fail(where, '"doc" needs "nodes" (non-empty) and "edges" arrays');
    }
    const before = errors.length;
    checkDoc(raw, where);
    if (errors.length > before) return;
    if (raw.nodes.length < 4 || raw.nodes.length > 14) warn(where, `${raw.nodes.length} nodes (aim for 4–14)`);
    overlaps(raw, where);
    const docs = {};
    for (const lang of LANGS) {
      const built = buildDoc(raw, lang);
      const doc = diagram.parseDoc(built);
      if (!doc || doc.nodes.length !== built.nodes.length || doc.edges.length !== built.edges.length) {
        return fail(where, `the ${lang} diagram loses nodes or edges when parsed (check ids, types and positions)`);
      }
      docs[lang] = doc;
    }
    if (Object.keys(text).length < LANGS.length) return;
    broken.delete(id);
    examples.set(id, { guide: g, text, docs });
  }

  function checkDoc(raw, where) {
    const ids = new Set();
    raw.nodes.forEach((n, i) => {
      const at = `${where} node ${isObj(n) && isStr(n.id) ? `"${n.id}"` : i + 1}`;
      if (!isObj(n)) return fail(at, 'must be an object');
      if (!isStr(n.id) || n.id.length > 64) fail(at, '"id" must be a string of up to 64 characters');
      else if (ids.has(n.id)) fail(at, 'duplicate id');
      else ids.add(n.id);
      const defaults = diagram.NODE_DEFAULTS[n.type];
      if (!defaults) return fail(at, `unknown type "${n.type}" (one of ${Object.keys(diagram.NODE_DEFAULTS).join(', ')})`);
      for (const key of Object.keys(n)) if (!NODE_KEYS.includes(key)) warn(at, `ignored field "${key}"`);
      if (!isObj(n.position) || !Number.isFinite(n.position.x) || !Number.isFinite(n.position.y)) fail(at, '"position" needs numbers x and y');
      for (const key of ['width', 'height']) {
        if (n[key] !== undefined && !(Number.isFinite(n[key]) && n[key] >= 20 && n[key] <= 8000)) fail(at, `"${key}" must be a number from 20 to 8000`);
      }
      if (n.data !== undefined && !isObj(n.data)) return fail(at, '"data" must be an object');
      for (const [key, val] of Object.entries(n.data ?? {})) checkField(defaults, key, val, `${at} data.${key}`);
    });
    raw.edges.forEach((e, i) => {
      const at = `${where} edge ${isObj(e) && isStr(e.id) ? `"${e.id}"` : i + 1}`;
      if (!isObj(e)) return fail(at, 'must be an object');
      for (const key of Object.keys(e)) if (!EDGE_KEYS.includes(key)) warn(at, `ignored field "${key}"`);
      if (e.id !== undefined && !(isStr(e.id) && e.id.length <= 64)) fail(at, '"id" must be a string of up to 64 characters');
      for (const key of ['source', 'target']) if (!ids.has(e[key])) fail(at, `"${key}" "${e[key]}" is not a node id`);
      for (const key of ['sourceHandle', 'targetHandle']) {
        if (e[key] !== undefined && !HANDLES.includes(e[key])) fail(at, `"${key}" must be one of t, r, b, l`);
      }
      if (e.data !== undefined && !isObj(e.data)) return fail(at, '"data" must be an object');
      for (const [key, val] of Object.entries(e.data ?? {})) checkField(EDGE_FIELDS, key, val, `${at} data.${key}`);
    });
  }

  /** A node or edge data field: known for that type, with the right kind of value. Free text may be {tr, en}. */
  function checkField(defaults, key, val, at) {
    if (!Object.hasOwn(defaults, key)) return fail(at, `unknown field (allowed: ${Object.keys(defaults).join(', ')})`);
    const def = defaults[key];
    if (typeof def === 'boolean') {
      if (typeof val !== 'boolean') fail(at, 'must be true or false');
    } else if (enumKeys.has(key)) {
      if (!diagram.ENUMS[key].includes(val)) fail(at, `"${val}" is not one of ${diagram.ENUMS[key].join(', ')}`);
    } else if (key === 'icon') {
      if (typeof val !== 'string' || (val && !iconNames.has(val))) fail(at, `unknown icon "${val}" (see src/flow/icons.ts)`);
    } else if (typeof val === 'string') {
      if (val.length > MAX_TEXT) fail(at, `longer than ${MAX_TEXT} characters`);
    } else if (!isObj(val) || Object.keys(val).sort().join() !== 'en,tr' || !LANGS.every((l) => typeof val[l] === 'string')) {
      fail(at, 'must be a string or {"tr": "...", "en": "..."}');
    }
  }

  /** Rough boxes (content-sized nodes are estimated), only to point out probable overlaps. */
  function overlaps(raw, where) {
    const boxes = raw.nodes.filter((n) => n.type !== 'lane' && n.type !== 'text').map((n) => ({ id: n.id, ...roughBox(n) }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
          warn(where, `nodes "${a.id}" and "${b.id}" probably overlap`);
        }
      }
    }
  }

  function roughBox(n) {
    const size = diagram.NODE_SIZE[n.type] ?? {};
    const title = typeof n.data?.title === 'string' ? n.data.title : (n.data?.title?.en ?? '');
    const chip = typeof n.data?.text === 'string' ? n.data.text : (n.data?.text?.en ?? '');
    const w =
      n.width ??
      size.width ??
      (n.type === 'terminal' ? Math.max(120, title.length * 8.5 + 42) : n.type === 'chip' ? 54 + chip.length * 8.4 : 120);
    const h = n.height ?? size.height ?? { card: 92, note: 64, bubble: 70, terminal: 44, chip: 40 }[n.type] ?? 40;
    return { x: n.position.x, y: n.position.y, w, h };
  }

  // ---------- Example diagrams ----------

  /**
   * Same shape as the MCP tools build (server/mcp.ts buildDoc), in one language. Free text left out stays empty
   * rather than taking the editor's placeholder ("New step", "short description"), and edges without sides get the
   * sides that face each other.
   */
  function buildDoc(raw, lang) {
    const byId = new Map(raw.nodes.map((n) => [n.id, n]));
    const nodes = raw.nodes.map((n) => {
      const data = {};
      for (const [key, def] of Object.entries(diagram.NODE_DEFAULTS[n.type])) {
        data[key] = typeof def === 'string' && !enumKeys.has(key) ? '' : def;
      }
      for (const [key, val] of Object.entries(n.data ?? {})) data[key] = pick(val, lang);
      return {
        id: n.id,
        type: n.type,
        position: { x: n.position.x, y: n.position.y },
        data,
        ...diagram.NODE_SIZE[n.type],
        ...(n.width !== undefined && { width: n.width }),
        ...(n.height !== undefined && { height: n.height }),
      };
    });
    const edges = raw.edges.map((e, i) => {
      const [sh, th] = facing(byId.get(e.source), byId.get(e.target));
      const data = {};
      for (const [key, val] of Object.entries(e.data ?? {})) data[key] = pick(val, lang);
      return {
        id: e.id ?? `e${i + 1}`,
        type: 'flow',
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? sh,
        targetHandle: e.targetHandle ?? th,
        data,
      };
    });
    return { nodes, edges };
  }

  function facing(from, to) {
    const a = roughBox(from);
    const b = roughBox(to);
    const dx = b.x + b.w / 2 - (a.x + a.w / 2);
    const dy = b.y + b.h / 2 - (a.y + a.h / 2);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['r', 'l'] : ['l', 'r'];
    return dy >= 0 ? ['b', 't'] : ['t', 'b'];
  }

  const pictures = new Map();

  /**
   * PNG of an example with flowdraft's corner mark, at 2 (default) or 1 pixel per diagram unit; drawn on first use and
   * kept in memory. A picture that fails to draw is remembered as null, so it isn't redrawn on every request.
   */
  function picture(lang, id, density = 2) {
    const key = `${lang}/${id}@${density}`;
    if (!pictures.has(key)) {
      const ex = examples.get(id);
      let pic = null;
      try {
        pic = ex ? diagram.renderDiagramPng(ex.docs[lang], { watermark: 'badge', maxScale: density }) : null;
      } catch (err) {
        console.error(`example ${lang}/${id} failed to render`, err);
      }
      pictures.set(key, pic);
    }
    return pictures.get(key);
  }

  /** The picture's file name in /ornekler/<lang>/: the example's slug in that language, else its id. */
  const fileName = (lang, id) => examples.get(id).text[lang].slug ?? id;
  const pictureUrl = (lang, id, density = 2) => `/ornekler/${lang}/${fileName(lang, id)}${density === 1 ? '@1x' : ''}.png`;

  // ---------- HTML ----------

  const pageUrl = (p) => origin + p;
  const counterpart = (g, lang) => g[lang === 'tr' ? 'en' : 'tr'];
  const homeHref = (lang) => `/?lang=${lang}`;

  /** Escapes everything, then turns **bold** and [text](/path or https://…) into markup. */
  function inline(text, lang) {
    let out = '';
    let last = 0;
    for (const m of text.matchAll(LINK)) {
      out += bold(esc(text.slice(last, m.index)));
      out += `<a href="${esc(localHref(m[2], lang))}">${bold(esc(m[1]))}</a>`;
      last = m.index + m[0].length;
    }
    return out + bold(esc(text.slice(last)));
  }

  /** Links into the app get the page's language, so a Turkish reader lands in the Turkish editor. */
  function localHref(url, lang) {
    if (!url.startsWith('/')) return url;
    const [, target, query = '', hash = ''] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
    if (!(target === '/' || sitePaths.has(target)) || /[?&]lang=/.test(query)) return url;
    return `${target}${query ? `${query}&` : '?'}lang=${lang}${hash}`;
  }

  function exampleIds(page) {
    if (!isObj(page) || !Array.isArray(page.sections)) return [];
    return page.sections.flatMap((s) => (Array.isArray(s?.blocks) ? s.blocks : [])).flatMap((b) => (isStr(b?.example) ? [b.example] : []));
  }

  function renderBlock(block, lang, state) {
    const ui = UI[lang];
    if (block.p !== undefined) return `<p>${inline(block.p, lang)}</p>`;
    if (block.h3 !== undefined) return `<h3>${esc(block.h3)}</h3>`;
    if (block.ul !== undefined) return `<ul>${block.ul.map((i) => `<li>${inline(i, lang)}</li>`).join('')}</ul>`;
    if (block.ol !== undefined) return `<ol>${block.ol.map((i) => `<li>${inline(i, lang)}</li>`).join('')}</ol>`;
    if (block.tip !== undefined) {
      return `<aside class="tip"><p><strong class="tip-label">${ui.tip}</strong> ${inline(block.tip, lang)}</p></aside>`;
    }
    if (block.cta !== undefined) {
      return `<p class="cta"><a class="btn primary" href="${homeHref(lang)}">${esc(block.cta)} <span aria-hidden="true">→</span></a></p>`;
    }
    if (block.table !== undefined) {
      const { head, rows } = block.table;
      // With an empty corner cell the first column names the rows.
      const rowHeads = head[0].trim() === '';
      const cell = (c, i) => (i === 0 && rowHeads ? `<th scope="row">${inline(c, lang)}</th>` : `<td>${inline(c, lang)}</td>`);
      return (
        '<div class="table" role="region" tabindex="0"><table>' +
        `<thead><tr>${head.map((h) => (h.trim() ? `<th scope="col">${inline(h, lang)}</th>` : '<td></td>')).join('')}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody>` +
        '</table></div>'
      );
    }
    if (block.symbols !== undefined) {
      const cards = block.symbols.map(
        (s) =>
          `<li class="symbol"><span class="symbol-art">${shapeSvg(s.shape)}</span>` +
          `<h3>${esc(s.name)}</h3><p>${inline(s.meaning, lang)}</p>` +
          `<p class="symbol-how"><strong>${ui.inFlowdraft}</strong> ${inline(s.flowdraft, lang)}</p></li>`,
      );
      return `<ul class="symbols wide">${cards.join('')}</ul>`;
    }
    const id = block.example;
    const ex = examples.get(id);
    const pic = picture(lang, id);
    const small = picture(lang, id, 1);
    // Only a picture in the first section can be in view when the page opens; the others wait until scrolled to.
    const lead = state.section === 0 && !state.leadImage;
    if (lead) state.leadImage = true;
    const { title, caption } = ex.text[lang];
    // Tall diagrams are kept to about 720 px high; the box keeps its ratio, so nothing moves when the image loads.
    const maxWidth = pic ? Math.round((pic.width / pic.height) * 720) : 1000;
    // Shown width: maxWidth or the page column inside the frame (962 px), and on narrower screens the screen less the
    // page margins and the frame. Screens that don't need the 2x picture then load the 1x one.
    const shown = Math.min(maxWidth, 962);
    const srcset =
      pic && small && small.width < pic.width
        ? `srcset="${pictureUrl(lang, id, 1)} ${small.width}w, ${pictureUrl(lang, id)} ${pic.width}w" ` +
          `sizes="(max-width: ${shown + 56}px) calc(100vw - 56px), ${shown}px" `
        : '';
    const img = pic
      ? `<img src="${pictureUrl(lang, id)}" ${srcset}width="${pic.width}" height="${pic.height}" alt="${esc(title)}" ` +
        `style="max-width:min(100%,${maxWidth}px)" ${lead ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : '';
    return (
      // The picture links to itself at full size, for zooming in on phones.
      `<figure class="example wide" id="ornek-${id}"><a class="frame" href="${pictureUrl(lang, id)}">${img}</a>` +
      `<figcaption><strong>${esc(title)}</strong> ${inline(caption, lang)}</figcaption>` +
      `<p class="example-open"><a class="btn" rel="nofollow" href="/?lang=${lang}&amp;ornek=${id}">${ui.openExample} ` +
      '<span aria-hidden="true">↗</span></a></p></figure>'
    );
  }

  function shapeSvg(shape) {
    return (
      '<svg viewBox="0 0 64 40" width="64" height="40" fill="none" stroke="currentColor" stroke-width="2" ' +
      `stroke-linejoin="round" stroke-linecap="round" aria-hidden="true" focusable="false">${SHAPES[shape]}</svg>`
    );
  }

  function jsonLd(g, lang, page, image, social) {
    const url = pageUrl(page.path);
    const org = { '@id': `${origin}/#org` };
    const graph = [
      {
        '@type': 'Organization',
        '@id': `${origin}/#org`,
        name: 'flowdraft',
        alternateName: ['flowdraft.tech'],
        url: `${origin}/`,
        logo: `${origin}/icon-512.png`,
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'flowdraft',
        alternateName: ['flowdraft.tech'],
        url: `${origin}/`,
        inLanguage: ['tr', 'en'],
        publisher: org,
      },
      {
        '@type': 'WebPage',
        '@id': url,
        url,
        name: page.title,
        description: page.description,
        inLanguage: lang,
        isPartOf: { '@id': `${origin}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        primaryImageOfPage: image.url,
        datePublished: stamp(g.published),
        dateModified: stamp(g.updated),
      },
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: page.h1,
        description: page.description,
        inLanguage: lang,
        datePublished: stamp(g.published),
        dateModified: stamp(g.updated),
        author: org,
        publisher: org,
        // The example diagram (usually tall) and the wide editor picture, so every crop has a fitting image.
        image: [...new Set([image.url, social.url])],
        mainEntityOfPage: { '@id': url },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'flowdraft', item: `${origin}${homeHref(lang)}` },
          { '@type': 'ListItem', position: 2, name: page.breadcrumb, item: url },
        ],
      },
    ];
    if (page.faq.length) {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${url}#${UI[lang].faqId}`,
        inLanguage: lang,
        mainEntity: page.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      });
    }
    // "<" escaped so no text can close the script element.
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  }

  function render(g, lang) {
    const ui = UI[lang];
    const page = g[lang];
    const other = counterpart(g, lang);
    const otherLang = lang === 'tr' ? 'en' : 'tr';
    const url = pageUrl(page.path);
    const state = { section: 0, leadImage: false };
    const sections = page.sections.map((s, i) => {
      state.section = i;
      return `<section class="flow full" id="${s.id}" aria-labelledby="${s.id}-h"><h2 id="${s.id}-h">${esc(s.h2)}</h2>${s.blocks.map((b) => renderBlock(b, lang, state)).join('')}</section>`;
    });
    // Link previews (Open Graph, X) crop to about 1.91:1, which cuts a tall diagram down to an unreadable strip, so they
    // get the wide editor picture; the page's own image in the structured data is its first example diagram.
    const social = { url: origin + site.image, width: 1920, height: 1080, alt: ui.imageAlt };
    const firstExample = exampleIds(page)[0];
    const pic = firstExample && picture(lang, firstExample);
    const image = pic ? { url: origin + pictureUrl(lang, firstExample) } : social;

    const toc =
      page.sections.length >= 3
        ? `<nav class="toc" aria-labelledby="toc-h"><h2 id="toc-h">${ui.toc}</h2><ol>` +
          page.sections.map((s) => `<li><a href="#${s.id}">${esc(s.h2)}</a></li>`).join('') +
          (page.faq.length ? `<li><a href="#${ui.faqId}">${ui.faq}</a></li>` : '') +
          '</ol></nav>'
        : '';
    const faq = page.faq.length
      ? `<section class="flow full faq" id="${ui.faqId}" aria-labelledby="${ui.faqId}-h"><h2 id="${ui.faqId}-h">${ui.faq}</h2>` +
        page.faq.map((f) => `<details><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('') +
        '</section>'
      : '';

    const guideLinks = (current) =>
      guides.map((x) => {
        const p = x[lang];
        return `<a href="${p.path}"${p.path === current ? ' aria-current="page"' : ''}>${esc(p.breadcrumb)}</a>`;
      });
    const nav = [...guideLinks(page.path).slice(0, 4), `<a href="/mcp?lang=${lang}">MCP</a>`].join('');
    const date = new Intl.DateTimeFormat(ui.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${g.updated}T00:00:00Z`),
    );
    const body = sections.join('') + page.faq.map((f) => `${f.q} ${f.a}`).join(' ');
    const minutes = Math.max(1, Math.round(countWords(stripTags(body)) / 200));

    const head = [
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
      `<title>${esc(page.title)}</title>`,
      `<meta name="description" content="${esc(page.description)}">`,
      '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
      `<link rel="canonical" href="${url}">`,
      `<link rel="alternate" hreflang="tr" href="${pageUrl(g.tr.path)}">`,
      `<link rel="alternate" hreflang="en" href="${pageUrl(g.en.path)}">`,
      `<link rel="alternate" hreflang="x-default" href="${pageUrl(g.en.path)}">`,
      '<meta property="og:type" content="article">',
      '<meta property="og:site_name" content="flowdraft">',
      `<meta property="og:title" content="${esc(page.title)}">`,
      `<meta property="og:description" content="${esc(page.description)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:image" content="${social.url}">`,
      `<meta property="og:image:width" content="${social.width}">`,
      `<meta property="og:image:height" content="${social.height}">`,
      `<meta property="og:image:alt" content="${esc(social.alt)}">`,
      `<meta property="og:locale" content="${ui.ogLocale}">`,
      `<meta property="og:locale:alternate" content="${UI[otherLang].ogLocale}">`,
      `<meta property="article:published_time" content="${g.published}">`,
      `<meta property="article:modified_time" content="${g.updated}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${esc(page.title)}">`,
      `<meta name="twitter:description" content="${esc(page.description)}">`,
      `<meta name="twitter:image" content="${social.url}">`,
      '<meta name="theme-color" content="#fbfbfa" media="(prefers-color-scheme: light)">',
      '<meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)">',
      '<meta name="color-scheme" content="light dark">',
      '<link rel="icon" href="/favicon.ico" sizes="48x48">',
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
      '<link rel="manifest" href="/manifest.webmanifest">',
      `<style>${CSS}</style>`,
      `<script type="application/ld+json">${jsonLd(g, lang, page, image, social)}</script>`,
    ];

    return `<!doctype html>
<html lang="${lang}">
<head>
${head.join('\n')}
</head>
<body>
<a class="skip" href="#main">${ui.skip}</a>
<header class="top">
<div class="wrap top-in">
<a class="brand" href="${homeHref(lang)}"><img src="/favicon.svg" width="28" height="28" alt=""><span>flowdraft</span></a>
<nav class="nav" aria-label="${ui.guides}">${nav}</nav>
<a class="lang" href="${other.path}" hreflang="${otherLang}" lang="${otherLang}" aria-label="${ui.otherLabel}">${ui.other}</a>
<a class="btn primary small" href="${homeHref(lang)}">${ui.open}</a>
</div>
</header>
<main id="main" class="wrap">
<article class="flow doc">
<nav class="crumbs" aria-label="${ui.crumbs}"><ol><li><a href="${homeHref(lang)}">flowdraft</a></li><li><a href="${page.path}" aria-current="page">${esc(page.breadcrumb)}</a></li></ol></nav>
<header class="hero">
<p class="kicker">${ui.kicker}</p>
<h1>${esc(page.h1)}</h1>
<p class="lead">${inline(page.lead, lang)}</p>
<p class="meta">${ui.updated} <time datetime="${g.updated}">${date}</time> · ${ui.reading(minutes)}</p>
</header>
${toc}
${sections.join('\n')}
${faq}
</article>
</main>
<section class="band" aria-labelledby="band-h">
<div class="wrap band-in">
<div><h2 id="band-h">${ui.bandTitle}</h2><p>${ui.bandText}</p></div>
<a class="btn primary big" href="${homeHref(lang)}">${ui.open} <span aria-hidden="true">→</span></a>
</div>
</section>
<footer class="foot">
<div class="wrap foot-in">
<div class="foot-brand"><a class="brand" href="${homeHref(lang)}"><img src="/favicon.svg" width="24" height="24" alt=""><span>flowdraft</span></a><p>${ui.tagline}</p></div>
<nav aria-label="${ui.guides}"><h2>${ui.guides}</h2><ul>${guideLinks(page.path).map((a) => `<li>${a}</li>`).join('')}</ul></nav>
<nav aria-label="${ui.product}"><h2>${ui.product}</h2><ul>${['/tanitim', '/mcp', '/destek'].map((p) => `<li><a href="${p}?lang=${lang}">${ui.links[p]}</a></li>`).join('')}</ul></nav>
<nav aria-label="${ui.legal}"><h2>${ui.legal}</h2><ul>${['/gizlilik', '/kullanim-sartlari'].map((p) => `<li><a href="${p}?lang=${lang}">${ui.links[p]}</a></li>`).join('')}<li><a href="${other.path}" hreflang="${otherLang}" lang="${otherLang}">${ui.other}</a></li></ul></nav>
</div>
<p class="wrap copy">© flowdraft</p>
</footer>
</body>
</html>
`;
  }

  const htmlCache = new Map();

  function html(pagePath) {
    const hit = byPath.get(pagePath);
    if (!hit) return null;
    if (!htmlCache.has(pagePath)) htmlCache.set(pagePath, render(hit.guide, hit.lang));
    return htmlCache.get(pagePath);
  }

  const ASSET = /^\/ornekler\/(tr|en)\/([a-z0-9-]+)(@1x)?\.(png|json)$/;

  return {
    /**
     * Express middleware for the guide pages and the examples: /ornekler/<lang>/<slug>.png (and <slug>@1x.png, half the
     * size, for ordinary screens) and <id or slug>.json for the editor. A picture asked for by id redirects to its slug.
     * Everything outside /ornekler falls through.
     */
    middleware(req, res, next) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const p = req.path;
      if (p.length > 1 && p.endsWith('/') && byPath.has(p.replace(/\/+$/, ''))) {
        const q = req.originalUrl.indexOf('?');
        res.redirect(301, p.replace(/\/+$/, '') + (q === -1 ? '' : req.originalUrl.slice(q)));
        return;
      }
      const page = html(p);
      if (page) {
        res.set('Cache-Control', 'public, max-age=600').type('html').send(page);
        return;
      }
      const m = ASSET.exec(p);
      if (!m) {
        // /ornekler belongs to the examples: anything else under it is a 404, not the app shell.
        if (p === '/ornekler' || p.startsWith('/ornekler/')) {
          res.status(404).type('text/plain').send('Not found');
          return;
        }
        return next();
      }
      const [, lang, name, small, ext] = m;
      const id = fileIds.get(`${lang}/${name}`);
      const ex = id && examples.get(id);
      if (!ex || (small && ext === 'json')) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      if (ext === 'json') {
        const doc = ex.docs[lang];
        res.set('Cache-Control', 'public, max-age=600').json({ version: 1, title: ex.text[lang].title, nodes: doc.nodes, edges: doc.edges });
        return;
      }
      if (name !== fileName(lang, id)) {
        res.redirect(301, pictureUrl(lang, id, small ? 1 : 2));
        return;
      }
      const pic = picture(lang, id, small ? 1 : 2);
      if (!pic) {
        res.status(404).type('text/plain').send('Not found');
        return;
      }
      res.set('Cache-Control', 'public, max-age=86400').type('png').send(pic.png);
    },

    /** Guide pages of one language, in menu order, for other pages' navigation. */
    nav(lang) {
      return guides.map((g) => ({ path: g[lang].path, title: g[lang].title, name: g[lang].breadcrumb }));
    },

    /** The language of a guide page, or undefined when the path isn't one: for other pages' link checks. */
    langOf(pagePath) {
      return byPath.get(pagePath)?.lang;
    },

    /** Whether an example id exists and drew its diagram documents without errors. */
    hasExample(id) {
      return examples.has(id);
    },

    /**
     * An example's picture for another page (the home page): the 2x picture with a 1x/2x srcset when the 1x one is
     * smaller, its size, title and caption, and the editor link. Null when the example is unknown or failed to draw.
     */
    figure(lang, id) {
      const ex = examples.get(id);
      const pic = ex && picture(lang, id);
      if (!pic) return null;
      const small = picture(lang, id, 1);
      return {
        src: pictureUrl(lang, id),
        srcset: small && small.width < pic.width ? `${pictureUrl(lang, id, 1)} ${small.width}w, ${pictureUrl(lang, id)} ${pic.width}w` : '',
        width: pic.width,
        height: pic.height,
        title: ex.text[lang].title,
        caption: ex.text[lang].caption,
        open: `/?lang=${lang}&ornek=${id}`,
        openText: UI[lang].openExample,
      };
    },

    /** One sitemap entry per page and language, with the TR/EN pair as alternates (x-default: English). */
    sitemapEntries() {
      return guides.flatMap((g) => {
        const alternates = { tr: pageUrl(g.tr.path), en: pageUrl(g.en.path), 'x-default': pageUrl(g.en.path) };
        return LANGS.map((lang) => ({ loc: pageUrl(g[lang].path), alternates, lastmod: g.updated, priority: g.priority }));
      });
    },

    /**
     * Draws every example picture, then every page, ahead of the first visitor. One picture per turn of the event loop,
     * so requests that arrive meanwhile (health checks, MCP calls) wait for one drawing at most, not a whole page.
     */
    warm() {
      const queue = [
        ...[...examples.keys()].flatMap((id) => LANGS.flatMap((lang) => [() => picture(lang, id), () => picture(lang, id, 1)])),
        ...[...byPath.keys()].map((p) => () => html(p)),
      ];
      const step = () => {
        const job = queue.shift();
        if (!job) return;
        try {
          job();
        } catch (err) {
          console.error('guide warm-up failed', err);
        }
        setImmediate(step);
      };
      setImmediate(step);
    },

    // For scripts/check-guides.mjs.
    warnings,
    html,
    picture,
    fileName,
    examples: () => [...examples.keys()],
    report() {
      return [...byPath.entries()].map(([p, { lang, page }]) => {
        const main = /<main[\s\S]*<\/main>/.exec(html(p))?.[0] ?? '';
        return {
          path: p,
          lang,
          title: [...page.title].length,
          description: [...page.description].length,
          words: countWords(stripTags(main)),
          examples: exampleIds(page).length,
        };
      });
    },
  };
}

function rank(id) {
  const i = ORDER.indexOf(id);
  return i === -1 ? ORDER.length : i;
}

function pick(value, lang) {
  return isObj(value) ? value[lang] : value;
}

function isObj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStr(v) {
  return typeof v === 'string' && v.trim() !== '';
}

function bold(html) {
  return html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}

function stripTags(html) {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, ' ');
}

function countWords(text) {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Inline styles only (CSP: style-src 'self' 'unsafe-inline'); light by default, dark with the system setting.
const CSS = `
:root{color-scheme:light dark;--bg:#fbfbfa;--surface:#fff;--soft:#f3f3f1;--line:#e4e4e0;--line-2:#d3d3ce;--text:#161616;--text-2:#4a4a46;--text-3:#6f6f6a;--accent:#e5484d;--btn:#d63c42;--btn-hover:#c4323a;--link:#b4232c;--accent-soft:rgba(229,72,77,.09);--accent-line:rgba(229,72,77,.35);--shadow:0 1px 2px rgba(20,20,20,.04),0 8px 24px rgba(20,20,20,.06);--sans:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;--mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#111;--surface:#161616;--soft:#1c1c1c;--line:#2a2a2a;--line-2:#3a3a3a;--text:#f2f2f2;--text-2:#b4b4b0;--text-3:#8f8f8a;--link:#ff9b9e;--accent-soft:rgba(229,72,77,.14);--accent-line:rgba(229,72,77,.5);--shadow:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35)}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-padding-top:84px;accent-color:var(--accent)}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.7 var(--sans);-webkit-font-smoothing:antialiased;overflow-wrap:break-word}
img,svg{display:block}
a{color:var(--link);text-underline-offset:.18em;text-decoration-thickness:1px}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.wrap{width:100%;max-width:1080px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
.skip{position:absolute;left:12px;top:-60px;z-index:20;background:var(--surface);color:var(--text);padding:8px 14px;border-radius:8px;border:1px solid var(--line-2)}
.skip:focus{top:12px}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface);color:var(--text);font:600 15px/1.2 var(--sans);text-decoration:none;white-space:nowrap;transition:background .15s,border-color .15s}
.btn:hover{border-color:var(--text-3);text-decoration:none}
.btn.primary{background:var(--btn);border-color:var(--btn);color:#fff}
.btn.primary:hover{background:var(--btn-hover);border-color:var(--btn-hover)}
.btn.small{min-height:38px;padding:8px 14px;font-size:14px}
.btn.big{min-height:52px;padding:14px 24px;font-size:16px}
.top{border-bottom:1px solid var(--line);background:var(--bg)}
.top-in{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px;padding-top:10px;padding-bottom:10px}
.brand{display:inline-flex;align-items:center;gap:9px;color:var(--text);font-weight:700;font-size:18px;letter-spacing:-.01em;text-decoration:none}
.brand img{border-radius:7px}
.nav{order:3;flex:1 0 100%;display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;margin:0 -8px;padding:2px 0}
.nav::-webkit-scrollbar{display:none}
.nav a{flex:none;padding:6px 8px;border-radius:8px;color:var(--text-2);font-size:14.5px;font-weight:500;text-decoration:none;white-space:nowrap}
.nav a:hover{color:var(--text);background:var(--soft)}
.nav a[aria-current]{color:var(--text);background:var(--soft)}
.lang{margin-left:auto;color:var(--text-2);font-size:14px;font-weight:500;text-decoration:none;padding:6px 4px}
.lang:hover{color:var(--text)}
@media (min-width:900px){.top{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);-webkit-backdrop-filter:saturate(1.4) blur(12px);backdrop-filter:saturate(1.4) blur(12px)}.top-in{flex-wrap:nowrap}.brand,.top-in>.btn{flex:none}.nav{order:0;flex:1 1 0;min-width:0;margin:0}.nav a:first-child{margin-left:auto}.nav a:last-child{margin-right:auto}.lang{margin-left:0}}
.flow{display:grid;grid-template-columns:[full-start] minmax(0,1fr) [content-start] min(100%,740px) [content-end] minmax(0,1fr) [full-end]}
.flow>*{grid-column:content;min-width:0}
.flow>.full{grid-column:full}
.flow>.wide{grid-column:full;width:min(100%,1000px);justify-self:center}
.doc{padding:20px 0 24px}
.crumbs ol{display:flex;flex-wrap:wrap;gap:4px;list-style:none;margin:0;padding:0;font-size:14px;color:var(--text-3)}
.crumbs li+li::before{content:'/';margin-right:6px;color:var(--line-2)}
.crumbs a{color:var(--text-3);text-decoration:none}
.crumbs a:hover{color:var(--text)}
.crumbs a[aria-current]{color:var(--text-2)}
.hero{padding:28px 0 8px}
.kicker{margin:0 0 10px;font:600 12.5px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
h1{margin:0 0 16px;font-size:clamp(32px,6vw,48px);line-height:1.1;letter-spacing:-.025em;font-weight:750;text-wrap:balance}
.lead{margin:0 0 16px;font-size:clamp(18px,2.4vw,20.5px);line-height:1.6;color:var(--text-2);text-wrap:pretty}
.meta{margin:0;font-size:14px;color:var(--text-3)}
h2{margin:52px 0 14px;font-size:clamp(25px,3.6vw,31px);line-height:1.2;letter-spacing:-.018em;font-weight:720;text-wrap:balance}
h3{margin:30px 0 8px;font-size:20px;line-height:1.3;letter-spacing:-.01em;font-weight:680}
p{margin:0 0 18px;text-wrap:pretty}
ul,ol{margin:0 0 20px;padding-left:1.4em}
li{margin:0 0 8px}
li::marker{color:var(--text-3)}
strong{font-weight:650}
.toc{margin:28px 0 4px;padding:18px 22px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
.toc h2{margin:0 0 8px;font:600 12.5px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.toc ol{margin:0;padding-left:1.3em;font-size:15.5px}
.toc li{margin:4px 0}
.toc a{color:var(--text-2);text-decoration:none}
.toc a:hover{color:var(--text);text-decoration:underline}
@media (min-width:700px){.toc ol{columns:2;column-gap:36px}.toc li{break-inside:avoid}}
.tip{margin:6px 0 22px;padding:14px 18px;border:1px solid var(--accent-line);border-left-width:4px;border-radius:10px;background:var(--accent-soft)}
.tip p{margin:0}
.tip-label{margin-right:4px;color:var(--link)}
.cta{margin:8px 0 26px}
.table{margin:4px 0 24px;overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:15.5px;line-height:1.5}
th,td{padding:11px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
thead th,thead td{background:var(--soft);font-weight:650;font-size:14.5px}
tbody th{font-weight:650}
tbody tr:last-child td{border-bottom:0}
.example{margin:14px 0 34px}
.frame{display:flex;justify-content:center;padding:clamp(8px,2vw,18px);border:1px solid var(--line);border-radius:16px;background:#f5f5f3;box-shadow:var(--shadow)}
.frame img{width:100%;height:auto;border-radius:6px}
.example figcaption{max-width:740px;margin:12px auto 0;font-size:15.5px;line-height:1.6;color:var(--text-2);text-align:center}
.example figcaption strong{display:block;color:var(--text)}
.example-open{margin:12px 0 0;text-align:center}
.symbols{list-style:none;margin:8px 0 28px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,290px),1fr));gap:14px}
.symbol{margin:0;padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:flex;flex-direction:column}
.symbol-art{display:flex;align-items:center;justify-content:center;height:76px;margin-bottom:12px;border-radius:10px;background:var(--soft);color:var(--text)}
.symbol-art svg{width:80px;height:50px}
.symbol h3{margin:0 0 6px;font-size:17.5px}
.symbol p{margin:0 0 10px;font-size:15.5px;line-height:1.55;color:var(--text-2)}
.symbol .symbol-how{margin:auto 0 0;padding-top:10px;border-top:1px dashed var(--line-2);font-size:14.5px}
.symbol-how strong{color:var(--text)}
.faq details{border-bottom:1px solid var(--line)}
.faq details:first-of-type{border-top:1px solid var(--line)}
.faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 2px;cursor:pointer;list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';flex:none;width:28px;height:28px;border-radius:50%;border:1px solid var(--line-2);display:grid;place-items:center;font-size:18px;line-height:1;color:var(--text-2);transition:transform .2s}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq summary h3{margin:0;font-size:17.5px;line-height:1.4}
.faq details p{margin:0 0 18px;color:var(--text-2)}
.band{margin-top:40px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:linear-gradient(180deg,var(--accent-soft),transparent 140%),var(--surface)}
.band-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px 40px;padding-top:44px;padding-bottom:44px}
.band h2{margin:0 0 8px}
.band p{margin:0;max-width:560px;color:var(--text-2)}
.foot{padding:40px 0 28px;font-size:15px;color:var(--text-2)}
.foot-in{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:28px}
.foot-brand p{margin:10px 0 0;color:var(--text-3)}
.foot h2{margin:0 0 10px;font:600 12.5px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.foot ul{list-style:none;margin:0;padding:0}
.foot li{margin:0 0 6px}
.foot nav a{color:var(--text-2);text-decoration:none}
.foot nav a:hover,.foot nav a[aria-current]{color:var(--text);text-decoration:underline}
.copy{margin:28px auto 0;color:var(--text-3);font-size:14px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`
  .trim()
  .replace(/\n/g, '');

/** A YYYY-MM-DD date as an ISO 8601 datetime with a time zone (Istanbul), the form Google prefers in structured data. */
function stamp(date) {
  return `${date}T12:00:00+03:00`;
}
