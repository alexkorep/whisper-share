// index.js
// Replace with your OpenAI API key
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

window.addEventListener('load', async () => {
  if (!location.search.includes('share')) return;

  const cache = await caches.open('incoming');
  const resp = await cache.match('latest-audio');
  if (!resp) {
    document.body.innerText = 'No audio file found';
    return;
  }
  const file = await resp.blob();
  await cache.delete('latest-audio');

  const fd = new FormData();
  fd.append('model', 'whisper-1');
  fd.append('file', file, 'recording.m4a');

  const transcription = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: fd,
  }).then(r => r.json()).catch(err => ({ error: err.toString() }));

  document.body.innerText = transcription.text || transcription.error || 'No speech detected';
});
