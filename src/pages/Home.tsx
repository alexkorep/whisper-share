import React, { useState, useRef } from 'react';

interface HomeProps {
  apiKey: string;
  setApiKey: (k: string) => void;
  apiKeyStatus: string;
  apiKeySaved: boolean;
  saveKey: () => void;
  file: File | null;
  setFile: (f: File | null) => void;
  sharedFile: File | null;
  setSharedFile: (f: File | null) => void;
  transcribe: () => void;
  transcribing: boolean;
  status: string;
  statusType: 'info' | 'loading' | 'success' | 'error';
  transcription: string;
}

const Home: React.FC<HomeProps> = ({
  apiKey,
  setApiKey,
  apiKeyStatus,
  apiKeySaved,
  saveKey,
  file,
  setFile,
  sharedFile,
  setSharedFile,
  transcribe,
  transcribing,
  status,
  statusType,
  transcription,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="home-page">
      {!apiKeySaved && (
        <div className="onboarding-card">
          <h2>Welcome to Whisper Share</h2>
          <p>Enter your OpenAI API Key to get started.</p>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="OpenAI API Key"
            autoFocus
          />
          <button onClick={saveKey}>Save & Continue</button>
          <div className="status-message">{apiKeyStatus}</div>
        </div>
      )}
      {apiKeySaved && (
        <>
          <div className="file-card">
            {!sharedFile ? (
              <>
                <button
                  className="file-select-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? `Selected: ${file.name}` : 'Select Audio File'}
                </button>
                <input
                  type="file"
                  accept="audio/*,.m4a"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                />
              </>
            ) : (
              <div className="shared-file-info">
                <p>
                  <strong>Shared file:</strong> {sharedFile.name} ({(sharedFile.size / 1024).toFixed(1)} KB)
                </p>
                <button onClick={() => setSharedFile(null)}>Change</button>
              </div>
            )}
          </div>
          <button
            className="transcribe-btn"
            onClick={transcribe}
            disabled={transcribing || (!file && !sharedFile)}
          >
            {transcribing ? 'Transcribing…' : 'Transcribe'}
          </button>
          <div className={`status-bar ${statusType}`}>{status}</div>
          {transcription && (
            <div className="transcription-output-card">
              <textarea readOnly value={transcription} rows={8} />
              <div className="output-actions">
                <button onClick={() => navigator.clipboard.writeText(transcription)}>Copy</button>
                {navigator.share && (
                  <button
                    onClick={() => navigator.share({ text: transcription })}
                  >
                    Share
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Home;
