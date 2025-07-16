// Service Worker COMPLETELY DISABLED for development
// This prevents any caching or navigation issues

self.addEventListener('install', function(event) {
  console.log('Service Worker: Install event - COMPLETELY DISABLED');
  // Skip waiting and immediately activate
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activate event - COMPLETELY DISABLED');

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

// DO NOT INTERCEPT ANY REQUESTS - let browser handle everything normally
self.addEventListener('fetch', function(event) {
  // Do absolutely nothing - let all requests go through normally
  return;
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