/**
 * ZARA — ZARAFIED STORE
 * Lightweight PWA Service Worker
 */

const CACHE_NAME = 'zarafied-v3';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles/tokens.css',
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/animations.css',
  './scripts/main.js',
  './scripts/nav.js',
  './scripts/slideshow.js',
  './scripts/welcome-card.js',
  './ZARA_ASSETS/brand/zara-logo.png',
  './ZARA_ASSETS/owner/owner-portrait-red-dress.png',
  './ZARA_ASSETS/owner/owner-outfit-reference-collage.png',
  './ZARA_ASSETS/fashion/signature-fashion-01-ankara.png',
  './ZARA_ASSETS/fashion/signature-fashion-02-paired-looks.png',
  './ZARA_ASSETS/fashion/signature-fashion-03-colourful-dress.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(() => {
        // Continue install even if an individual asset fails in local dev
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
