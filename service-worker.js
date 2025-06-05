const GH_PAGES_SUBDIRECTORY = "/whisper-share/"; // Define your subdirectory
const CACHE_NAME = "audio-transcriber-pwa-v1" + GH_PAGES_SUBDIRECTORY; // Make cache name unique if deploying multiple apps

// Adjust paths to be relative to the service worker's location within the subdirectory
const urlsToCache = [
  // These paths are now relative to the SW's scope, which will be /whisper-share/
  // The SW automatically prepends its scope to these.
  "./", //  resolves to /whisper-share/
  "./index.html", //  resolves to /whisper-share/index.html
  "./style.css", //  resolves to /whisper-share/style.css
  "./app.js", //  resolves to /whisper-share/app.js
  "./manifest.json", //  resolves to /whisper-share/manifest.json
  "./icon-192x192.png", //  resolves to /whisper-share/icon-192x192.png
  "./icon-512x512.png", //  resolves to /whisper-share/icon-512x512.png
];

// Install event: cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache:", CACHE_NAME);
        // Construct full paths for addAll based on the SW's location
        // This is generally not needed if paths in urlsToCache are correctly relative to scope
        // const assetsToCache = urlsToCache.map(url => new URL(url, self.location).pathname);
        // console.log('Caching assets:', assetsToCache);
        // return cache.addAll(assetsToCache); // This can be more robust
        return cache.addAll(urlsToCache); // Simpler and usually works if paths are correct
      })
      .catch((err) => {
        console.error("Cache addAll failed:", err);
        // You might want to throw the error to fail the SW install if critical assets aren't cached
      })
  );
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete caches that don't match the current CACHE_NAME
          // AND also don't belong to this app (if using a prefix)
          if (
            cacheName !== CACHE_NAME &&
            cacheName.startsWith("audio-transcriber-pwa-v1")
          ) {
            // Or your prefix
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("https://api.openai.com")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response; // Serve from cache
      }
      // Not in cache, fetch from network
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            // For 'basic' type, it's a same-origin request we can cache.
            // 'opaque' responses are from cross-origin requests without CORS, can't get details or cache them reliably.
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch((error) => {
          console.error("SW Fetch failed:", error, event.request.url);
          // Optionally return a fallback offline page:
          // if (event.request.mode === 'navigate') { // Only for page navigations
          //     return caches.match('./offline.html'); // You'd need to cache this page
          // }
          throw error;
        });
    })
  );
});
