// sw.js
self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('/receive/') &&
      event.request.method === 'POST') {

    event.respondWith((async () => {
      const formData = await event.request.formData();
      const audioFile = formData.get('audio');     // Blob

      // Put it in a temp cache so our UI page can access it
      const cache = await caches.open('incoming');
      await cache.put('latest-audio', new Response(audioFile));

      // Redirect the browser to the main UI page
      return Response.redirect('/?share', 303);
    })());
  }
});
