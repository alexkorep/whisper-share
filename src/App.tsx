import React, { useEffect, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import ApiKeyPage from './components/ApiKeyPage';
import HomePage from './components/HomePage';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import TabBar from './components/TabBar';
import './App.css'; // Assuming you will create this for global styles

const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key_transcriber';
const SHARED_FILES_CACHE_NAME = 'audio-transcriber-pwa-shared-files-v1';
const TRANSCRIPTION_HISTORY_KEY = 'transcription_history';

interface HistoryEntry {
  id: string;
  filename: string;
  text: string;
  date: string;
}

const TRANSCRIPTION_INSTRUCTIONS = `Transcribe the following audio into Russian text.

# Notes
• Preserve speaker's wording.
• Use correct punctuation/capitalisation.
• For unclear segments mark [unintelligible] plus timestamp.`;

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('apiKey'));
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('home');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'loading' | 'success' | 'error'>('info');
  const [transcription, setTranscription] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const ffmpegRef = useRef<FFmpeg>();
  const ffmpegLoadedRef = useRef(false);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('apiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    try {
      const h: HistoryEntry[] = JSON.parse(localStorage.getItem(TRANSCRIPTION_HISTORY_KEY) || '[]');
      setHistory(h);
    } catch {
      setHistory([]);
    }

    handleSharedFile();
    setIsLoadingApiKey(false);
  }, []);

  // service worker registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./service-worker.js', { scope: '/whisper-share/' })
          .then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
            if (navigator.serviceWorker.controller) {
              console.log('✅ Page is controlled by service worker');
            } else {
              console.log('⚠️ Page is NOT controlled by service worker');
            }
          })
          .catch((error) => {
            console.log('ServiceWorker registration failed: ', error);
          });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('Service worker controller changed');
          window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Message from SW:', event.data);
          if (event.data.type === 'SW_READY') {
            console.log('✅ Service worker is ready and controlling the page');
          }
        });
      });
    }
  }, []);

  function updateStatus(msg: string, type: 'info' | 'loading' | 'success' | 'error' = 'info') {
    setStatus(msg);
    setStatusType(type);
    if (type !== 'loading') {
      console.log(`Status [${type}]: ${msg}`);
    }
  }

  function saveTranscription(entry: { filename: string; text: string }) {
    const newEntry: HistoryEntry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      filename: entry.filename,
      text: entry.text,
      date: new Date().toISOString(),
    };
    const updated = [newEntry, ...history];
    setHistory(updated);
    localStorage.setItem(TRANSCRIPTION_HISTORY_KEY, JSON.stringify(updated));
  }

  function deleteHistory(id: string) {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem(TRANSCRIPTION_HISTORY_KEY, JSON.stringify(updated));
  }

  async function handleSharedFile() {
    const qp = new URLSearchParams(window.location.search);
    if (!(qp.has('shared') || qp.has('error'))) return;

    if (qp.has('error')) {
      updateStatus(`Error during share: ${qp.get('error')}`, 'error');
    }

    if (qp.has('shared')) {
      updateStatus('Attempting to load shared file…', 'loading');
      try {
        if (!('caches' in window)) {
          updateStatus('Error: Cache API not available.', 'error');
          return;
        }
        const cache = await caches.open(SHARED_FILES_CACHE_NAME);
        const resp = await cache.match('latest-shared-audio');
        if (resp) {
          const origName = decodeURIComponent(resp.headers.get('X-Original-Filename') || 'shared_audio');
          const type = resp.headers.get('Content-Type') || 'application/octet-stream';
          const blob = await resp.blob();
          const f = new File([blob], origName, { type });
          setSharedFile(f);
          updateStatus(`Shared file "${origName}" loaded.`, 'success');
          await cache.delete('latest-shared-audio');
        } else {
          updateStatus('No shared file found in cache.', 'info');
        }
      } catch (err: any) {
        console.error('Shared-file retrieval error:', err);
        updateStatus(`Error retrieving shared file: ${err.message}`, 'error');
      }
    }
    history.replaceState(null, '', window.location.pathname + window.location.hash);
  }

  async function ensureFFmpegLoaded() {
    if (ffmpegLoadedRef.current) return;
    updateStatus('Loading FFmpeg core (~30 MB)…', 'loading');
    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      if (progress > 0 && progress < 1) {
        updateStatus(`Conversion progress: ${(progress * 100).toFixed(1)} %`, 'loading');
      }
    });
    ffmpegRef.current = ffmpeg;
    try {
      let coreURL: string, wasmURL: string;
      if (import.meta.env.DEV) {
        const baseURL = import.meta.env.BASE_URL || '/';
        coreURL = `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`;
        wasmURL = `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm`;
      } else {
        const baseURL = import.meta.env.BASE_URL || '/';
        coreURL = `${window.location.origin}${baseURL}ffmpeg-core.js`;
        wasmURL = `${window.location.origin}${baseURL}ffmpeg-core.wasm`;
      }
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegLoadedRef.current = true;
      updateStatus('FFmpeg engine ready.', 'success');
    } catch (err) {
      console.error('FFmpeg failed to load:', err);
      updateStatus('Error: FFmpeg engine could not be loaded.', 'error');
      throw err;
    }
  }

  async function convertToMp3(inputFile: File): Promise<File> {
    await ensureFFmpegLoaded();
    const ffmpeg = ffmpegRef.current!;

    const inputName = inputFile.name || 'input';
    const outputName = 'output.mp3';
    updateStatus(`Converting "${inputName}" to MP3…`, 'loading');
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec(['-i', inputName, outputName]);
      const data = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      updateStatus(`Conversion of "${inputName}" complete.`, 'success');
      return new File([data.buffer], 'converted.mp3', { type: 'audio/mpeg' });
    } catch (err: any) {
      console.error('FFmpeg conversion error:', err);
      updateStatus(`Error converting "${inputName}": ${err.message}`, 'error');
      try { await ffmpeg.deleteFile(inputName); } catch {}
      try { await ffmpeg.deleteFile(outputName); } catch {}
      throw err;
    }
  }

  function readFileAsBase64(f: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  function buildOpenAIRequest(base64: string | ArrayBuffer | null) {
    const dataStr = typeof base64 === 'string' ? base64 : '';
    return {
      model: 'gpt-4o-mini-audio-preview',
      messages: [
        {
          role: 'system',
          content: [{ type: 'text', text: TRANSCRIPTION_INSTRUCTIONS }],
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: '' },
            {
              type: 'input_audio',
              input_audio: {
                data: dataStr.split(',')[1],
                format: 'mp3',
              },
            },
          ],
        },
      ],
      modalities: ['text'],
      temperature: 1,
      max_completion_tokens: 16384,
    };
  }

  async function transcribe() {
    if (!apiKey) {
      updateStatus('Error: OpenAI API Key is not set.', 'error');
      return;
    }
    const inputFile = sharedFile || file;
    if (!inputFile) {
      updateStatus('Error: No audio file selected or shared.', 'error');
      return;
    }
    setTranscribing(true);
    setTranscription('');
    updateStatus('Preparing audio file…', 'loading');
    let mp3File = inputFile;
    if (!inputFile.name.toLowerCase().endsWith('.mp3')) {
      try {
        mp3File = await convertToMp3(inputFile);
      } catch {
        setTranscribing(false);
        return;
      }
    } else {
      updateStatus('MP3 detected – no conversion needed.', 'info');
    }

    try {
      updateStatus('Reading file data…', 'loading');
      const base64 = await readFileAsBase64(mp3File);
      const body = buildOpenAIRequest(base64);
      updateStatus('Sending to OpenAI…', 'loading');
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
        throw new Error(`API ${res.status}: ${err.error?.message || res.statusText}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) {
        setTranscription(text);
        updateStatus('Transcription complete!', 'success');
        saveTranscription({ filename: inputFile.name, text });
      } else {
        throw new Error('Unexpected response structure.');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      updateStatus(`Error: ${err.message}`, 'error');
      setTranscription(`Error: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  }

  function saveKey() {
    if (apiKey && apiKey.trim()) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, apiKey.trim());
      setApiKeyStatus('API Key saved successfully!');
    } else {
      setApiKeyStatus('Please enter an API Key.');
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    }
  }

  const handleApiKeySave = (newApiKey: string) => {
    localStorage.setItem('apiKey', newApiKey);
    setApiKey(newApiKey);
    setActiveTab('home'); // Navigate to home after saving API key
  };

  const handleApiKeyRemove = () => {
    localStorage.removeItem('apiKey');
    setApiKey(null);
    setActiveTab('home'); // Or perhaps to a dedicated "logged out" page or back to ApiKeyPage implicitly
  }

  if (isLoadingApiKey) {
    return <div>Loading...</div>; // Or a proper loading spinner
  }

  const renderPage = () => {
    if (!apiKey) {
      return <ApiKeyPage onApiKeySave={handleApiKeySave} />;
    }

    switch (activeTab) {
      case 'home':
        return <HomePage />;
      case 'history':
        return <HistoryPage />;
      case 'settings':
        // Settings page will need access to apiKey and remove/update functions
        return <SettingsPage currentApiKey={apiKey} onApiKeyUpdate={handleApiKeySave} onApiKeyRemove={handleApiKeyRemove} />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="App">
      {renderPage()}
      {apiKey && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}
    </div>
  );
}
