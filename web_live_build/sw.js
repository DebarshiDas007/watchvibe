const CACHE_NAME = 'watchvibe-cache-v19';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tailwind.css',
  './vendor/supabase/supabase.js',
  './vendor/fa/css/all.min.css'
];

// 1. Install Event - Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some pre-cache assets failed:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event - Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event - Network First with Cache Fallback for HTML, Stale-While-Revalidate for images
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests or chrome-extension requests
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Never cache API/auth traffic (TMDB calls carry an api_key in the URL; Supabase carries auth tokens).
  if (/(^|\.)(themoviedb\.org|supabase\.co|ipapi\.co|country\.is)$/.test(url.hostname)) {
    return;
  }

  // Only handle same-origin requests plus the poster hosts. A service worker's own fetch() is governed by the
  // page CSP's connect-src (not img-src), so proxying other cross-origin requests (avatars, YouTube, ...) would
  // get them blocked. Returning without respondWith lets the browser fetch them natively under img-src.
  const isPosterHost = url.hostname === 'image.tmdb.org' || url.hostname.endsWith('unsplash.com');
  if (url.origin !== self.location.origin && !isPosterHost) {
    return;
  }

  // A. For HTML pages: Network first, fall back to cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => {
          return caches.match(req).then((cachedRes) => {
            return cachedRes || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // B. For Image assets (TMDB & Unsplash): Cache-First with runtime caching
  if (url.hostname.includes('image.tmdb.org') || url.hostname.includes('unsplash.com')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        }).catch(() => {
          // Return generic fallback or nothing if offline and not in cache
          return cached;
        });
      })
    );
    return;
  }

  // C. For all other assets (CSS, JS, Fonts): Stale While Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});
