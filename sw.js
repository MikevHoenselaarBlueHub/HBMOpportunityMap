
const CACHE_NAME = 'hbm-kansenkaart-v2';
const STATIC_CACHE = 'static-v2';
const DATA_CACHE = 'data-v2';

const staticAssets = [
  '/',
  '/index.html',
  '/info.html',
  '/over.html',
  '/contact.html',
  '/style.css',
  '/script.js',
  '/translations/nl.json',
  '/translations/en.json',
  '/translations/de.json',
  '/icons/close.svg',
  '/icons/marker-company.svg',
  '/icons/marker-project.svg',
  '/favicon.ico'
];

const externalAssets = [
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js',
  'https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css',
  'https://healthybuildingmovement.com/resources/uploads/2023/11/Logo.svg'
];

const dataAssets = [
  '/opportunities.json'
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
  const { request } = event;
  const url = new URL(request.url);

  // Handle data requests (opportunities.json) with network-first strategy
  if (dataAssets.some(asset => request.url.includes(asset))) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DATA_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Handle static assets with cache-first strategy
  if (staticAssets.some(asset => request.url.endsWith(asset)) || 
      externalAssets.some(asset => request.url.includes(asset))) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request).then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return response;
          });
        })
    );
    return;
  }

  // Default strategy for other requests
  event.respondWith(
    caches.match(request)
      .then(response => response || fetch(request))
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
