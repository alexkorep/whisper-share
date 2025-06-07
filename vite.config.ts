import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: '/whisper-share/',
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'ffmpeg-worker.js',
        chunkFileNames: 'worker-chunks/[name]-[hash].js',
        assetFileNames: 'worker-assets/[name]-[hash].[ext]',
      }
    }
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
  assetsInclude: ['**/*.wasm'],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash].[ext]',
      },
    },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.{js,wasm}',
          dest: ''
        },
        {
          src: 'service-worker.js',
          dest: ''
        }
      ]
    })
  ],
});
