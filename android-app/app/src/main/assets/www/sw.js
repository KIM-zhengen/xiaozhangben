/* ============================================
   Service Worker · 离线缓存
   版本号与 index.html 的 v= 保持一致
   ============================================ */
const CACHE_NAME = 'jizhang-v51';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=51',
  './js/db.js?v=51',
  './js/theme.js?v=51',
  './js/router.js?v=51',
  './js/pages/record.js?v=51',
  './js/pages/bills.js?v=51',
  './vendor/echarts.min.js?v=51',
  './js/pages/charts.js?v=51',
  './js/pages/mine.js?v=51',
  './js/app.js?v=51',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) {
          return key !== CACHE_NAME;
        }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const fetched = fetch(event.request).then(function (response) {
        if (response && response.status === 200 &&
          event.request.url.indexOf(self.location.origin) === 0) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || fetched;
    })
  );
});
