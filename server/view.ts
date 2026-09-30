/**
 * MCP Apps view (ui://flowdraft/diagram.html): shows the PNG a diagram tool returned right in the chat, in Claude,
 * ChatGPT and other hosts that support MCP Apps. The model gets the same PNG in the tool result either way.
 *
 * Kept dependency-free: the host renders it in a sandboxed iframe and talks to it over postMessage with JSON-RPC
 * (ui/initialize → ui/notifications/initialized, then ui/notifications/tool-result with the CallToolResult).
 */

export const VIEW_URI = 'ui://flowdraft/diagram.html';
export const VIEW_MIME = 'text/html;profile=mcp-app';

const script = String.raw`
(() => {
  const root = document.getElementById('root');
  const pending = new Map();
  let nextId = 1;
  let tr = (navigator.language || '').toLowerCase().startsWith('tr');
  let last = null;

  const send = (msg) => window.parent.postMessage(msg, '*');
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params });
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ jsonrpc: '2.0', id, method, params });
    });

  // Follow the chat's light or dark theme; the picture itself always has its own light background.
  const applyContext = (ctx) => {
    if (!ctx) return;
    if (ctx.theme === 'dark' || ctx.theme === 'light') document.documentElement.style.colorScheme = ctx.theme;
    if (ctx.locale) tr = String(ctx.locale).toLowerCase().startsWith('tr');
  };

  const resize = () =>
    notify('ui/notifications/size-changed', { height: Math.ceil(document.documentElement.getBoundingClientRect().height) });

  function render(result) {
    last = result;
    const content = (result && result.content) || [];
    const image = content.find((c) => c.type === 'image');
    const text = content.find((c) => c.type === 'text');
    let info = {};
    try {
      info = JSON.parse((text && text.text) || '{}');
    } catch (e) {}
    root.textContent = '';
    if (!image) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = result && result.isError && text ? text.text : tr ? 'Bu akış boş.' : 'This flow is empty.';
      root.append(p);
      resize();
      return;
    }
    const img = new Image();
    img.alt = info.title || 'flowdraft';
    img.src = 'data:' + image.mimeType + ';base64,' + image.data;
    img.onload = resize;
    const bar = document.createElement('div');
    bar.className = 'bar';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = info.title || 'flowdraft';
    bar.append(title);
    if (info.url) {
      const open = document.createElement('button');
      open.type = 'button';
      open.textContent = tr ? 'flowdraft’ta aç ↗' : 'Open in flowdraft ↗';
      open.onclick = () => request('ui/open-link', { url: info.url }).catch(() => window.open(info.url, '_blank', 'noopener'));
      bar.append(open);
    }
    root.append(img, bar);
    resize();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id != null && !msg.method) {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.error) p.reject(msg.error);
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'ui/notifications/tool-result') render(msg.params);
    else if (msg.method === 'ui/notifications/host-context-changed') {
      applyContext(msg.params);
      if (last) render(last);
    } else if (msg.id != null && msg.method) {
      // ping, ui/resource-teardown and anything else the host asks: nothing to clean up, just acknowledge.
      send({ jsonrpc: '2.0', id: msg.id, result: {} });
    }
  });

  request('ui/initialize', {
    appInfo: { name: 'flowdraft', version: '1.0.0' },
    appCapabilities: { availableDisplayModes: ['inline'] },
    protocolVersion: '2026-01-26',
  })
    .then((res) => {
      applyContext(res && res.hostContext);
      notify('ui/notifications/initialized', {});
    })
    .catch(() => {});
  new ResizeObserver(resize).observe(document.body);
})();
`;

export const VIEW_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>flowdraft</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; background: transparent; color: CanvasText; font: 13px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  #root { display: grid; gap: 8px; }
  img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid rgba(127, 127, 127, 0.28); background: #f5f5f3; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; }
  .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button { flex: none; font: inherit; padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(127, 127, 127, 0.4); background: transparent; color: inherit; cursor: pointer; }
  button:hover { background: rgba(127, 127, 127, 0.12); }
  .muted { margin: 0; opacity: 0.7; }
</style>
</head>
<body>
<div id="root"><p class="muted">flowdraft…</p></div>
<script>${script}</script>
</body>
</html>`;
