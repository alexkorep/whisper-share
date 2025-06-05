document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveApiKeyButton = document.getElementById("saveApiKey");
  const apiKeyStatus = document.getElementById("apiKeyStatus");
  const audioFileInput = document.getElementById("audioFile");
  const transcribeButton = document.getElementById("transcribeButton");
  const transcriptionOutput = document.getElementById("transcriptionOutput");
  const statusDiv = document.getElementById("status");

  const OPENAI_API_KEY_STORAGE_KEY = "openai_api_key_transcriber";

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

  // Save API Key to localStorage
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
    const file = audioFileInput.files[0];

    if (!apiKey) {
      setStatus(
        "Error: OpenAI API Key is not set. Please save it first.",
        "error"
      );
      return;
    }

    if (!file) {
      setStatus("Error: No audio file selected.", "error");
      return;
    }

    if (
      file.type !== "audio/m4a" &&
      !file.name.toLowerCase().endsWith(".m4a")
    ) {
      setStatus("Error: Please select an M4A audio file.", "error");
      // Note: The API might still process it if it's M4A internally,
      // but this client-side check is good practice.
    }

    setStatus("Processing audio... Please wait.", "loading");
    transcribeButton.disabled = true;
    transcriptionOutput.value = "";

    try {
      const base64Audio = await readFileAsBase64(file);
      // Remove the data URL prefix (e.g., "data:audio/m4a;base64,")
      const pureBase64 = base64Audio.split(",")[1];

      const requestBody = {
        model: "gpt-4o-mini-audio-preview", // As per your curl example
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
              {
                type: "text",
                text: "", // Empty text part as per example
              },
              {
                type: "input_audio",
                input_audio: {
                  data: pureBase64,
                  format: "m4a", // Correct format for m4a files
                },
              },
            ],
          },
        ],
        // modalities: ["text"], // This field might not be needed or could be different for gpt-4o-mini.
        // The provided curl had it. Let's include it.
        // If it causes issues, try removing it.
        // Update: The example uses "gpt-4o-mini-audio-preview" which is newer
        // and might require this. Keeping it based on your curl.
        modalities: ["text"], // According to your example
        temperature: 1, // As per example
        max_completion_tokens: 16384, // As per example, can be adjusted
        top_p: 1, // As per example
        frequency_penalty: 0, // As per example
        presence_penalty: 0, // As per example
      };

      // If you want to ensure the `modalities` field is only present for models that support it,
      // you might add a check, but for gpt-4o-mini-audio-preview, it seems to be expected.
      // if (requestBody.model.includes("vision") || requestBody.model.includes("audio")) {
      //     requestBody.modalities = ["text"]; // or other relevant modalities
      // }

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
      reader.readAsDataURL(file); // Reads as Base64 encoded data URL
    });
  }

  function setStatus(message, type = "info") {
    // type can be 'info', 'success', 'error', 'loading'
    statusDiv.textContent = message;
    statusDiv.className = type; // Allows CSS to style based on status type
  }

  // Initial load
  loadApiKey();
  if (!localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY)) {
    setStatus("Please enter and save your OpenAI API Key.", "info");
  }
});

// Service Worker registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
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
