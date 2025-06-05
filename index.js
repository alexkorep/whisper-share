// index.js

function getApiKey() {
  return localStorage.getItem('openai_api_key') || '';
}

function saveApiKey(key) {
  localStorage.setItem('openai_api_key', key);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

window.addEventListener('load', async () => {
  const input = document.getElementById('api-key');
  const saveBtn = document.getElementById('save-key');
  const message = document.getElementById('message');

  const savedKey = getApiKey();
  if (savedKey) input.value = savedKey;

  saveBtn.addEventListener('click', async () => {
    const key = input.value.trim();
    if (!key) {
      alert('Please enter a valid API key');
      return;
    }
    saveApiKey(key);
    saveBtn.textContent = 'Saved';
    if (location.search.includes('share')) {
      await transcribe(key, message);
    }
  });

  if (location.search.includes('share') && savedKey) {
    await transcribe(savedKey, message);
  }
});

async function transcribe(apiKey, messageEl) {
  const cache = await caches.open('incoming');
  const resp = await cache.match('latest-audio');
  if (!resp) {
    messageEl.innerText = 'No audio file found';
    return;
  }
  const file = await resp.blob();
  await cache.delete('latest-audio');

  const fd = new FormData();
  fd.append('model', 'whisper-1');
  fd.append('file', file, 'recording.m4a');

  const transcription = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: fd,
  }).then(r => r.json()).catch(err => ({ error: err.toString() }));

  messageEl.innerText = transcription.text || transcription.error || 'No speech detected';
}
