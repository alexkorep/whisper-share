// app.js
// Uses the factory API introduced in @ffmpeg/ffmpeg 0.12.x
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

async function initializeApp() {

  /*** ---------- DOM ELEMENTS ---------- ***/
  const apiKeyInput = document.getElementById("apiKey");
  const saveApiKeyButton = document.getElementById("saveApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const audioFileInput = document.getElementById("audioFile");
  const transcribeButton = document.getElementById("transcribeButton");
  const transcriptionOutput = document.getElementById("transcriptionOutput");
  const statusDiv = document.getElementById("status");

  const sharedFileInfoDiv = document.createElement("div");
  sharedFileInfoDiv.id = "sharedFileInfo";
  audioFileInput.parentNode?.insertBefore(
    sharedFileInfoDiv,
    audioFileInput.nextSibling
  );

  /*** ---------- CONSTANTS ---------- ***/
  const OPENAI_API_KEY_STORAGE_KEY = "openai_api_key_transcriber";
  const SHARED_FILES_CACHE_NAME = "audio-transcriber-pwa-shared-files-v1";

  /*** ---------- STATE ---------- ***/
  let sharedFileFromCache = null; // File loaded via Web-Share-Target
  let ffmpeg = null; // FFmpeg instance (lazy-loaded)
  let ffmpegLoaded = false; // Flag so we only load once

  /*** ---------- FFmpeg HELPERS ---------- ***/

  async function ensureFFmpegLoaded() {
    if (ffmpegLoaded) return;

    setStatus("Loading FFmpeg core (~30 MB)…", "loading");
    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (progress > 0 && progress < 1) {
        setStatus(
          `Conversion progress: ${(progress * 100).toFixed(1)} %`,
          "loading"
        );
      }
    });

    try {
      // Use URLs that work with Vite's dev server
      const baseURL = import.meta.env.BASE_URL || '/';
      await ffmpeg.load({
        coreURL: `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`,
        wasmURL: `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm`,
      });
      ffmpegLoaded = true;
      setStatus("FFmpeg engine ready.", "success");
    } catch (err) {
      console.error("FFmpeg failed to load:", err);
      setStatus("Error: FFmpeg engine could not be loaded.", "error");
      throw err;
    }
  }

  async function convertToMp3(inputFile) {
    await ensureFFmpegLoaded();

    const inputName = inputFile.name || "input";
    const outputName = "output.mp3";

    setStatus(`Converting "${inputName}" to MP3…`, "loading");

    try {
      // Write the source file into FFmpeg's virtual FS
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

      // Transcode
      await ffmpeg.exec(["-i", inputName, outputName]);

      // Read the resulting file back from the virtual FS
      const data = await ffmpeg.readFile(outputName);

      // Clean up virtual FS
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      setStatus(`Conversion of "${inputName}" complete.`, "success");
      return new File([data.buffer], "converted.mp3", { type: "audio/mpeg" });
    } catch (err) {
      console.error("FFmpeg conversion error:", err);
      setStatus(`Error converting "${inputName}": ${err.message}`, "error");
      // Attempt cleanup but ignore errors
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {}
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {}
      throw err;
    }
  }

  /*** ---------- UI STATE HELPERS ---------- ***/
  function setStatus(msg, type = "info") {
    statusDiv.textContent = msg;
    statusDiv.className = type; // CSS classes .info .loading .success .error
    if (type !== "loading") console.log(`Status [${type}]: ${msg}`);
  }

  function loadApiKey() {
    const key = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (key) {
      apiKeyInput.value = key;
      apiKeyStatus.textContent = "API Key loaded from storage.";
      apiKeyStatus.className = "status-message success";
    } else {
      apiKeyStatus.textContent = "API Key not set. Please enter and save.";
      apiKeyStatus.className = "status-message error";
    }
  }

  /*** ---------- EVENT LISTENERS ---------- ***/
  saveApiKeyButton.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, key);
      apiKeyStatus.textContent = "API Key saved successfully!";
      apiKeyStatus.className = "status-message success";
    } else {
      apiKeyStatus.textContent = "Please enter an API Key.";
      apiKeyStatus.className = "status-message error";
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    }
  });

  transcribeButton.addEventListener("click", async () => {
    const apiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    let file = sharedFileFromCache || audioFileInput.files[0];

    if (!apiKey) {
      setStatus("Error: OpenAI API Key is not set.", "error");
      return;
    }
    if (!file) {
      setStatus("Error: No audio file selected or shared.", "error");
      return;
    }

    transcribeButton.disabled = true;
    transcriptionOutput.value = "";
    setStatus("Preparing audio file…", "loading");

    // Convert if necessary
    let mp3File = file;
    if (
      !file.name.toLowerCase().endsWith(".mp3")
    ) {
      try {
        mp3File = await convertToMp3(file);
      } catch (e) {
        transcribeButton.disabled = false;
        return;
      }
    } else {
      setStatus("MP3 detected – no conversion needed.", "info");
    }

    /** ---- Send to OpenAI ---- **/
    setStatus("Reading file data…", "loading");
    try {
      const base64 = await readFileAsBase64(mp3File); // data: URI
      const body = {
        model: "gpt-4o-mini-audio-preview",
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: `Transcribe the following audio into Russian text.

# Notes
• Preserve speaker's wording.
• Use correct punctuation/capitalisation.
• For unclear segments mark [unintelligible] plus timestamp.`,
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "text", text: "" },
              {
                type: "input_audio",
                input_audio: {
                  data: base64.split(",")[1], // strip "data:…;base64,"
                  format: "mp3",
                },
              },
            ],
          },
        ],
        modalities: ["text"],
        temperature: 1,
        max_completion_tokens: 16384,
      };

      setStatus("Sending to OpenAI…", "loading");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: { message: res.statusText } }));
        throw new Error(
          `API ${res.status}: ${err.error?.message || res.statusText}`
        );
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) {
        transcriptionOutput.value = text;
        setStatus("Transcription complete!", "success");
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (err) {
      console.error("Transcription error:", err);
      setStatus(`Error: ${err.message}`, "error");
      transcriptionOutput.value = `Error: ${err.message}`;
    } finally {
      transcribeButton.disabled = false;
    }
  });

  /*** ---------- WEB-SHARE-TARGET HANDLING ---------- ***/
  async function handleSharedFile() {
    const qp = new URLSearchParams(window.location.search);
    if (!(qp.has("shared") || qp.has("error"))) return;

    if (qp.has("error")) {
      setStatus(`Error during share: ${qp.get("error")}`, "error");
    }

    if (qp.has("shared")) {
      setStatus("Attempting to load shared file…", "loading");
      try {
        if (!("caches" in window)) {
          setStatus("Error: Cache API not available.", "error");
          return;
        }
        const cache = await caches.open(SHARED_FILES_CACHE_NAME);
        const resp = await cache.match("latest-shared-audio");
        if (resp) {
          const origName = decodeURIComponent(
            resp.headers.get("X-Original-Filename") || "shared_audio"
          );
          const type =
            resp.headers.get("Content-Type") || "application/octet-stream";
          const blob = await resp.blob();

          sharedFileFromCache = new File([blob], origName, { type });
          audioFileInput.style.display = "none";
          sharedFileInfoDiv.innerHTML =
            `<p><strong>Shared file:</strong> ${origName} (${(
              blob.size / 1024
            ).toFixed(1)} KB)</p>` +
            `<button id="clearSharedFile">Choose a different file</button>`;

          document
            .getElementById("clearSharedFile")
            .addEventListener("click", () => {
              sharedFileFromCache = null;
              audioFileInput.value = "";
              audioFileInput.style.display = "block";
              sharedFileInfoDiv.innerHTML = "";
              setStatus("Shared file cleared.", "info");
            });

          setStatus(`Shared file "${origName}" loaded.`, "success");
          await cache.delete("latest-shared-audio");
        } else {
          setStatus("No shared file found in cache.", "info");
        }
      } catch (err) {
        console.error("Shared-file retrieval error:", err);
        setStatus(`Error retrieving shared file: ${err.message}`, "error");
      }
    }
    // Clean URL so a refresh doesn't repeat the share logic
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash
    );
  }

  /*** ---------- UTIL ---------- ***/
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /*** ---------- INIT ---------- ***/
  loadApiKey();
  handleSharedFile();

  if (
    !localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) &&
    !sharedFileFromCache
  ) {
    setStatus("Please enter and save your OpenAI API Key.", "info");
  }

  /*** ---------- SERVICE WORKER ---------- ***/
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const viteBase = import.meta.env.BASE_URL || '/'; // Get base from Vite
      const workerUrl = new URL('service-worker.js', new URL(viteBase, window.location.origin)).href;
      navigator.serviceWorker
        .register(workerUrl, { scope: viteBase }) // Use viteBase for scope
        .then((registration) => {
          console.log("ServiceWorker registration successful with scope: ", registration.scope);
        })
        .catch((error) => {
          console.log("ServiceWorker registration failed: ", error);
        });
    });
  }
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", initializeApp);
