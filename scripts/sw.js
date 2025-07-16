// Service Worker DISABLED for development
// This prevents any caching issues during development

self.addEventListener('install', function(event) {
  console.log('Service Worker: Install event - DISABLED');
  // Skip waiting to immediately activate
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activate event - DISABLED');

  event.waitUntil(
    // Delete ALL existing caches
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          console.log('Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // Always fetch from network, never cache
  event.respondWith(
    fetch(event.request).catch(function() {
      // Only for navigation requests, return index.html as fallback
      if (event.request.destination === 'document') {
        return fetch('/index.html');
      }
      throw new Error('Network request failed and caching is disabled');
    })
  );
});

// Clear any existing caches on message
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    });
  }
});