
// Import version configuration
importScripts('/config/version.js');

// Use dynamic cache name from version config
const CACHE_NAME = window.CACHE_VERSION || 'hbm-kansenkaart-v1.3.1';
const CACHE_CONFIG = window.CACHE_CONFIG || {};

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/config/map-config.js',
  '/config/utils.js',
  '/config/version.js',
  '/icons/marker-project.svg',
  '/icons/marker-company.svg',
  '/icons/close.svg',
  '/icons/filter-setting.svg',
  '/logo-hbm.svg',
  '/translations/nl.json',
  '/translations/en.json',
  '/translations/de.json',
  // External dependencies
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];

// Dynamic content that should be network-first
const dynamicContent = [
  '/data/opportunities.json',
  '/data/geojson/'
];

// Install event - cache resources
self.addEventListener('install', function(event) {
  console.log('Service Worker installing with cache:', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(function(error) {
        console.error('Cache install failed:', error);
      })
  );
  
  // Force activation of new service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating with cache:', CACHE_NAME);
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME && cacheName.startsWith('hbm-kansenkaart-')) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event - smart caching strategy
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  
  // Skip external API calls (like geocoding)
  if (url.hostname.includes('nominatim.openstreetmap.org')) {
    return;
  }

  // Network-first strategy for dynamic content
  if (isDynamicContent(event.request.url)) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // Cache-first strategy for static content
  event.respondWith(cacheFirstStrategy(event.request));
});

function isDynamicContent(url) {
  return dynamicContent.some(path => url.includes(path));
}

// Network-first strategy for dynamic content
function networkFirstStrategy(request) {
  return fetch(request)
    .then(function(response) {
      // Check if we received a valid response
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      // Clone the response for caching
      const responseToCache = response.clone();

      caches.open(CACHE_NAME)
        .then(function(cache) {
          // Add timestamp header for cache invalidation
          const headers = new Headers(responseToCache.headers);
          headers.set('sw-cache-timestamp', Date.now().toString());
          
          const modifiedResponse = new Response(responseToCache.body, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers
          });
          
          cache.put(request, modifiedResponse);
        });

      return response;
    })
    .catch(function() {
      // Return cached version if network fails
      return caches.match(request)
        .then(function(response) {
          if (response) {
            console.log('Serving cached dynamic content:', request.url);
            return response;
          }
          // Return offline fallback for navigation requests
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          throw new Error('No cached version available');
        });
    });
}

// Cache-first strategy for static content
function cacheFirstStrategy(request) {
  return caches.match(request)
    .then(function(response) {
      // Return cached version if available
      if (response) {
        // Check if cache is stale for critical files
        const cacheTimestamp = response.headers.get('sw-cache-timestamp');
        if (cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp);
          const maxAge = CACHE_CONFIG.STATIC_CACHE_DURATION || 24 * 60 * 60 * 1000;
          
          if (age > maxAge) {
            console.log('Cache stale for:', request.url);
            // Return cached version but update in background
            updateCacheInBackground(request);
          }
        }
        
        return response;
      }

      // Fetch from network if not in cache
      return fetch(request).then(
        function(response) {
          // Check if we received a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response for caching
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function(cache) {
              // Add timestamp header
              const headers = new Headers(responseToCache.headers);
              headers.set('sw-cache-timestamp', Date.now().toString());
              
              const modifiedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
              });
              
              cache.put(request, modifiedResponse);
            });

          return response;
        }
      );
    })
    .catch(function() {
      // Return offline fallback for navigation requests
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
      throw new Error('Request failed and no cached version available');
    });
}

// Update cache in background
function updateCacheInBackground(request) {
  fetch(request)
    .then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        
        caches.open(CACHE_NAME)
          .then(function(cache) {
            const headers = new Headers(responseToCache.headers);
            headers.set('sw-cache-timestamp', Date.now().toString());
            
            const modifiedResponse = new Response(responseToCache.body, {
              status: responseToCache.status,
              statusText: responseToCache.statusText,
              headers: headers
            });
            
            cache.put(request, modifiedResponse);
            console.log('Updated cache in background for:', request.url);
          });
      }
    })
    .catch(function(error) {
      console.log('Background cache update failed for:', request.url, error);
    });
}

// Handle background sync for offline form submissions
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle any pending offline actions
  return Promise.resolve();
}

// Listen for messages from main thread
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_NAME,
      timestamp: Date.now()
    });
  }
});
