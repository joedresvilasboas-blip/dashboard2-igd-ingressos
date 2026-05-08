const CACHE_NAME = 'igd-v1';
const ASSETS = [
  '/dashboard-igd-ingressos/',
  '/dashboard-igd-ingressos/index.html',
  '/dashboard-igd-ingressos/css/app.css',
  '/dashboard-igd-ingressos/js/app.js',
  '/dashboard-igd-ingressos/js/auth.js',
  '/dashboard-igd-ingressos/js/api.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
