// World Cup 2026 — Service Worker
// Caches the app shell on install and serves from cache when offline.

const CACHE_NAME = 'wc2026-v1';

// App shell assets to cache on install.
// Vite hashes JS/CSS bundles, so we cache the root HTML and let the
// browser use the standard caching headers for the hashed assets once
// they've been fetched at runtime (they'll land in the browser's HTTP cache
// automatically). The key thing is the offline fallback for navigation requests.
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
];

// ---------------------------------------------------------------------------
// Install — pre-cache app shell
// ---------------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Take over immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Activate — delete old caches
// ---------------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---------------------------------------------------------------------------
// Fetch — network-first for API calls, cache-first for assets
// ---------------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin API calls
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.pathname.startsWith('/api/')) return;

  // API calls: network only (live scores must always be fresh)
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests (page loads) — network first, fall back to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() =>
          caches.match('/').then((cached) => cached ?? new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // Static assets — stale-while-revalidate: serve from cache instantly,
  // update cache in background
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);

      return cached ?? (await fetchPromise) ?? new Response('Offline', { status: 503 });
    })
  );
});
