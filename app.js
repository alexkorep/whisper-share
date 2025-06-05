// No top-level import for ffmpeg/ffmpeg anymore, it's loaded globally via script tag in index.html

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveApiKeyButton = document.getElementById("saveApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const audioFileInput = document.getElementById("audioFile");
  const transcribeButton = document.getElementById("transcribeButton");
  const transcriptionOutput = document.getElementById("transcriptionOutput");
  const statusDiv = document.getElementById("status");
  const sharedFileInfoDiv = document.createElement("div");
  sharedFileInfoDiv.id = "sharedFileInfo";
  if (audioFileInput.parentNode) {
    audioFileInput.parentNode.insertBefore(
      sharedFileInfoDiv,
      audioFileInput.nextSibling
    );
  }

  const OPENAI_API_KEY_STORAGE_KEY = "openai_api_key_transcriber";
  const SHARED_FILES_CACHE_NAME_CLIENT =
    "audio-transcriber-pwa-shared-files-v1";
  let sharedFileFromCache = null;

  // FFMPEG setup using the global window.FFmpeg
  let ffmpegInstance = null;
  let ffmpegLoaded = false;
  const { fetchFile } = window.FFmpeg; // Destructure fetchFile from the global

  async function ensureFFmpegLoaded() {
    if (!ffmpegLoaded && window.FFmpeg) {
      setStatus(
        "Loading FFMPEG conversion engine (core ~30MB, one-time download)...",
        "loading"
      );
      try {
        ffmpegInstance = new window.FFmpeg.FFmpeg(); // Create new instance
        ffmpegInstance.on("log", ({ type, message }) => {
          // Listen to log events
          console.log(`FFMPEG [${type}]: ${message}`);
        });
        await ffmpegInstance.load({
          coreURL:
            "https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd/ffmpeg-core.js",
          wasmURL:
            "https://unpkg.com/@ffmpeg/core@0.12.9/dist/umd/ffmpeg-core.wasm",
        });
        ffmpegLoaded = true;
        setStatus("FFMPEG engine loaded.", "success");
      } catch (error) {
        console.error("FFMPEG loading failed:", error);
        setStatus(
          "Error: FFMPEG engine failed to load. Conversion not possible.",
          "error"
        );
        ffmpegInstance = null; // Ensure instance is null on failure
        throw error;
      }
    } else if (!window.FFmpeg) {
      const errMsg =
        "Error: FFMPEG library not found. Check script tag in HTML.";
      console.error(errMsg);
      setStatus(errMsg, "error");
      throw new Error(errMsg);
    }
  }

  async function convertToMp3(inputFile) {
    if (!ffmpegInstance || !ffmpegLoaded) {
      await ensureFFmpegLoaded(); // This will throw if it fails
    }
    setStatus(
      `Converting "${inputFile.name}" to MP3... Please wait.`,
      "loading"
    );

    const inputFileName = inputFile.name || "inputfile";
    const outputFileName = "output.mp3";

    try {
      // Write the file to FFMPEG's virtual file system
      await ffmpegInstance.writeFile(inputFileName, await fetchFile(inputFile));

      // Run the FFMPEG command
      // Using exec for v0.11+
      // For v0.12: ff.exec([...])
      // For v0.10 or older: ff.run('-i', inputFileName, outputFileName);
      await ffmpegInstance.exec(["-i", inputFileName, outputFileName]);

      // Read the result
      const data = await ffmpegInstance.readFile(outputFileName);

      // Clean up files (optional, but good practice if processing many files)
      await ffmpegInstance.deleteFile(inputFileName);
      await ffmpegInstance.deleteFile(outputFileName);

      setStatus(
        `Conversion of "${inputFile.name}" to MP3 successful.`,
        "success"
      );
      return new File([data.buffer], "converted.mp3", { type: "audio/mpeg" });
    } catch (error) {
      console.error("Error during FFMPEG conversion:", error);
      setStatus(
        `Error converting "${inputFile.name}" to MP3: ${error.message}`,
        "error"
      );
      // Attempt to clean up
      try {
        await ffmpegInstance.deleteFile(inputFileName);
      } catch (e) {
        /* ignore */
      }
      try {
        await ffmpegInstance.deleteFile(outputFileName);
      } catch (e) {
        /* ignore */
      }
      throw error;
    }
  }

  function loadApiKey() {
    const storedKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (storedKey) {
      apiKeyInput.value = storedKey;
      apiKeyStatus.textContent = "API Key loaded from storage.";
      apiKeyStatus.className = "status-message success";
    } else {
      apiKeyStatus.textContent = "API Key not set. Please enter and save.";
      apiKeyStatus.className = "status-message error";
    }
  }

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

  async function handleSharedFile() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("shared") || urlParams.has("error")) {
      if (urlParams.has("error")) {
        const errorType = urlParams.get("error");
        setStatus(
          `Error during share: ${errorType}. Please try again.`,
          "error"
        );
      }
      if (urlParams.has("shared")) {
        setStatus("Attempting to load shared file...", "loading");
        try {
          if (!("caches" in window)) {
            setStatus("Error: Cache API not available.", "error");
            return;
          }
          const cache = await caches.open(SHARED_FILES_CACHE_NAME_CLIENT);
          const response = await cache.match("latest-shared-audio");
          if (response) {
            const originalFilename = decodeURIComponent(
              response.headers.get("X-Original-Filename") || "shared_audio.file"
            );
            const contentType =
              response.headers.get("Content-Type") ||
              "application/octet-stream";
            const audioBlob = await response.blob();
            sharedFileFromCache = new File([audioBlob], originalFilename, {
              type: contentType,
            });
            audioFileInput.style.display = "none";
            sharedFileInfoDiv.innerHTML = `
                            <p><strong>Shared file loaded:</strong> ${
                              sharedFileFromCache.name
                            } (${(sharedFileFromCache.size / 1024).toFixed(
              2
            )} KB)</p>
                            <button id="clearSharedFile">Choose a different file</button>`;
            document
              .getElementById("clearSharedFile")
              .addEventListener("click", () => {
                sharedFileFromCache = null;
                audioFileInput.value = "";
                audioFileInput.style.display = "block";
                sharedFileInfoDiv.innerHTML = "";
                setStatus("Shared file cleared.", "info");
              });
            setStatus(
              `Shared file "${sharedFileFromCache.name}" loaded.`,
              "success"
            );
            await cache.delete("latest-shared-audio");
          } else {
            setStatus("No shared file found in cache.", "info");
          }
        } catch (error) {
          console.error("Error retrieving shared file:", error);
          setStatus(`Error retrieving shared file: ${error.message}`, "error");
        }
      }
      const cleanUrl = window.location.pathname + window.location.hash;
      history.replaceState(null, "", cleanUrl);
    }
  }

  transcribeButton.addEventListener("click", async () => {
    const apiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    let fileToProcess = null;

    if (sharedFileFromCache) {
      fileToProcess = sharedFileFromCache;
    } else if (audioFileInput.files[0]) {
      fileToProcess = audioFileInput.files[0];
    }

    if (!apiKey) {
      setStatus("Error: OpenAI API Key is not set.", "error");
      return;
    }
    if (!fileToProcess) {
      setStatus("Error: No audio file selected or shared.", "error");
      return;
    }

    setStatus("Preparing audio file...", "loading");
    transcribeButton.disabled = true;
    transcriptionOutput.value = "";

    let finalFileForApi;
    const isMp3 =
      fileToProcess.type === "audio/mpeg" ||
      fileToProcess.name.toLowerCase().endsWith(".mp3");

    if (isMp3) {
      finalFileForApi = fileToProcess;
      setStatus("MP3 file detected. No conversion needed.", "info");
    } else {
      try {
        finalFileForApi = await convertToMp3(fileToProcess);
      } catch (conversionError) {
        transcribeButton.disabled = false;
        return;
      }
    }

    setStatus("Reading file data for API...", "loading");
    try {
      const base64Audio = await readFileAsBase64(finalFileForApi);
      const pureBase64 = base64Audio.split(",")[1];

      const requestBody = {
        model: "gpt-4o-mini-audio-preview",
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: "Transcribe an audio file into text in the Russian language.\n\n# Steps...\n\n# Output Format...\n\n# Notes...", // Your system prompt
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "text", text: "" },
              {
                type: "input_audio",
                input_audio: { data: pureBase64, format: "mp3" },
              },
            ],
          },
        ],
        modalities: ["text"],
        temperature: 1,
        max_completion_tokens: 16384,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      };

      setStatus("Sending to OpenAI for transcription...", "loading");
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: "Unknown API error structure" } }));
        throw new Error(
          `API Error (${response.status}): ${
            errorData.error?.message || response.statusText
          }`
        );
      }
      const data = await response.json();

      if (
        data.choices &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        transcriptionOutput.value = data.choices[0].message.content;
        setStatus("Transcription successful!", "success");
      } else {
        console.error("Unexpected API response structure:", data);
        setStatus(
          "Error: Could not extract transcription from API response.",
          "error"
        );
      }
    } catch (error) {
      console.error("Transcription process error:", error);
      setStatus(`Error: ${error.message}`, "error");
      transcriptionOutput.value = `Error: ${error.message}`;
    } finally {
      transcribeButton.disabled = false;
    }
  });

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function setStatus(message, type = "info") {
    statusDiv.textContent = message;
    statusDiv.className = type;
    console.log(`Status [${type}]: ${message}`);
  }

  loadApiKey();
  handleSharedFile();
  if (
    !localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) &&
    !sharedFileFromCache
  ) {
    setStatus("Please enter and save your OpenAI API Key.", "info");
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const GH_PAGES_SUBDIRECTORY_NO_SLASH = "whisper-share";
      navigator.serviceWorker
        .register("./service-worker.js", {
          scope: `/${GH_PAGES_SUBDIRECTORY_NO_SLASH}/`,
        })
        .then((registration) =>
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope
          )
        )
        .catch((error) =>
          console.log("ServiceWorker registration failed: ", error)
        );
    });
  }
});
