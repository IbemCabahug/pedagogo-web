/* Pedagogo Desk service worker — offline-first app shell (zero deps, calm updates). */
/* F5 (10-persona audit): the build injects two values below —
   __PRECACHE_BUILD    per-deploy stamp → cache name rotates per deploy, so the
                       activate step purges superseded hashed assets.
   __PRECACHE_MANIFEST every emitted file → one install seeds the FULL offline
                       Desk (the Jhocel case: one data spend on school Wi-Fi,
                       near-zero after). Empty in dev — public/sw.js served raw. */
const CACHE_NAME = 'pedagogo-desk-v2-' + (self.__PRECACHE_BUILD || 'dev');
const APP_SHELL = ['./index.html', './manifest.webmanifest'];

self.__PRECACHE_BUILD = '';
self.__PRECACHE_MANIFEST = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Core shell is mandatory; every precached asset is best-effort — one
      // flaky file must never break offline for the whole Desk.
      await cache.addAll(APP_SHELL);
      await Promise.all((self.__PRECACHE_MANIFEST || [])
        .filter((f) => !APP_SHELL.includes(f))
        .map(async (f) => {
          try {
            if (await cache.match(f)) return; // already cached (e.g. by SWR) — skip, save data
            await cache.add(f);
          } catch (e) { /* skip on failure */ }
        }));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only handle same-origin (keeps Gemini / Fonts / PeerJS live on network).
  if (url.origin !== self.location.origin) return;
  // Navigations: network first, fall back to cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  // Hashed build assets (/assets/) are immutable: cache-first, NO background
  // refetch. The old SWR revalidated every bundle on every visit — a silent
  // data drain for prepaid-data users (audit F5). New deploy → new hashed
  // names → cache miss → fetched once → cached; old copies purge with the
  // per-deploy cache name on activate.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }
  // Remaining same-origin (icons, manifest…): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const live = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || live;
    })
  );
});
