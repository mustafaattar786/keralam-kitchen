/* Offline support: caches the app so it opens without internet. Bump VERSION after edits. */
const VERSION = 'kk-v1';
const SHELL = ['./', 'index.html', 'admin.html', 'styles.css', 'config.js', 'core.js', 'i18n.js', 'common.js', 'app.js', 'admin.js',
  'manifest.json', 'icon.svg', 'icon-192.png', 'img/batter.jpg', 'img/chutney.jpg', 'img/roti.jpg', 'img/garlic.jpg', 'img/menu-poster.jpg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // API calls go straight to network
  // network-first so updates show quickly; fall back to cache when offline
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
