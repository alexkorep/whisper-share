import { useState, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const TRANSCRIPTION_INSTRUCTIONS = `Transcribe the following audio into Russian text.\n# Notes\n• Preserve speaker's wording.\n• Use correct punctuation/capitalisation.\n• For unclear segments mark [unintelligible] plus timestamp.`;

export interface HistoryEntry {
  id: string;
  filename: string;
  text: string;
  date: string;
}

export function useTranscription({
  apiKey,
  onSaveTranscription,
  onStatus,
}: {
  apiKey: string;
  onSaveTranscription: (entry: { filename: string; text: string }) => void;
  onStatus: (msg: string, type?: "info" | "loading" | "success" | "error") => void;
}) {
  const [transcription, setTranscription] = useState<string>("");
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const ffmpegRef = useRef<FFmpeg | undefined>();
  const ffmpegLoadedRef = useRef<boolean>(false);

  async function ensureFFmpegLoaded() {
    if (ffmpegLoadedRef.current) return;
    onStatus("Loading FFmpeg core (~30 MB)…", "loading");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (progress > 0 && progress < 1) {
        onStatus(`Conversion progress: ${(progress * 100).toFixed(1)} %`, "loading");
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
      onStatus("FFmpeg engine ready.", "success");
    } catch (err) {
      console.error("FFmpeg failed to load:", err);
      onStatus("Error: FFmpeg engine could not be loaded.", "error");
      throw err;
    }
  }

  async function convertToMp3(inputFile: File): Promise<File> {
    await ensureFFmpegLoaded();
    const ffmpeg = ffmpegRef.current!;
    const inputName = inputFile.name || "input";
    const outputName = "output.mp3";
    onStatus(`Converting ${inputName} to MP3…`, "loading");
    try {
      await ffmpeg.writeFile(inputName, await fetchFile(inputFile));
      await ffmpeg.exec(["-i", inputName, outputName]);
      const data = await ffmpeg.readFile(outputName);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      onStatus(`Conversion of ${inputName} complete.`, "success");
      let buffer: Uint8Array;
      if (data instanceof Uint8Array) {
        buffer = data;
      } else if (typeof data === "string") {
        buffer = new TextEncoder().encode(data);
      } else {
        buffer = new Uint8Array(data);
      }
      return new File([buffer], "converted.mp3", { type: "audio/mpeg" });
    } catch (err: any) {
      console.error("FFmpeg conversion error:", err);
      onStatus(`Error converting ${inputName}: ${err.message}`, "error");
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

  async function transcribe(inputFile: File) {
    if (!apiKey) {
      onStatus("Error: OpenAI API Key is not set.", "error");
      return;
    }
    setTranscribing(true);
    setTranscription("");
    const fileSizeMsg =
      inputFile.size >= 1024 * 1024
        ? (inputFile.size / (1024 * 1024)).toFixed(2) + " MB"
        : (inputFile.size / 1024).toFixed(1) + " KB";
    onStatus(`Preparing audio file... File size: ${fileSizeMsg}`, "loading");
    let mp3File = inputFile;
    if (!inputFile.name.toLowerCase().endsWith(".mp3")) {
      try {
        mp3File = await convertToMp3(inputFile);
      } catch {
        setTranscribing(false);
        return;
      }
    } else {
      const fileSizeMsg =
        inputFile.size >= 1024 * 1024
          ? (inputFile.size / (1024 * 1024)).toFixed(2) + " MB"
          : (inputFile.size / 1024).toFixed(1) + " KB";
      onStatus(`MP3 detected - no conversion needed. File size: ${fileSizeMsg}`, "info");
    }
    try {
      onStatus("Reading file data…", "loading");
      const base64 = await readFileAsBase64(mp3File);
      const body = buildOpenAIRequest(base64);
      onStatus("Sending to OpenAI…", "loading");
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
      // Calculate price if usage info is present
      let priceMsg = "";
      if (data?.usage) {
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        // See https://platform.openai.com/docs/pricing for gpt-4o-mini-audio-preview
        const inputCost = (inputTokens * 0.15) / 1_000_000;
        const outputCost = (outputTokens * 0.6) / 1_000_000;
        const totalCost = inputCost + outputCost;
        priceMsg = ` (OpenAI API cost: $${totalCost.toFixed(5)})`;
      }
      if (text) {
        setTranscription(text);
        onStatus(`Transcription complete!${priceMsg}`, "success");
        onSaveTranscription({ filename: inputFile.name, text });
      } else {
        throw new Error("Unexpected response structure.");
      }
    } catch (err: any) {
      console.error("Transcription error:", err);
      onStatus(`Error: ${err.message}`, "error");
      setTranscription(`Error: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  }

  return {
    transcription,
    setTranscription,
    transcribing,
    transcribe,
  };
}
