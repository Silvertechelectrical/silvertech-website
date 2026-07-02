const CACHE_NAME = 'silvertech-cache-v3';
const BASE_PATH = self.location.pathname.replace(/\/[^/]*$/, '') || '/';
const normalize = (path) => (BASE_PATH.endsWith('/') ? `${BASE_PATH}${path.replace(/^[\/]+/, '')}` : `${BASE_PATH}/${path.replace(/^[\/]+/, '')}`);
const ASSETS_TO_CACHE = [
  normalize('index.html'),
  normalize('manifest.json'),
  normalize('assets/css/style.css?v=20260702'),
  normalize('assets/img/silvertech_logo.ico'),
  normalize('assets/img/silverbackground.png'),
  normalize('assets/img/usablesilvertech.jpg'),
  normalize('js/load-firebase-config.js?v=20260702'),
  normalize('js/firebase-init.js?v=20260702'),
  normalize('js/auth-nav.js?v=20260702'),
  normalize('js/register-sw.js?v=20260702'),
  normalize('pages/services.html'),
  normalize('pages/shop.html'),
  normalize('pages/silverstore.html'),
  normalize('pages/login.html'),
  normalize('pages/store-browse.html'),
  normalize('pages/dashboard.html'),
  normalize('pages/admin.html'),
  normalize('pages/shop-management.html')
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.method !== 'GET') {
    return;
  }

  // Treat runtime firebase-config.js as network-first so clients get the latest config
  if (url.pathname.endsWith('/firebase-config.js') || url.pathname.endsWith('firebase-config.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      return response;
    })).catch(() => cached)
  );
});
