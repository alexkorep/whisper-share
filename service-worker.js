const GH_PAGES_SUBDIRECTORY_NO_SLASH = "whisper-share"; // Used for constructing paths/URLs
const APP_SHELL_CACHE_NAME = "audio-transcriber-pwa-app-shell-v1";
const SHARED_FILES_CACHE_NAME = "audio-transcriber-pwa-shared-files-v1";

// Define URLs relative to the service worker's scope
// The SW scope will be /whisper-share/
const urlsToCacheForAppShell = [
  // "./",
  // "./index.html",
  // "./style.css",
  // "./app.js",
  // "./manifest.json",
  // "./icon-192x192.png",
  // "./icon-512x512.png",
];

const SHARE_TARGET_ACTION_PATH = `/${GH_PAGES_SUBDIRECTORY_NO_SLASH}/receive-audio/`;
const REDIRECT_URL_AFTER_SHARE = `/${GH_PAGES_SUBDIRECTORY_NO_SLASH}/index.html?shared=true`;

// Install event: cache core app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE_NAME)
      .then((cache) => {
        console.log("Opened app shell cache:", APP_SHELL_CACHE_NAME);
        return cache.addAll(urlsToCacheForAppShell);
      })
      .catch((err) => {
        console.error("App shell cache addAll failed:", err);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete caches that are not the current app shell cache OR the shared files cache
            if (
              cacheName !== APP_SHELL_CACHE_NAME &&
              cacheName !== SHARED_FILES_CACHE_NAME &&
              cacheName.startsWith("audio-transcriber-pwa-")
            ) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim()) // Ensure new service worker takes control immediately
  );
});

// Fetch event
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // 1. Handle Share Target POST request
  if (
    requestUrl.pathname === SHARE_TARGET_ACTION_PATH &&
    event.request.method === "POST"
  ) {
    console.log(
      "SW: Intercepted share target POST request to:",
      requestUrl.pathname
    );
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const audioFile = formData.get("shared_audio_file"); // Matches 'name' in manifest.json

          if (audioFile && audioFile instanceof File) {
            console.log(
              "SW: Received shared audio file:",
              audioFile.name,
              audioFile.type,
              audioFile.size
            );
            const cache = await caches.open(SHARED_FILES_CACHE_NAME);
            // Storing the raw File (Blob) in a Response object
            await cache.put(
              "latest-shared-audio",
              new Response(audioFile, {
                headers: {
                  "Content-Type": audioFile.type,
                  "Content-Length": audioFile.size,
                  "X-Original-Filename": encodeURIComponent(
                    audioFile.name || "shared_audio.m4a"
                  ),
                },
              })
            );
            console.log("SW: Stored shared audio in cache. Redirecting...");
            return Response.redirect(REDIRECT_URL_AFTER_SHARE, 303); // 303 See Other for POST->GET redirect
          } else {
            console.error(
              'SW: No "shared_audio_file" found in formData or it is not a File.'
            );
            // Optionally redirect to an error page or the main page with an error param
            return Response.redirect(
              REDIRECT_URL_AFTER_SHARE + "&error=share_failed_no_file",
              303
            );
          }
        } catch (error) {
          console.error("SW: Error handling share target:", error);
          return Response.redirect(
            REDIRECT_URL_AFTER_SHARE + "&error=share_processing_failed",
            303
          );
        }
      })()
    );
    return; // Important: Stop further processing for this event
  }

  // 2. Bypass for non-GET requests (like POSTs to OpenAI)
  //    and also explicitly bypass any requests to the OpenAI API domain.
  if (
    event.request.method !== "GET" ||
    requestUrl.hostname === "api.openai.com"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. For GET requests (these are for our app's assets):
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(APP_SHELL_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch((error) => {
          console.error(
            "SW: Fetching app asset failed:",
            event.request.url,
            error
          );
          // You could return a fallback offline page here.
          throw error;
        });
    })
  );
});
