import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Search engine and AI crawler support for the SPA shell: per-page title, description, canonical, hreflang,
 * Open Graph and JSON-LD in <head>, a <noscript> text version of the page for crawlers that don't run
 * JavaScript (the home page has a visible landing section instead, see below), and the sitemap. Page texts live in seo/pages.json (the promo page's FAQ reads it too).
 * The server-rendered guide pages (seo/guides.js) add their own entries to the sitemap and the <noscript> links.
 * Each page's "updated" date is its sitemap <lastmod>: change it only when the page's own text or links change, so
 * search engines can keep trusting it.
 *
 * The home page (the editor) also gets a plain HTML landing section after #root (seo/home.json): what flowdraft is,
 * how to draw a flowchart, features, links to the guides and the FAQ. React never touches it, so it stays in the page
 * for search engines that render JavaScript as well as for those that don't, below the full-height editor.
 */
export function createSeo({ root, dist, guides }) {
  const data = JSON.parse(readFileSync(path.join(root, 'seo/pages.json'), 'utf8'));
  const home = JSON.parse(readFileSync(path.join(root, 'seo/home.json'), 'utf8'));
  const shell = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const { origin, pages, features, faq } = data;
  const bad = Object.entries(pages)
    .filter(([, page]) => !/^\d{4}-\d{2}-\d{2}$/.test(page.updated ?? '') || Number.isNaN(Date.parse(page.updated)))
    .map(([pagePath]) => pagePath);
  if (bad.length) throw new Error(`seo/pages.json: "updated" must be a date like "2026-10-01" on ${bad.join(', ')}`);
  const homeErrors = checkHome(home, { pages, guides });
  if (homeErrors.length) throw new Error(`seo/home.json: ${homeErrors.length} problem(s) to fix:\n  - ${homeErrors.join('\n  - ')}`);
  const image = origin + data.image;

  /** The home page's questions: its own first, then the shared ones (the promo page shows those too). */
  const homeFaq = (lang) => [...home[lang].faq, ...faq.map((item) => ({ q: item.q[lang], a: item.a[lang] }))];

  const url = (pagePath, lang) => origin + pagePath + (lang ? `?lang=${lang}` : '');
  // Google crawls without Accept-Language, so the plain URL is the English page to it; ?lang=en is the same page.
  // English is therefore canonical on the plain URL and only Turkish gets its own (?lang=tr).
  const canonical = (pagePath, lang) => url(pagePath, lang === 'tr' ? 'tr' : undefined);

  // Same rule as src/i18n.ts: an explicit ?lang= wins, then the TR / EN switch's choice (its fd_lang cookie), else
  // Turkish for Turkish browsers and English otherwise.
  function pickLang(req) {
    const asked = typeof req.query.lang === 'string' ? req.query.lang : '';
    if (asked === 'tr' || asked === 'en') return { lang: asked, explicit: true };
    const saved = /(?:^|;\s*)fd_lang=(tr|en)(?:;|$)/.exec(req.get('cookie') ?? '')?.[1];
    if (saved) return { lang: saved, explicit: false };
    const first = (req.get('accept-language') ?? '').split(',')[0].trim().toLowerCase();
    return { lang: first.startsWith('tr') ? 'tr' : 'en', explicit: false };
  }

  function jsonLd(pagePath, lang, meta, pageUrl) {
    const home = pages['/'][lang];
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
        publisher: { '@id': `${origin}/#org` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${origin}/#app`,
        name: 'flowdraft',
        url: `${origin}/`,
        description: home.description,
        applicationCategory: 'DesignApplication',
        applicationSubCategory: lang === 'tr' ? 'Akış diyagramı editörü' : 'Flowchart editor',
        operatingSystem: 'Web browser, iOS, iPadOS, Android, Windows, macOS, Linux',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: features[lang],
        inLanguage: ['tr', 'en'],
        image,
        screenshot: image,
        publisher: { '@id': `${origin}/#org` },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#page`,
        url: pageUrl,
        name: meta.title,
        description: meta.description,
        inLanguage: lang,
        isPartOf: { '@id': `${origin}/#website` },
        about: { '@id': `${origin}/#app` },
        primaryImageOfPage: image,
      },
    ];
    if (pagePath === '/tanitim') {
      graph.push({
        '@type': 'VideoObject',
        name: meta.title,
        description: meta.description,
        thumbnailUrl: image,
        contentUrl: `${origin}/promo/flowdraft-16x9.mp4`,
        // Google wants a full datetime with a time zone here.
        uploadDate: '2026-09-25T12:00:00+03:00',
        duration: 'PT30S',
        inLanguage: 'en',
      });
    }
    // The promo page shows the shared questions too, but Google asks for one marked-up copy of an FAQ per site: the
    // home page's, which has them all.
    if (pagePath === '/') {
      graph.push({
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        inLanguage: lang,
        mainEntity: homeFaq(lang).map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      });
    }
    // "<" escaped so no text can close the script element.
    return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
  }

  function head(pagePath, lang, explicit, indexable) {
    const meta = (pages[pagePath] ?? pages['/'])[lang];
    const pageUrl = explicit ? canonical(pagePath, lang) : url(pagePath);
    const tags = [
      `<title>${esc(meta.title)}</title>`,
      `<meta name="description" content="${esc(meta.description)}" />`,
    ];
    if (!indexable) {
      tags.push('<meta name="robots" content="noindex, follow" />');
      return tags.join('\n    ');
    }
    const other = lang === 'tr' ? 'en' : 'tr';
    tags.push(
      '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />',
      `<link rel="canonical" href="${pageUrl}" />`,
      `<link rel="alternate" hreflang="tr" href="${url(pagePath, 'tr')}" />`,
      `<link rel="alternate" hreflang="en" href="${canonical(pagePath, 'en')}" />`,
      `<link rel="alternate" hreflang="x-default" href="${url(pagePath)}" />`,
      '<meta property="og:type" content="website" />',
      '<meta property="og:site_name" content="flowdraft" />',
      `<meta property="og:title" content="${esc(meta.title)}" />`,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
      `<meta property="og:url" content="${pageUrl}" />`,
      `<meta property="og:image" content="${image}" />`,
      '<meta property="og:image:width" content="1920" />',
      '<meta property="og:image:height" content="1080" />',
      `<meta property="og:image:alt" content="${esc(lang === 'tr' ? 'flowdraft akış diyagramı editörü' : 'flowdraft flowchart editor')}" />`,
      `<meta property="og:locale" content="${lang === 'tr' ? 'tr_TR' : 'en_US'}" />`,
      `<meta property="og:locale:alternate" content="${other === 'tr' ? 'tr_TR' : 'en_US'}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${esc(meta.title)}" />`,
      `<meta name="twitter:description" content="${esc(meta.description)}" />`,
      `<meta name="twitter:image" content="${image}" />`,
      `<script type="application/ld+json">${jsonLd(pagePath, lang, meta, pageUrl)}</script>`,
    );
    if (pagePath === '/') {
      // Without JavaScript the empty editor would push the landing section a whole screen down.
      tags.push('<noscript><style>#root{display:none}</style></noscript>', `<style>${HOME_CSS}</style>`);
    }
    return tags.join('\n    ');
  }

  /** Links in the page's language: app pages get ?lang= (guide pages have their own path per language). */
  function localHref(url, lang) {
    if (!url.startsWith('/')) return url;
    const [, target, query = '', hash = ''] = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(url);
    if (!(target === '/' || Object.hasOwn(pages, target)) || /[?&]lang=/.test(query)) return url;
    return `${target}${query ? `${query}&` : '?'}lang=${lang}${hash}`;
  }

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

  function homeBlock(block, lang) {
    if (block.p !== undefined) return `<p>${inline(block.p, lang)}</p>`;
    if (block.ul !== undefined) return `<ul>${block.ul.map((i) => `<li>${inline(i, lang)}</li>`).join('')}</ul>`;
    if (block.steps !== undefined) {
      return `<ol class="fd-home-steps">${block.steps.map((i) => `<li>${inline(i, lang)}</li>`).join('')}</ol>`;
    }
    if (block.features !== undefined) {
      return `<ul class="fd-home-features">${features[lang].map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;
    }
    if (block.links !== undefined) {
      const cards = block.links.map(
        (l) => `<li><a href="${esc(localHref(l.href, lang))}"><strong>${esc(l.title)}</strong><span>${esc(l.text)}</span></a></li>`,
      );
      return `<ul class="fd-home-cards">${cards.join('')}</ul>`;
    }
    const fig = guides?.figure(lang, block.figure);
    if (!fig) return '';
    const srcset = fig.srcset ? ` srcset="${fig.srcset}" sizes="(max-width: 1032px) calc(100vw - 32px), 1000px"` : '';
    return (
      `<figure class="fd-home-figure is-wide"><a class="fd-home-frame" href="${fig.src}">` +
      `<img src="${fig.src}"${srcset} width="${fig.width}" height="${fig.height}" alt="${esc(fig.title)}" loading="lazy" decoding="async"></a>` +
      `<figcaption><strong>${esc(fig.title)}</strong> ${inline(fig.caption, lang)} ` +
      `<a rel="nofollow" href="${esc(fig.open)}">${esc(fig.openText)} <span aria-hidden="true">↗</span></a></figcaption></figure>`
    );
  }

  const landings = new Map();

  /**
   * The home page's landing section, below the editor: plain HTML outside #root, so React leaves it alone and it is
   * there both before and after the app starts. Built once per language (its example picture is drawn on first use).
   */
  function landing(lang) {
    if (landings.has(lang)) return landings.get(lang);
    const h = home[lang];
    const other = lang === 'tr' ? 'en' : 'tr';
    const sections = h.sections.map((s) => {
      // Text is kept to a reading width block by block, so a section can also hold a wider picture.
      const blocks = s.blocks.map((b) => homeBlock(b, lang)).join('');
      return `<section class="fd-home-section" id="${s.id}" aria-labelledby="${s.id}-h"><h2 id="${s.id}-h">${esc(s.h2)}</h2>${blocks}</section>`;
    });
    const faqHtml =
      `<section class="fd-home-section fd-home-faq" id="faq" aria-labelledby="faq-h"><h2 id="faq-h">${esc(h.faqTitle)}</h2>` +
      homeFaq(lang)
        .map((f) => `<details><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`)
        .join('') +
      '</section>';
    const guideLinks = (guides?.nav(lang) ?? []).map((g) => `<li><a href="${g.path}">${esc(g.name)}</a></li>`).join('');
    const footLinks = (paths) => paths.map((p) => `<li><a href="${p}?lang=${lang}">${esc(h.foot.links[p])}</a></li>`).join('');
    const html =
      `<section class="fd-home" aria-labelledby="fd-home-h">` +
      '<div class="fd-home-in">' +
      '<header class="fd-home-hero">' +
      `<p class="fd-home-kicker">${esc(h.kicker)}</p>` +
      `<h1 id="fd-home-h">${esc(h.h1)}</h1>` +
      `<p class="fd-home-lead">${inline(h.lead, lang)}</p>` +
      `<noscript><p class="fd-home-noscript">${esc(h.noscript)}</p></noscript>` +
      `<ul class="fd-home-facts">${h.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` +
      '<p class="fd-home-actions">' +
      `<a class="fd-home-btn is-primary" href="#root">${esc(h.start)} <span aria-hidden="true">↑</span></a>` +
      `<a class="fd-home-btn" href="${esc(localHref(h.more.href, lang))}">${esc(h.more.text)} <span aria-hidden="true">→</span></a>` +
      '</p></header>' +
      sections.join('') +
      faqHtml +
      '</div>' +
      '<footer class="fd-home-foot"><div class="fd-home-foot-in">' +
      `<div><p class="fd-home-brand">flowdraft</p><p>${esc(h.foot.tagline)}</p></div>` +
      `<nav aria-label="${esc(h.foot.guides)}"><h2>${esc(h.foot.guides)}</h2><ul>${guideLinks}</ul></nav>` +
      `<nav aria-label="${esc(h.foot.product)}"><h2>${esc(h.foot.product)}</h2><ul>${footLinks(['/tanitim', '/mcp', '/destek'])}</ul></nav>` +
      `<nav aria-label="${esc(h.foot.legal)}"><h2>${esc(h.foot.legal)}</h2><ul>${footLinks(['/gizlilik', '/kullanim-sartlari'])}` +
      `<li><a href="/?lang=${other}" hreflang="${other}" lang="${other}">${esc(h.foot.other)}</a></li></ul></nav>` +
      '</div></footer>' +
      '</section>';
    landings.set(lang, html);
    return html;
  }

  // Plain text version of the page for crawlers that don't run JavaScript (most AI crawlers).
  function body(pagePath, lang) {
    if (pagePath === '/') return landing(lang);
    const tr = lang === 'tr';
    const meta = (pages[pagePath] ?? pages['/'])[lang];
    const parts = [
      `<h1>${esc(meta.title)}</h1>`,
      `<p>${esc(meta.description)}</p>`,
      `<p>${tr ? 'flowdraft için JavaScript gerekir.' : 'flowdraft needs JavaScript.'}</p>`,
    ];
    if (pagePath === '/tanitim') {
      parts.push(
        `<h2>${tr ? 'Özellikler' : 'Features'}</h2>`,
        `<ul>${features[lang].map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`,
        `<h2>${tr ? 'Sık sorulan sorular' : 'Frequently asked questions'}</h2>`,
        faq.map((item) => `<h3>${esc(item.q[lang])}</h3><p>${esc(item.a[lang])}</p>`).join(''),
      );
    }
    const links = Object.keys(pages)
      .filter((p) => p !== pagePath)
      .map((p) => `<li><a href="${p}">${esc(pages[p][lang].title)}</a></li>`)
      .join('');
    const guideLinks = (guides?.nav(lang) ?? []).map((g) => `<li><a href="${g.path}">${esc(g.title)}</a></li>`).join('');
    parts.push(`<nav><ul>${links}${guideLinks}</ul></nav>`);
    return `<noscript>\n      <main class="fd-noscript">${parts.join('')}</main>\n    </noscript>`;
  }

  // Sitemap entries: each SPA page's canonical URLs (plain = English, ?lang=tr), then each guide page once per language.
  function entries() {
    const own = Object.entries(pages).flatMap(([pagePath, page]) => {
      const alternates = { tr: canonical(pagePath, 'tr'), en: canonical(pagePath, 'en'), 'x-default': url(pagePath) };
      return ['en', 'tr'].map((lang) => ({ loc: canonical(pagePath, lang), alternates, lastmod: page.updated, priority: page.priority }));
    });
    return [...own, ...(guides?.sitemapEntries() ?? [])];
  }

  return {
    /** The app shell for a page request, with that page's head and noscript text filled in. */
    render(req) {
      const pagePath = req.path.length > 1 ? req.path.replace(/\/+$/, '') : '/';
      const indexable = Object.hasOwn(pages, pagePath);
      const { lang, explicit } = pickLang(req);
      const html = shell
        .replace(/<html lang="[^"]*"/, `<html lang="${lang}"`)
        .replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head(pagePath, lang, explicit, indexable))
        .replace(/<!--seo:body-->[\s\S]*?<!--\/seo:body-->/, body(pagePath, lang));
      return { html, varies: !explicit };
    },

    sitemap() {
      const lines = entries().map(({ loc, alternates, lastmod, priority }) => {
        const links = Object.entries(alternates)
          .map(([lang, href]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${esc(href)}"/>`)
          .join('');
        return `<url><loc>${esc(loc)}</loc>${links}<lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
      });
      return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
        lines.join('\n') +
        '\n</urlset>\n'
      );
    },

    /** Every sitemap entry: { loc, alternates, lastmod, priority } (IndexNow submissions pick the recent ones). */
    entries,
  };
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const LINK = /\[([^\]\n]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g;
const HOME_BLOCKS = ['p', 'ul', 'steps', 'features', 'links', 'figure'];

function bold(html) {
  return html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Checks seo/home.json the way the landing section uses it: both languages, known block types, and internal links that
 * point at an existing page in the same language (app pages, or guide pages of that language). Returns the problems.
 */
function checkHome(home, { pages, guides }) {
  const errors = [];
  const str = (v) => typeof v === 'string' && v.trim() !== '';
  for (const lang of ['tr', 'en']) {
    const h = home[lang];
    const at = (where) => `${lang} ${where}`;
    if (!h || typeof h !== 'object') {
      errors.push(`"${lang}" is missing`);
      continue;
    }
    const link = (url, where) => {
      if (!url.startsWith('/')) return;
      const target = url.split(/[?#]/)[0];
      if (target === '/' || Object.hasOwn(pages, target)) return;
      const pageLang = guides?.langOf(target);
      if (!pageLang) errors.push(at(`${where}: link to unknown page ${url}`));
      else if (pageLang !== lang) errors.push(at(`${where}: link ${url} goes to the ${pageLang.toUpperCase()} page`));
    };
    const text = (v, where) => {
      if (!str(v)) return errors.push(at(`${where} must be a non-empty string`));
      for (const m of v.matchAll(LINK)) link(m[2], where);
    };
    for (const key of ['kicker', 'h1', 'lead', 'start', 'noscript', 'faqTitle']) text(h[key], key);
    if (!Array.isArray(h.facts) || !h.facts.every(str)) errors.push(at('"facts" must be an array of strings'));
    text(h.more?.text, 'more.text');
    if (str(h.more?.href)) link(h.more.href, 'more.href');
    else errors.push(at('"more.href" is missing'));
    const ids = new Set(['faq', 'fd-home-h']);
    (Array.isArray(h.sections) ? h.sections : []).forEach((s, i) => {
      const where = `section ${i + 1}`;
      if (!str(s?.h2)) errors.push(at(`${where} needs "h2"`));
      if (!str(s?.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id) || ids.has(s.id)) errors.push(at(`${where} needs a unique kebab-case "id"`));
      else ids.add(s.id);
      (Array.isArray(s?.blocks) ? s.blocks : []).forEach((b, j) => {
        const keys = b && typeof b === 'object' ? Object.keys(b) : [];
        const bw = `${where} block ${j + 1}`;
        if (keys.length !== 1 || !HOME_BLOCKS.includes(keys[0])) return errors.push(at(`${bw} must be one of ${HOME_BLOCKS.join(', ')}`));
        const v = b[keys[0]];
        if (keys[0] === 'p') text(v, bw);
        else if (keys[0] === 'ul' || keys[0] === 'steps') {
          if (!Array.isArray(v) || !v.length) errors.push(at(`${bw} must be a non-empty array`));
          else v.forEach((item) => text(item, bw));
        } else if (keys[0] === 'links') {
          if (!Array.isArray(v) || !v.length) return errors.push(at(`${bw} must be a non-empty array`));
          v.forEach((l) => {
            if (![l?.href, l?.title, l?.text].every(str)) errors.push(at(`${bw} links need "href", "title" and "text"`));
            else link(l.href, bw);
          });
        } else if (keys[0] === 'figure' && guides && !guides.hasExample(v)) errors.push(at(`${bw}: unknown example "${v}"`));
      });
    });
    if (!Array.isArray(h.faq) || !h.faq.every((f) => str(f?.q) && str(f?.a))) errors.push(at('"faq" needs "q" and "a" strings'));
    const foot = h.foot ?? {};
    for (const key of ['guides', 'product', 'legal', 'tagline', 'other']) if (!str(foot[key])) errors.push(at(`foot.${key} is missing`));
    for (const p of ['/tanitim', '/mcp', '/destek', '/gizlilik', '/kullanim-sartlari']) {
      if (!str(foot.links?.[p])) errors.push(at(`foot.links["${p}"] is missing`));
    }
  }
  return errors;
}

// The landing section on the home page, under the editor. It uses the app's theme variables (src/styles.css), so it
// follows the light/dark choice. Hidden when flowdraft runs as an installed app, where it would only be in the way.
const HOME_CSS = `
.fd-home{border-top:1px solid var(--line);background:var(--bg);color:var(--text);font:16.5px/1.65 var(--font-sans);overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
.fd-home *,.fd-home *::before,.fd-home *::after{box-sizing:border-box}
.fd-home a{color:var(--accent-text);text-underline-offset:.18em;text-decoration-thickness:1px}
.fd-home a:hover{text-decoration-thickness:2px}
.fd-home-in{padding:clamp(40px,7vw,72px) 16px 8px}
.fd-home-hero,.fd-home-section>*{max-width:760px;margin-left:auto;margin-right:auto}
.fd-home-section>.is-wide{max-width:1000px}
.fd-home-kicker{margin:0 0 12px;font:600 12.5px/1 var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.fd-home h1{margin-top:0;margin-bottom:16px;font-size:clamp(32px,6vw,50px);line-height:1.08;letter-spacing:-.028em;font-weight:750;text-wrap:balance}
.fd-home-lead{margin-top:0;margin-bottom:20px;font-size:clamp(17.5px,2.3vw,20px);line-height:1.6;color:var(--text-2);text-wrap:pretty}
.fd-home-facts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px;padding:0;list-style:none}
.fd-home-facts li{display:inline-flex;align-items:center;gap:8px;margin:0;padding:5px 12px;border:1px solid var(--line-2);border-radius:999px;font-size:14px;line-height:1.3;color:var(--text-2)}
.fd-home-facts li::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--accent)}
.fd-home-actions{display:flex;flex-wrap:wrap;gap:10px;margin:0}
.fd-home a.fd-home-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:10px 18px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);color:var(--text);font:600 15px/1.2 var(--font-sans);text-decoration:none;white-space:nowrap;transition:background-color .15s,border-color .15s}
.fd-home a.fd-home-btn:hover{border-color:var(--hover-border)}
.fd-home a.fd-home-btn.is-primary{background:#d63c42;border-color:#d63c42;color:#fff}
.fd-home a.fd-home-btn.is-primary:hover{background:#c4323a;border-color:#c4323a}
.fd-home h2{margin-top:56px;margin-bottom:14px;font-size:clamp(24px,3.4vw,30px);line-height:1.2;letter-spacing:-.018em;font-weight:720;text-wrap:balance}
.fd-home-section>p{margin-top:0;margin-bottom:16px;text-wrap:pretty}
.fd-home-section>ul,.fd-home-section>ol{margin-top:0;margin-bottom:18px;padding-left:1.35em}
.fd-home-section li{margin:0 0 8px}
.fd-home-section li::marker{color:var(--text-3)}
.fd-home strong{font-weight:650;color:var(--text)}
.fd-home-section>.fd-home-steps{display:grid;gap:10px;padding:0;list-style:none;counter-reset:step}
.fd-home-steps>li{counter-increment:step;position:relative;margin:0;padding:14px 16px 14px 58px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.fd-home-steps>li::before{content:counter(step);position:absolute;left:16px;top:14px;width:28px;height:28px;border-radius:50%;background:var(--accent-soft);color:var(--accent-text);font:600 14px/28px var(--font-mono);text-align:center}
.fd-home-section>.fd-home-features{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:10px 28px;padding:0;list-style:none}
.fd-home-features>li{position:relative;margin:0;padding-left:26px;color:var(--text-2)}
.fd-home-features>li::before{content:'';position:absolute;left:3px;top:.5em;width:12px;height:7px;border-left:2px solid var(--accent);border-bottom:2px solid var(--accent);transform:rotate(-45deg)}
.fd-home-figure{margin-top:12px;margin-bottom:8px}
.fd-home a.fd-home-frame{display:block;padding:clamp(8px,2vw,16px);border:1px solid var(--line);border-radius:16px;background:#f5f5f3}
.fd-home-frame img{display:block;width:100%;height:auto;border-radius:6px}
.fd-home-figure figcaption{max-width:740px;margin:12px auto 0;font-size:15px;line-height:1.6;color:var(--text-2);text-align:center}
.fd-home-figure figcaption strong{display:block}
.fd-home-section>.fd-home-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px;padding:0;list-style:none}
.fd-home-cards>li{margin:0}
.fd-home-cards a{display:flex;flex-direction:column;gap:4px;height:100%;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--text-2);text-decoration:none;transition:border-color .15s}
.fd-home-cards a:hover{border-color:var(--hover-border)}
.fd-home-cards a strong{color:var(--accent-text);font-size:17px;line-height:1.35}
.fd-home-cards a span{font-size:15px;line-height:1.55}
.fd-home-faq details{border-bottom:1px solid var(--line)}
.fd-home-faq details:first-of-type{border-top:1px solid var(--line)}
.fd-home-faq summary{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 2px;cursor:pointer;list-style:none}
.fd-home-faq summary::-webkit-details-marker{display:none}
.fd-home-faq summary::after{content:'+';flex:none;width:28px;height:28px;border-radius:50%;border:1px solid var(--line-2);display:grid;place-items:center;font-size:18px;line-height:1;color:var(--text-2);transition:transform .2s}
.fd-home-faq details[open] summary::after{transform:rotate(45deg)}
.fd-home-faq summary h3{margin:0;font-size:17px;line-height:1.4;font-weight:650}
.fd-home-faq details p{margin:0 0 18px;color:var(--text-2)}
.fd-home-noscript{margin:0 0 20px;padding:12px 16px;border:1px solid var(--accent-line);border-radius:10px;background:var(--accent-soft)}
.fd-home-foot{margin-top:56px;padding:32px 16px 28px;border-top:1px solid var(--line);font-size:15px;color:var(--text-2)}
.fd-home-foot-in{max-width:1000px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:24px}
.fd-home-foot h2{margin:0 0 10px;font:600 12px/1.4 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.fd-home-foot ul{list-style:none;margin:0;padding:0}
.fd-home-foot li{margin:0 0 6px}
.fd-home-foot a{color:var(--text-2);text-decoration:none}
.fd-home-foot a:hover{color:var(--text);text-decoration:underline}
.fd-home-foot p{margin:6px 0 0;color:var(--text-3)}
.fd-home-foot .fd-home-brand{margin:0;color:var(--text);font-weight:700;font-size:17px}
.fd-modal,.fd-icon-grid{overscroll-behavior:contain}
.fd-mobilebar{touch-action:none}
@media (display-mode:standalone){.fd-home{display:none}}
@media (prefers-reduced-motion:reduce){.fd-home *{transition:none}}
`
  .trim()
  .replace(/\n/g, '');
