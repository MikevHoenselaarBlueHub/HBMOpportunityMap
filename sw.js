// Simple, stable service worker
const APP_VERSION = '1.4.0';
const CACHE_NAME = `hbm-kansenkaart-${APP_VERSION}`;

const STATIC_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/logo-hbm.svg',
  '/icons/close.svg',
  '/icons/filter-setting.svg',
  '/icons/marker-project.svg',
  '/icons/marker-company.svg',
  '/translations/nl.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

// Install - cache static files
self.addEventListener('install', function(event) {
  console.log('SW: Installing version', APP_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', function(event) {
  console.log('SW: Activating version', APP_VERSION);

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName.startsWith('hbm-kansenkaart-') && cacheName !== CACHE_NAME) {
              console.log('SW: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - simple cache strategy
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Skip external APIs
  if (url.hostname.includes('nominatim.openstreetmap.org') || 
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // Network first for data files
  if (event.request.url.includes('/data/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache first for static files
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return response;
          });
      })
  );
});

// Handle messages
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});