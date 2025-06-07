import React, { useState } from 'react';

interface SettingsProps {
  apiKey: string;
  setApiKey: (k: string) => void;
  apiKeyStatus: string;
  saveKey: () => void;
}

const Settings: React.FC<SettingsProps> = ({ apiKey, setApiKey, apiKeyStatus, saveKey }) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div className="api-key-section">
        <label>OpenAI API Key</label>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="OpenAI API Key"
        />
        <button onClick={() => setShowKey(v => !v)}>{showKey ? 'Hide' : 'Show'} Key</button>
        <button onClick={saveKey}>Save</button>
        <div className="status-message">{apiKeyStatus}</div>
      </div>
      <div className="about-section">
        <h3>About</h3>
        <p>Whisper Share v1.0</p>
        <p>All processing is local except transcription (OpenAI API).</p>
      </div>
    </div>
  );
};

export default Settings;
