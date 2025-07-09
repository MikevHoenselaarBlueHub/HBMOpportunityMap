
const CACHE_NAME = 'hbm-kansenkaart-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/info.html',
  '/over.html',
  '/style.css',
  '/script.js',
  '/opportunities.json',
  '/translations/nl.json',
  '/translations/en.json',
  '/translations/de.json',
  '/icons/close.svg',
  '/icons/marker-company.svg',
  '/icons/marker-project.svg',
  '/favicon.ico',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://healthybuildingmovement.com/resources/uploads/2023/11/Logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
