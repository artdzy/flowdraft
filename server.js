import express from 'express';
import compression from 'compression';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as mcp from './dist-server/mcp.js';
import { createGuides } from './seo/guides.js';
import { createSeo } from './seo.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT) || 3000;
// Guide pages draw their example diagrams with the MCP server's renderer (server/render.ts).
const guides = createGuides({ root, diagram: mcp });
const seo = createSeo({ root, dist, guides });

// IndexNow (Bing, Yandex, Seznam, …; ChatGPT search uses Bing): the key file is public/<key>.txt.
const INDEXNOW_KEY = 'fd2aea219dfb5b19398f8668ea208aef';
// Pages whose lastmod is within this window count as changed.
const RECENT = 3 * 24 * 60 * 60 * 1000;

const supabaseUrl = process.env.SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? '';
const runtimeConfig = `window.__FLOWDRAFT__=${JSON.stringify({ supabaseUrl, supabaseAnonKey })};`;

const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(compression());
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});

// One host for search engines: www.flowdraft.tech serves the same pages, so send it to flowdraft.tech for good.
app.use((req, res, next) => {
  if (!req.hostname.startsWith('www.')) return next();
  res.redirect(301, `https://${req.hostname.slice(4)}${req.originalUrl}`);
});

app.get('/healthz', (_req, res) => res.type('text/plain').send('ok'));

// MCP endpoint for ChatGPT, Claude and other AI clients (built from server/mcp.ts).
app.use(mcp.createMcpRouter({ supabaseUrl, supabaseAnonKey }));

app.get('/config.js', (_req, res) => {
  res.type('application/javascript').set('Cache-Control', 'no-store').send(runtimeConfig);
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(seo.sitemap());
});

// Guide pages (seo/guides) and their example diagrams, /ornekler/<lang>/<id>.png|json: plain HTML, no JavaScript.
app.use(guides.middleware);

// The shell is only served through seo.render, so the raw file never shows up as a duplicate page.
app.get('/index.html', (_req, res) => res.redirect(301, '/'));

app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', index: false }));
app.use(
  express.static(dist, {
    index: false,
    maxAge: 0,
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }),
);

app.get('/{*splat}', (req, res) => {
  // Missing files (favicon.ico, images, scripts) must 404, not receive the app shell.
  if (path.extname(req.path)) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }
  const { html, varies } = seo.render(req);
  if (varies) res.vary('Accept-Language');
  // public/sw.js keeps only responses marked as the app shell for offline use.
  res.set({ 'Cache-Control': 'no-cache', 'X-Flowdraft-Shell': '1' }).type('html').send(html);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`flowdraft listening on :${port}`);
  guides.warm();
  if (process.env.NODE_ENV === 'production' && process.env.INDEXNOW !== 'off') setTimeout(pingIndexNow, 15_000);
});

/**
 * Tells IndexNow search engines about pages changed in the last few days (their sitemap lastmod), so new and updated
 * pages get crawled soon. Unchanged pages are left out: resubmitting them on every restart gets a site throttled.
 * INDEXNOW=off turns it off.
 */
async function pingIndexNow() {
  try {
    const urlList = seo
      .entries()
      .filter((e) => Date.now() - Date.parse(e.lastmod) < RECENT)
      .map((e) => e.loc);
    if (!urlList.length) return;
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'flowdraft.tech',
        key: INDEXNOW_KEY,
        keyLocation: `https://flowdraft.tech/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
  } catch (err) {
    console.warn(`IndexNow failed: ${err instanceof Error ? err.message : err}`);
  }
}
