
const CACHE_NAME = 'loftdesk-v60';
const OFFLINE_URLS = ['/', '/manifest.webmanifest'];

/* ── install: pre-cache shell ─────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── activate: remove old caches ──────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── helpers ──────────────────────────────────────────────── */
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|png|jpe?g|svg|webp|ico|webmanifest)(\?.*)?$/i.test(url.pathname);
}

function shouldIgnore(url) {
  // External origins (Stripe, Supabase, KSeF etc.)
  if (url.origin !== self.location.origin) return true;
  // Netlify functions / API routes
  if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) return true;
  return false;
}

/* ── fetch strategy ───────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept cross-origin or API requests
  if (shouldIgnore(url)) return;

  // Static assets: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          return response;
        }).catch(() => cached);       // offline → return stale copy or nothing
        return cached || fetched;
      })
    );
    return;
  }

  // Navigation requests (HTML pages): network-first, offline fallback to shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('/')))
    );
    return;
  }

  // Everything else (JSON, etc.): network-only, no fallback
});
