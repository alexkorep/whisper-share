# Whisper Share

A simple web app for sharing audio files and transcribing them with OpenAI Whisper.

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server with Vite:

   ```bash
   npm run dev
   ```

   Vite provides hot reload and allows you to import packages from npm.

3. Build for production:
   ```bash
   npm run build
   ```
   The optimized site will be output to the `dist/` directory. You can
   preview it locally with:
   ```bash
   npm run preview
   ```

Alternatively, you can still serve the files without bundling using:

```bash
npm start
```

which serves the site at <http://localhost:8080>.

Open your browser to the URL above to interact with the app.

