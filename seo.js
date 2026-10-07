import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Search engine and AI crawler support for the SPA shell: per-page title, description, canonical, hreflang,
 * Open Graph and JSON-LD in <head>, a <noscript> text version of the page for crawlers that don't run
 * JavaScript, and the sitemap. Page texts live in seo/pages.json (the promo page's FAQ reads it too).
 * The server-rendered guide pages (seo/guides.js) add their own entries to the sitemap and the <noscript> links.
 * Each page's "updated" date is its sitemap <lastmod>: change it only when the page's own text or links change, so
 * search engines can keep trusting it.
 */
export function createSeo({ root, dist, guides }) {
  const data = JSON.parse(readFileSync(path.join(root, 'seo/pages.json'), 'utf8'));
  const shell = readFileSync(path.join(dist, 'index.html'), 'utf8');
  const { origin, pages, features, faq } = data;
  const bad = Object.entries(pages)
    .filter(([, page]) => !/^\d{4}-\d{2}-\d{2}$/.test(page.updated ?? '') || Number.isNaN(Date.parse(page.updated)))
    .map(([pagePath]) => pagePath);
  if (bad.length) throw new Error(`seo/pages.json: "updated" must be a date like "2026-10-01" on ${bad.join(', ')}`);
  const image = origin + data.image;

  const url = (pagePath, lang) => origin + pagePath + (lang ? `?lang=${lang}` : '');
  // Google crawls without Accept-Language, so the plain URL is the English page to it; ?lang=en is the same page.
  // English is therefore canonical on the plain URL and only Turkish gets its own (?lang=tr).
  const canonical = (pagePath, lang) => url(pagePath, lang === 'tr' ? 'tr' : undefined);

  // Same rule as src/i18n.ts: an explicit ?lang= wins, else Turkish for Turkish browsers and English otherwise.
  function pickLang(req) {
    const asked = typeof req.query.lang === 'string' ? req.query.lang : '';
    if (asked === 'tr' || asked === 'en') return { lang: asked, explicit: true };
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
      graph.push(
        {
          '@type': 'VideoObject',
          name: meta.title,
          description: meta.description,
          thumbnailUrl: image,
          contentUrl: `${origin}/promo/flowdraft-16x9.mp4`,
          // Google wants a full datetime with a time zone here.
          uploadDate: '2026-09-25T12:00:00+03:00',
          duration: 'PT30S',
          inLanguage: 'en',
        },
        {
          '@type': 'FAQPage',
          mainEntity: faq.map((item) => ({
            '@type': 'Question',
            name: item.q[lang],
            acceptedAnswer: { '@type': 'Answer', text: item.a[lang] },
          })),
        },
      );
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
    return tags.join('\n    ');
  }

  // Plain text version of the page for crawlers that don't run JavaScript (most AI crawlers).
  function body(pagePath, lang) {
    const tr = lang === 'tr';
    const meta = (pages[pagePath] ?? pages['/'])[lang];
    const parts = [
      `<h1>${esc(meta.title)}</h1>`,
      `<p>${esc(meta.description)}</p>`,
      `<p>${tr ? 'flowdraft için JavaScript gerekir.' : 'flowdraft needs JavaScript.'}</p>`,
    ];
    if (pagePath === '/' || pagePath === '/tanitim') {
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
