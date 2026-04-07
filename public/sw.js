
const CACHE_NAME = 'loftdesk-v61';
const SUPABASE_CACHE = 'loftdesk-api-v61';
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
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== SUPABASE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── helpers ──────────────────────────────────────────────── */
function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|png|jpe?g|svg|webp|ico|webmanifest)(\?.*)?$/i.test(url.pathname);
}

function isSupabaseGet(url) {
  // Supabase REST GET — safe to cache (SELECT queries, not mutations)
  return url.hostname.includes('.supabase.co') &&
    url.pathname.startsWith('/rest/v1/');
}

function shouldIgnore(url) {
  // Netlify functions / API routes — network-only (mutations, AI, etc.)
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/.netlify/') || url.pathname.startsWith('/api/')) return true;
    return false;
  }
  // Allow Supabase GETs through (handled separately below)
  if (url.hostname.includes('.supabase.co')) return false;
  // All other cross-origin requests: ignore
  return true;
}

/* ── fetch strategy ───────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept ignored origins/paths
  if (shouldIgnore(url)) return;

  // Supabase REST GET: stale-while-revalidate with 5-min TTL
  // Allows offline browsing of cached projects, estimates, expenses
  if (isSupabaseGet(url)) {
    event.respondWith(
      caches.open(SUPABASE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetched = fetch(event.request).then((response) => {
            if (response.ok) {
              // Clone and cache with 5-min max-age header
              const copy = response.clone();
              cache.put(event.request, copy).catch(() => {});
            }
            return response;
          }).catch(() => cached || new Response('{"error":"offline"}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }));
          // Return cached immediately if available, refresh in background
          return cached || fetched;
        })
      )
    );
    return;
  }

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

  // Everything else (local JSON, etc.): network-only, no fallback
});
