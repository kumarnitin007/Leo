/**
 * MyDay Service Worker
 * 
 * Provides offline functionality and caching for the PWA
 */

const CACHE_NAME = 'myday-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  // Skip non-http(s) requests (chrome-extension, etc.)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Check if we're in development (localhost)
  const isDevelopment = event.request.url.includes('localhost') || event.request.url.includes('127.0.0.1');
  
  if (isDevelopment) {
    // Skip Vite dev server requests - let them go directly to network for HMR
    if (event.request.url.includes('/@vite/') || 
        event.request.url.includes('/@react-refresh') ||
        event.request.url.includes('/@id/')) {
      return; // Let the browser handle these requests normally
    }
    
    // NETWORK-FIRST strategy for development
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Always use fresh content in development
          return response;
        })
        .catch((error) => {
          // Only use cache as fallback when offline
          return caches.match(event.request).then((cachedResponse) => {
            // If cache miss, return a basic error response
            // This ensures we always return a Response
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return a basic error response if both network and cache fail
            return new Response('Network error and no cache available', { 
              status: 503, 
              statusText: 'Service Unavailable' 
            });
          });
        })
    );
  } else {
    // CACHE-FIRST strategy for production
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Cache hit - return response
          if (response) {
            return response;
          }

          return fetch(event.request).then(
            (response) => {
              // Check if we received a valid response
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              // Clone the response
              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            }
          ).catch(() => {
            // Return a custom offline page if available, or the original request
            return caches.match('/offline.html').then((offlinePage) => {
              return offlinePage || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });
          });
        })
    );
  }
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Background sync for offline data persistence
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

async function syncTasks() {
  // Implement background sync logic here if needed
  console.log('Syncing tasks...');
}

// Push notification handler
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'You have pending tasks!',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Tasks'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('MyDay Reminder', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

