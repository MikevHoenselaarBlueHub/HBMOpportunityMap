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
  // Let all HTML pages load normally without any caching or interference
  if (event.request.method === 'GET' && 
      (event.request.url.endsWith('.html') || 
       event.request.url.endsWith('/') ||
       event.request.destination === 'document')) {
    // Don't interfere with HTML page navigation at all
    return;
  }
  
  // Only cache other resources (CSS, JS, images)
  if (event.request.method === 'GET' && 
      !event.request.url.includes('/api/')) {
    event.respondWith(
      caches.match(event.request)
        .then(function(response) {
          return response || fetch(event.request);
        })
    );
  }
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