/* Timestamp Portal SW – minimal “app shell” cache with instant-update */
const SW_VERSION = 'v1.0.1';
const SHELL_CACHE = `shell-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

// Keep this list light; hashed build assets are handled at runtime (SWR)
const SHELL_FILES = [
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

// Support "instant update" from the page
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_FILES))
  );
  // Don't wait for old workers to die; we'll swap in activate
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      // Become the active SW immediately
      await self.clients.claim();
    })()
  );
});

// Network strategy:
// - Navigations: network-first; fallback to cached index.html when offline
// - Static assets: stale-while-revalidate (cache first, then update in bg)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML navigations
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const cached = await cache.match('/index.html');
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets → stale-while-revalidate
  const isStatic = /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);

        // return cached immediately, update in background if possible
        return cached || networkPromise || Response.error();
      })()
    );
  }
});
