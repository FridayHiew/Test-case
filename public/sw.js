const CACHE_NAME = 'ai-testgen-cache-v3';
const STATIC_ASSETS = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching base PWA assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Service Worker: purge all stale caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Purging stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never intercept non-GET requests or backend/external APIs
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/@') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname.includes('api.openai.com') ||
    url.hostname.includes('api.deepseek.com')
  ) {
    return;
  }

  // 1. Navigation / HTML Document requests: NETWORK-FIRST
  // Guarantees users always see the latest build without blank screens from stale hashes
  const isNavOrHtml = req.mode === 'navigate' || 
                      req.destination === 'document' || 
                      req.headers.get('accept')?.includes('text/html');

  if (isNavOrHtml) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Fallback to cached index.html when offline
          const cached = await caches.match(req);
          if (cached) return cached;
          const cachedIndex = await caches.match('./index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await caches.match('./');
          if (cachedRoot) return cachedRoot;
          return new Response('Application is offline. Please reconnect to load the latest version.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, images, icons): STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, rely on cache
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
