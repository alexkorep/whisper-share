import React, { useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import Home from "./pages/Home";
import History from "./pages/History";
import Settings from "./pages/Settings";
import {
  AppBar,
  Toolbar,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Container,
  Box,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";

const OPENAI_API_KEY_STORAGE_KEY = "openai_api_key_transcriber";
const SHARED_FILES_CACHE_NAME = "audio-transcriber-pwa-shared-files-v1";
const TRANSCRIPTION_HISTORY_KEY = "transcription_history";

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

type Tab = "home" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<
    "info" | "loading" | "success" | "error"
  >("info");
  const [transcription, setTranscription] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const ffmpegRef = useRef<FFmpeg>();
  const ffmpegLoadedRef = useRef(false);

  useEffect(() => {
    const key = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
    setApiKey(key);
    if (key) {
      setApiKeyStatus("API Key loaded from storage.");
    } else {
      setApiKeyStatus("API Key not set. Please enter and save.");
    }

    try {
      const h: HistoryEntry[] = JSON.parse(
        localStorage.getItem(TRANSCRIPTION_HISTORY_KEY) || "[]"
      );
      setHistory(h);
    } catch {
      setHistory([]);
    }

    handleSharedFile();
  }, []);

  // service worker registration
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("./service-worker.js", { scope: "/whisper-share/" })
          .then((registration) => {
            console.log(
              "ServiceWorker registration successful with scope: ",
              registration.scope
            );
            if (navigator.serviceWorker.controller) {
              console.log("✅ Page is controlled by service worker");
            } else {
              console.log("⚠️ Page is NOT controlled by service worker");
            }
          })
          .catch((error) => {
            console.log("ServiceWorker registration failed: ", error);
          });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          console.log("Service worker controller changed");
          window.location.reload();
        });

        navigator.serviceWorker.addEventListener("message", (event) => {
          console.log("Message from SW:", event.data);
          if (event.data.type === "SW_READY") {
            console.log("✅ Service worker is ready and controlling the page");
          }
        });
      });
    }
  }, []);

  function updateStatus(
    msg: string,
    type: "info" | "loading" | "success" | "error" = "info"
  ) {
    setStatus(msg);
    setStatusType(type);
    if (type !== "loading") {
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
    if (!(qp.has("shared") || qp.has("error"))) return;

    if (qp.has("error")) {
      updateStatus(`Error during share: ${qp.get("error")}`, "error");
    }

    if (qp.has("shared")) {
      updateStatus("Attempting to load shared file…", "loading");
      try {
        if (!("caches" in window)) {
          updateStatus("Error: Cache API not available.", "error");
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
          const f = new File([blob], origName, { type });
          setSharedFile(f);
          updateStatus(`Shared file "${origName}" loaded.`, "success");
          await cache.delete("latest-shared-audio");
        } else {
          updateStatus("No shared file found in cache.", "info");
        }
      } catch (err: any) {
        console.error("Shared-file retrieval error:", err);
        updateStatus(`Error retrieving shared file: ${err.message}`, "error");
      }
    }
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.hash
    );
  }

  async function ensureFFmpegLoaded() {
    if (ffmpegLoadedRef.current) return;
    updateStatus("Loading FFmpeg core (~30 MB)…", "loading");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (progress > 0 && progress < 1) {
        updateStatus(
          `Conversion progress: ${(progress * 100).toFixed(1)} %`,
          "loading"
        );
      }
    });
    ffmpegRef.current = ffmpeg;
    try {
      let coreURL: string, wasmURL: string;
      // @ts-ignore
      const env = (import.meta as any).env || { DEV: false, BASE_URL: "/" };
      if (env.DEV) {
        const baseURL = env.BASE_URL || "/";
        coreURL = `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`;
        wasmURL = `${window.location.origin}${baseURL}node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm`;
      } else {
        const baseURL = env.BASE_URL || "/";
        coreURL = `${window.location.origin}${baseURL}ffmpeg-core.js`;
        wasmURL = `${window.location.origin}${baseURL}ffmpeg-core.wasm`;
      }
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegLoadedRef.current = true;
      updateStatus("FFmpeg engine ready.", "success");
    } catch (err) {
      console.error("FFmpeg failed to load:", err);
      updateStatus("Error: FFmpeg engine could not be loaded.", "error");
      throw err;
    }
  }

  async function convertToMp3(inputFile: File): Promise<File> {
    await ensureFFmpegLoaded();
    const ffmpeg = ffmpegRef.current!;

    const inputName = inputFile.name || "input";
    const outputName = "output.mp3";
    updateStatus(`Converting "${inputName}" to MP3…`, "loading");
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec(["-i", inputName, outputName]);
      const data = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      updateStatus(`Conversion of "${inputName}" complete.`, "success");
      // @ts-ignore
      const buffer =
        data instanceof Uint8Array
          ? data
          : data && data.buffer
          ? data.buffer
          : data;
      return new File([buffer], "converted.mp3", { type: "audio/mpeg" });
    } catch (err: any) {
      console.error("FFmpeg conversion error:", err);
      updateStatus(`Error converting "${inputName}": ${err.message}`, "error");
      try {
        await ffmpeg.deleteFile(inputName);
      } catch {}
      try {
        await ffmpeg.deleteFile(outputName);
      } catch {}
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
    const dataStr = typeof base64 === "string" ? base64 : "";
    return {
      model: "gpt-4o-mini-audio-preview",
      messages: [
        {
          role: "system",
          content: [{ type: "text", text: TRANSCRIPTION_INSTRUCTIONS }],
        },
        {
          role: "user",
          content: [
            { type: "text", text: "" },
            {
              type: "input_audio",
              input_audio: {
                data: dataStr.split(",")[1],
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
  }

  async function transcribe() {
    if (!apiKey) {
      updateStatus("Error: OpenAI API Key is not set.", "error");
      return;
    }
    const inputFile = sharedFile || file;
    if (!inputFile) {
      updateStatus("Error: No audio file selected or shared.", "error");
      return;
    }
    setTranscribing(true);
    setTranscription("");
    updateStatus("Preparing audio file…", "loading");
    let mp3File = inputFile;
    if (!inputFile.name.toLowerCase().endsWith(".mp3")) {
      try {
        mp3File = await convertToMp3(inputFile);
      } catch {
        setTranscribing(false);
        return;
      }
    } else {
      updateStatus("MP3 detected – no conversion needed.", "info");
    }

    try {
      updateStatus("Reading file data…", "loading");
      const base64 = await readFileAsBase64(mp3File);
      const body = buildOpenAIRequest(base64);
      updateStatus("Sending to OpenAI…", "loading");
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
        setTranscription(text);
        updateStatus("Transcription complete!", "success");
        saveTranscription({ filename: inputFile.name, text });
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      updateStatus(`Error: ${err.message}`, "error");
      setTranscription(`Error: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  }

  function saveKey() {
    if (apiKey.trim()) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, apiKey.trim());
      setApiKeyStatus("API Key saved successfully!");
    } else {
      setApiKeyStatus("Please enter an API Key.");
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    }
  }

  // Tab navigation and page rendering
  return (
    <Container
      maxWidth="sm"
      disableGutters
      sx={{
        p: 0,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Whisper Share
          </Typography>
        </Toolbar>
      </AppBar>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {tab === "home" && (
          <Home
            apiKey={apiKey}
            setApiKey={setApiKey}
            apiKeyStatus={apiKeyStatus}
            saveKey={saveKey}
            file={file}
            setFile={setFile}
            sharedFile={sharedFile}
            setSharedFile={setSharedFile}
            transcribe={transcribe}
            transcribing={transcribing}
            status={status}
            statusType={statusType}
            transcription={transcription}
          />
        )}
        {tab === "history" && (
          <History
            history={history}
            onCopy={(text) => navigator.clipboard.writeText(text)}
            onDelete={deleteHistory}
          />
        )}
        {tab === "settings" && (
          <Settings
            apiKey={apiKey}
            setApiKey={setApiKey}
            apiKeyStatus={apiKeyStatus}
            saveKey={saveKey}
          />
        )}
      </main>
      <BottomNavigation
        showLabels
        value={tab}
        onChange={(_, value) => setTab(value)}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100vw",
          zIndex: 1300,
          boxShadow: 3,
          borderTop: 1,
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <BottomNavigationAction
          label="Transcribe"
          value="home"
          icon={<MicIcon />}
        />
        <BottomNavigationAction
          label="History"
          value="history"
          icon={<HistoryIcon />}
        />
        <BottomNavigationAction
          label="Settings"
          value="settings"
          icon={<SettingsIcon />}
        />
      </BottomNavigation>
      <Box sx={{ height: { xs: 56, sm: 56, md: 56 } }} />
    </Container>
  );
}
