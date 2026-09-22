const CACHE_NAME = 'daniel-board-games-v1';
const PRECACHE = [
  './',
  './assets/icon.svg',
  './games/fake-artist-new-york/data/words.js',
  './games/fake-artist-new-york/index.html',
  './games/fake-painter/app.js',
  './games/fake-painter/assets/cards/card_001.svg',
  './games/fake-painter/assets/cards/card_001.webp',
  './games/fake-painter/assets/cards/card_002.svg',
  './games/fake-painter/assets/cards/card_002.webp',
  './games/fake-painter/assets/cards/card_003.svg',
  './games/fake-painter/assets/cards/card_003.webp',
  './games/fake-painter/assets/cards/card_004.svg',
  './games/fake-painter/assets/cards/card_004.webp',
  './games/fake-painter/assets/cards/card_005.svg',
  './games/fake-painter/assets/cards/card_005.webp',
  './games/fake-painter/assets/cards/card_006.webp',
  './games/fake-painter/assets/cards/card_007.webp',
  './games/fake-painter/assets/cards/card_008.webp',
  './games/fake-painter/assets/cards/card_009.webp',
  './games/fake-painter/assets/cards/card_010.webp',
  './games/fake-painter/assets/cards/card_011.webp',
  './games/fake-painter/assets/cards/card_012.webp',
  './games/fake-painter/data/cards_batch_template.json',
  './games/fake-painter/data/cards.js',
  './games/fake-painter/data/cards.json',
  './games/fake-painter/discard.css',
  './games/fake-painter/fullscreen.css',
  './games/fake-painter/index.html',
  './games/fake-painter/responsive.css',
  './games/fake-painter/scripts/import-cards.js',
  './games/fake-painter/scripts/validate-cards.js',
  './games/fake-painter/styles.css',
  './games/pick-one-for-me/app.js',
  './games/pick-one-for-me/feedback.css',
  './games/pick-one-for-me/index.html',
  './games/pick-one-for-me/styles.css',
  './games/spyfall/app.js',
  './games/spyfall/index.html',
  './games/spyfall/styles.css',
  './games/werewords-companion/group.png',
  './games/werewords-companion/index.html',
  './games/werewords-companion/reward.png',
  './games/werewords-companion/werewords.css',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match('./index.html'))));
});
