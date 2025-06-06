const GH_PAGES_SUBDIRECTORY_NO_SLASH = "whisper-share";
const APP_SHELL_CACHE_NAME = "audio-transcriber-pwa-app-shell-v1"; // Updated versioning if needed
const SHARED_FILES_CACHE_NAME = "audio-transcriber-pwa-shared-files-v1";

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

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCacheForAppShell))
      .catch((err) => console.error("App shell cache addAll failed:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== APP_SHELL_CACHE_NAME &&
              cacheName !== SHARED_FILES_CACHE_NAME &&
              cacheName.startsWith("audio-transcriber-pwa-")
            ) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (
    requestUrl.pathname === SHARE_TARGET_ACTION_PATH &&
    event.request.method === "POST"
  ) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const audioFile = formData.get("shared_audio_file");
          if (audioFile && audioFile instanceof File) {
            const cache = await caches.open(SHARED_FILES_CACHE_NAME);
            await cache.put(
              "latest-shared-audio",
              new Response(audioFile, {
                headers: {
                  "Content-Type": audioFile.type,
                  "Content-Length": audioFile.size,
                  "X-Original-Filename": encodeURIComponent(
                    audioFile.name || "shared_audio.file"
                  ),
                },
              })
            );
            return Response.redirect(REDIRECT_URL_AFTER_SHARE, 303);
          } else {
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
    return;
  }

  if (
    event.request.method !== "GET" ||
    requestUrl.hostname === "api.openai.com"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
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
          caches
            .open(APP_SHELL_CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch((error) => {
          console.error(
            "SW: Fetching app asset failed:",
            event.request.url,
            error
          );
          throw error;
        });
    })
  );
});
