// Two-tier Service Worker for Daniel's Board Games:
// 1) SHELL_CACHE (< 45 KB): instant install on first visit, never blocks on 4.7 MB of games.
// 2) GAMES_CACHE (persistent): auto-caches any game as you play, plus supports on-demand batch download
//    without ever wiping already-downloaded game artwork when hub UI updates.
importScripts('./assets/offline-manifest.js');

const { SHELL_CACHE, GAMES_CACHE, SHELL_FILES } = self.OFFLINE_MANIFEST;
const KEEP_CACHES = new Set([SHELL_CACHE, GAMES_CACHE]);
const IMMUTABLE_MEDIA_RE = /\.(webp|png|jpg|jpeg|gif|svg|ico|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_FILES.map((url) =>
            fetch(url, { cache: 'no-cache' })
              .then((res) => (res.ok ? cache.put(url, res) : null))
              .catch(() => null),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP_CACHES.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function notifyClients(message) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of list) {
    client.postMessage(message);
  }
}

function responseChanged(prev, next) {
  if (!prev || !next) return false;
  const e1 = prev.headers.get('etag');
  const e2 = next.headers.get('etag');
  if (e1 && e2) return e1 !== e2;
  const lm1 = prev.headers.get('last-modified');
  const lm2 = next.headers.get('last-modified');
  if (lm1 && lm2) return lm1 !== lm2;
  const cl1 = prev.headers.get('content-length');
  const cl2 = next.headers.get('content-length');
  if (cl1 && cl2) return cl1 !== cl2;
  return false;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const scopeUrl = new URL('./', self.registration.scope);

  const isHubRoot = url.pathname === scopeUrl.pathname || url.pathname === new URL('./index.html', scopeUrl).pathname;
  const isNav = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');

  // Immutable media assets: Cache-First in GAMES_CACHE / SHELL_CACHE
  if (IMMUTABLE_MEDIA_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(GAMES_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      }),
    );
    return;
  }

  // HTML navigations & JS/CSS/data: Stale-While-Revalidate (instant paint + silent background update!)
  const targetCacheName = isHubRoot || url.pathname.includes('/assets/offline-manifest.js') ? SHELL_CACHE : GAMES_CACHE;

  event.respondWith(
    (async () => {
      const cached =
        (await caches.match(req)) ||
        (url.pathname.endsWith('/index.html')
          ? await caches.match(new URL('./', req.url).href)
          : url.pathname.endsWith('/')
            ? await caches.match(new URL('./index.html', req.url).href)
            : null);
      const networkPromise = fetch(req, { cache: 'no-cache' })
        .then(async (res) => {
          if (res.ok) {
            const changed = isHubRoot && cached && responseChanged(cached, res);
            const cache = await caches.open(targetCacheName);
            await cache.put(req, res.clone());
            if (isHubRoot) {
              await cache.put(scopeUrl.href, res.clone());
              await cache.put(new URL('./index.html', scopeUrl).href, res.clone());
            } else if (url.pathname.endsWith('/index.html')) {
              await cache.put(new URL('./', req.url).href, res.clone());
            }
            if (changed) {
              notifyClients({ type: 'HUB_UPDATE_READY' });
            }
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        event.waitUntil(networkPromise);
        return cached;
      }

      const fresh = await networkPromise;
      if (fresh) return fresh;
      if (isNav) {
        return (await caches.match(new URL('./index.html', scopeUrl).href)) || new Response('离线不可用', { status: 503 });
      }
      return new Response('Offline', { status: 503 });
    })(),
  );
});
