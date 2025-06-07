import React from 'react';

interface Props {
  apiKey: string;
  setApiKey: (k: string) => void;
  saveKey: () => void;
  apiKeyStatus: string;
}

export default function Onboarding({ apiKey, setApiKey, saveKey, apiKeyStatus }: Props) {
  return (
    <div className="onboarding">
      <h1>Whisper Share</h1>
      <p>Enter your OpenAI API key to continue.</p>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="OpenAI API Key"
      />
      <button onClick={saveKey}>Save &amp; Continue</button>
      <p className="status-message">{apiKeyStatus}</p>
    </div>
  );
}
