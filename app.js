document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveApiKeyButton = document.getElementById("saveApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const audioFileInput = document.getElementById("audioFile");
  const transcribeButton = document.getElementById("transcribeButton");
  const transcriptionOutput = document.getElementById("transcriptionOutput");
  const statusDiv = document.getElementById("status");
  const sharedFileInfoDiv = document.createElement("div"); // For displaying shared file info
  sharedFileInfoDiv.id = "sharedFileInfo";
  audioFileInput.parentNode.insertBefore(
    sharedFileInfoDiv,
    audioFileInput.nextSibling
  );

  const OPENAI_API_KEY_STORAGE_KEY = "openai_api_key_transcriber";
  const SHARED_FILES_CACHE_NAME_CLIENT =
    "audio-transcriber-pwa-shared-files-v1"; // Must match SW
  let sharedFileFromCache = null; // To store the File object retrieved from share target

  // Load API Key from localStorage
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
      // Check for 'error' too
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
            setStatus(
              "Error: Cache API not available to retrieve shared file.",
              "error"
            );
            return;
          }
          const cache = await caches.open(SHARED_FILES_CACHE_NAME_CLIENT);
          const response = await cache.match("latest-shared-audio");

          if (response) {
            const originalFilename = decodeURIComponent(
              response.headers.get("X-Original-Filename") || "shared_audio.m4a"
            );
            const contentType =
              response.headers.get("Content-Type") || "audio/m4a";
            const audioBlob = await response.blob();

            sharedFileFromCache = new File([audioBlob], originalFilename, {
              type: contentType,
            });

            // We can't set the value of a file input programmatically for security reasons.
            // So, we'll display info about the shared file and use sharedFileFromCache directly.
            audioFileInput.style.display = "none"; // Hide the original file input
            sharedFileInfoDiv.innerHTML = `
                            <p><strong>Shared file loaded:</strong> ${
                              sharedFileFromCache.name
                            } (${(sharedFileFromCache.size / 1024).toFixed(
              2
            )} KB)</p>
                            <button id="clearSharedFile">Choose a different file</button>
                        `;
            document
              .getElementById("clearSharedFile")
              .addEventListener("click", () => {
                sharedFileFromCache = null;
                audioFileInput.value = ""; // Clear file input
                audioFileInput.style.display = "block";
                sharedFileInfoDiv.innerHTML = "";
                setStatus("Shared file cleared. Select a new file.", "info");
              });

            setStatus(
              `Shared file "${sharedFileFromCache.name}" loaded. Ready to transcribe.`,
              "success"
            );
            await cache.delete("latest-shared-audio"); // Clean up the cache
            console.log(
              "Shared file loaded from cache and cache entry deleted."
            );
          } else {
            setStatus(
              "No shared file found in cache. It might have been processed already or failed to save.",
              "error"
            );
          }
        } catch (error) {
          console.error("Error retrieving shared file from cache:", error);
          setStatus(`Error retrieving shared file: ${error.message}`, "error");
        }
      }
      // Clean the URL (remove ?shared=true or ?error=...) without reloading
      const cleanUrl = window.location.pathname + window.location.hash;
      history.replaceState(null, "", cleanUrl);
    }
  }

  transcribeButton.addEventListener("click", async () => {
    const apiKey = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    let fileToTranscribe = null;

    if (sharedFileFromCache) {
      fileToTranscribe = sharedFileFromCache;
      setStatus(`Using shared file: ${fileToTranscribe.name}`, "info");
    } else if (audioFileInput.files[0]) {
      fileToTranscribe = audioFileInput.files[0];
    }

    if (!apiKey) {
      setStatus(
        "Error: OpenAI API Key is not set. Please save it first.",
        "error"
      );
      return;
    }

    if (!fileToTranscribe) {
      setStatus("Error: No audio file selected or shared.", "error");
      return;
    }

    if (
      !fileToTranscribe.type.startsWith("audio/m4a") &&
      !fileToTranscribe.name.toLowerCase().endsWith(".m4a")
    ) {
      // The API might be more lenient, but this is a client-side check
      console.warn(
        "Warning: Selected file may not be M4A, but attempting transcription.",
        fileToTranscribe.type,
        fileToTranscribe.name
      );
      // Allow if it's audio/* for broader compatibility, as share target might give generic audio type
      if (!fileToTranscribe.type.startsWith("audio/")) {
        setStatus(
          "Error: Please select an M4A or compatible audio file.",
          "error"
        );
        return;
      }
    }

    setStatus("Processing audio... Please wait.", "loading");
    transcribeButton.disabled = true;
    transcriptionOutput.value = "";

    try {
      const base64Audio = await readFileAsBase64(fileToTranscribe);
      const pureBase64 = base64Audio.split(",")[1];

      const requestBody = {
        model: "gpt-4o-mini-audio-preview",
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text: "Transcribe an audio file into text in the Russian language.\n\n# Steps\n\n1. Listen to the audio file carefully.\n2. Transcribe the spoken words into written text without altering the spoken content.\n3. Pay attention to grammatical nuances and punctuation in Russian.\n4. If specific terms, jargon, or unintelligible segments occur, note these with time-stamps if possible.\n\n# Output Format\n\n- The transcription should be provided as plain text, in Russian.\n- Ensure correct use of punctuation and capitalization according to Russian grammar rules.\n\n# Notes\n\n- If any portion of the audio is unclear, mark it as [unintelligible] and provide the timestamp.\n- Ensure the transcription is accurate and reflects the original speech faithfully.",
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "text", text: "" },
              {
                type: "input_audio",
                input_audio: { data: pureBase64, format: "m4a" },
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
        data.choices.length > 0 &&
        data.choices[0].message &&
        data.choices[0].message.content
      ) {
        const transcript = data.choices[0].message.content;
        transcriptionOutput.value = transcript;
        setStatus("Transcription successful!", "success");
      } else {
        console.error("Unexpected API response structure:", data);
        setStatus(
          "Error: Could not extract transcription from API response. Check console.",
          "error"
        );
      }
    } catch (error) {
      console.error("Transcription error:", error);
      setStatus(`Error: ${error.message}`, "error");
      transcriptionOutput.value = `Error during transcription: ${error.message}`;
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
  }

  // Initial load
  loadApiKey();
  handleSharedFile(); // Check for shared files on load
  if (
    !localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) &&
    !sharedFileFromCache
  ) {
    setStatus("Please enter and save your OpenAI API Key.", "info");
  }

  // Service Worker registration
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js", {
          scope: `/${GH_PAGES_SUBDIRECTORY_NO_SLASH}/`,
        }) // Explicit scope
        .then((registration) => {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope
          );
        })
        .catch((error) => {
          console.log("ServiceWorker registration failed: ", error);
        });
    });
  }
});
