const SHARED_FILES_CACHE_NAME = "audio-transcriber-pwa-shared-files-v1";

const SHARE_TARGET_ACTION_PATH = `/whisper-share/receive-audio`;
const REDIRECT_URL_AFTER_SHARE = `/whisper-share/index.html?shared=true`;

self.addEventListener("activate", (event) => {
  console.log("SW: Activating service worker");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== SHARED_FILES_CACHE_NAME &&
              cacheName.startsWith("audio-transcriber-pwa-")
            ) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("SW: Claiming clients");
        return self.clients.claim();
      })
      .then(() => {
        console.log("SW: Service worker is now controlling all clients");
        // Notify all clients that service worker is ready
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: "SW_READY",
              message: "Service worker is ready and controlling this page",
            });
          });
        });
      })
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Check if this is our share target request
  const isShareTarget =
    (requestUrl.pathname === SHARE_TARGET_ACTION_PATH ||
      requestUrl.pathname === `/whisper-share/receive-audio` ||
      requestUrl.href.includes("/whisper-share/receive-audio")) &&
    event.request.method === "POST";

  if (isShareTarget) {
    console.log("SW: ✅ Intercepting share target POST request");
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
            console.log("SW: ❌ No file found in form data");
            return Response.redirect(
              REDIRECT_URL_AFTER_SHARE + "&error=share_failed_no_file",
              303
            );
          }
        } catch (error) {
          console.error("SW: ❌ Error handling share target:", error);
          return Response.redirect(
            REDIRECT_URL_AFTER_SHARE + "&error=share_processing_failed",
            303
          );
        }
      })()
    );
    return;
  }
});
