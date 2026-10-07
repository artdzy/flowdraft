// flowdraft service worker: app shell available offline; network always wins when online.
const CACHE = 'flowdraft-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const old = (await caches.keys()).filter((k) => k !== CACHE);
      await seed(old);
      await Promise.all(old.map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Fills a new cache before the old ones are deleted, so a cache change never leaves the app without its offline copy
 * until the next online visit: a fresh app shell and config, and the hashed build files of the old caches (they never
 * change, unlike an old '/', which may not be the app shell).
 */
async function seed(oldCaches) {
  const cache = await caches.open(CACHE);
  for (const name of oldCaches) {
    const old = await caches.open(name);
    for (const request of await old.keys()) {
      if (!new URL(request.url).pathname.startsWith('/assets/') || (await cache.match(request))) continue;
      const res = await old.match(request);
      if (res) await cache.put(request, res);
    }
  }
  if (await cache.match('/')) return;
  try {
    const res = await fetch('/', { cache: 'no-store' });
    if (!res.ok || res.headers.get('X-Flowdraft-Shell') !== '1') return;
    const html = await res.clone().text();
    await cache.put('/', res);
    // The shell's own build files, in case the old caches didn't have them yet.
    const files = new Set(['/config.js', ...(html.match(/\/assets\/[^"'\s>]+/g) ?? [])]);
    await Promise.all([...files].map((f) => cache.add(new Request(f, { cache: 'no-store' })).catch(() => {})));
  } catch {
    // Offline while activating: the next online page load stores the shell.
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages and runtime config: network first, cached copy when offline.
  // Only the app shell (server.js marks it) may become the offline '/': guide pages, images and other files must not.
  if (request.mode === 'navigate' || url.pathname === '/config.js') {
    const key = request.mode === 'navigate' ? '/' : '/config.js';
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && (key !== '/' || res.headers.get('X-Flowdraft-Shell') === '1')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(key, copy));
          }
          return res;
        })
        .catch(() => caches.match(key).then((hit) => hit || Response.error())),
    );
  }
});
