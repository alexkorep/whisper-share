import { defineConfig } from 'vite';

export default defineConfig({
  base: '/whisper-share/',
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@ffmpeg/core']
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..', './node_modules']
    }
  },
  assetsInclude: ['**/*.wasm']
});
