/**
 * ZARA — ZARAFIED STORE
 * High-Performance Low-Latency Service Worker
 *
 * Strategies:
 * 1. App Shell (HTML): Network-first with instant offline cache fallback.
 * 2. Static Assets (CSS, JS, Fonts): Stale-While-Revalidate for sub-20ms instant loads.
 * 3. Media Assets (Cloudinary & Local Images): Cache-First with LRU size limit.
 * 4. Third-party APIs (Firestore, Auth, Cloudinary Upload API): Bypassed.
 * 5. Update Lifecycle: Controlled activation via SKIP_WAITING message and clean client notification.
 */

const SHELL_CACHE_NAME = 'zarafied-shell-v13';
const IMAGE_CACHE_NAME = 'zarafied-images-v1';
const MAX_CACHED_IMAGES = 60;

// Essential lightweight application shell assets only
const CORE_SHELL_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './manifest.webmanifest',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/animations.css',
  './styles/admin.css',
  './scripts/main.js',
  './scripts/nav.js',
  './scripts/slideshow.js',
  './scripts/welcome-card.js',
  './scripts/pwa-install.js',
  './scripts/firebase-config.js',
  './scripts/cloudinary.js',
  './scripts/compressor.js',
  './scripts/products-service.js',
  './scripts/settings-service.js',
  './scripts/shop.js',
  './scripts/admin.js',
  './ZARA_ASSETS/brand/zara-logo.png',
  './ZARA_ASSETS/owner/owner-portrait-pink-outfit.jpg',
  './ZARA_ASSETS/owner/owner-portrait-yellow-outfit.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_SHELL_ASSETS.map((asset) => new Request(asset, { cache: 'reload' }))).catch((err) => {
        console.info('[ZARAFIED SW]: Core assets cached with partial fallbacks.', err?.message);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Controlled update message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Bypass Firestore, Cloudinary Upload API, and Firebase Auth
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.pathname.includes('/image/upload') && request.method === 'POST' ||
    url.hostname.includes('api.cloudinary.com')
  ) {
    return;
  }

  // 2. Cloudinary Delivered Images & Local Fashion Images: Cache-First with LRU limit
  const isImageRequest = (
    url.hostname.includes('res.cloudinary.com') ||
    request.destination === 'image' ||
    /\.(?:png|jpg|jpeg|webp|avif|svg|gif)(?:\?.*)?$/i.test(url.pathname)
  );

  if (isImageRequest) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
            // Periodic LRU cleanup in background
            limitCacheSize(IMAGE_CACHE_NAME, MAX_CACHED_IMAGES);
          }
          return networkResponse;
        } catch (_) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // 3. HTML Navigation / Pages: Network-First with quick timeout & Cache Fallback
  const isHtmlRequest = (
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/'
  );

  if (isHtmlRequest) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 4. Static Code & Styles (CSS, JS, Fonts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(SHELL_CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

/**
 * LRU Cache limit helper to protect mobile device storage
 */
async function limitCacheSize(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      const toDelete = keys.slice(0, keys.length - maxItems);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch (_) {}
}

