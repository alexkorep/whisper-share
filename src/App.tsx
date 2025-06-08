import React, { useEffect, useRef, useState } from "react";
import { useTranscription } from "./hooks/useTranscription";
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
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<
    "info" | "loading" | "success" | "error"
  >("info");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [selectedApi, setSelectedApi] = useState<string>("gpt4o");
  const {
    transcription,
    setTranscription,
    transcribing,
    transcribe: transcribeHook,
  } = useTranscription({
    apiKey,
    onSaveTranscription: saveTranscription,
    onStatus: updateStatus,
    selectedApi,
  });
  // Removed ffmpegRef and ffmpegLoadedRef, now handled in useTranscription hook

  useEffect(() => {
    const key = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
    setApiKey(key);
    if (key) {
      setApiKeyStatus("API Key loaded from storage.");
      setApiKeySaved(true);
    } else {
      setApiKeyStatus("API Key not set. Please enter and save.");
      setApiKeySaved(false);
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

  // FFmpeg and conversion logic moved to useTranscription hook

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

  function transcribe() {
    const inputFile = sharedFile || file;
    if (!inputFile) {
      updateStatus("Error: No audio file selected or shared.", "error");
      return;
    }
    transcribeHook(inputFile);
  }

  function saveKey() {
    if (apiKey.trim()) {
      localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, apiKey.trim());
      setApiKeyStatus("API Key saved successfully!");
      setApiKeySaved(true);
    } else {
      setApiKeyStatus("Please enter an API Key.");
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
      setApiKeySaved(false);
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
            apiKeySaved={apiKeySaved}
            file={file}
            setFile={setFile}
            sharedFile={sharedFile}
            setSharedFile={setSharedFile}
            transcribe={transcribe}
            transcribing={transcribing}
            status={status}
            statusType={statusType}
            transcription={transcription}
            selectedApi={selectedApi}
            setSelectedApi={setSelectedApi}
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
