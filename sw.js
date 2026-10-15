/**
 * Capacity AVM Navigasyon - Çevrimdışı PWA Service Worker (sw.js)
 * Alt katlarda (B1, B2, B3) internet kopsa bile harita ve navigasyonun kesintisiz çalışmasını sağlar.
 */

const CACHE_NAME = 'capacity-nav-v1.0';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './public/mall_data.json',
  './public/favicon.svg',
  './public/favicon.png',
  './public/apple-touch-icon.png',
  './public/svg/1.svg',
  './public/svg/2.svg',
  './public/svg/3.svg',
  './public/svg/4.svg',
  './public/svg/5.svg',
  './public/svg/6.svg',
  './js/logos.js',
  './js/qrcode.js',
  './js/parking-service.js',
  './js/navigation.js',
  './js/simulator.js',
  './js/map.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Yalnızca GET isteklerini ve yerel kaynakları yakala
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Dış API veya analytics isteklerini es geç
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Arka planda güncelle (stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {/* Çevrimdışıyken hata verme */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      }).catch(() => {
        // Ağ yoksa ve cache'te de yoksa index.html dön
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
