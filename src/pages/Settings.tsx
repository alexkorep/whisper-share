import React from 'react';

interface Props {
  apiKey: string;
  setApiKey: (k: string) => void;
  saveKey: () => void;
}

export default function Settings({ apiKey, setApiKey, saveKey }: Props) {
  const removeKey = () => {
    setApiKey('');
    localStorage.removeItem('openai_api_key_transcriber');
  };
  return (
    <div className="settings page">
      <h2>API Key</h2>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="OpenAI API Key"
      />
      <button onClick={saveKey}>Save</button>
      <button onClick={removeKey}>Remove</button>
      <h2>About</h2>
      <p>Whisper Share lets you transcribe audio using OpenAI.</p>
    </div>
  );
}
