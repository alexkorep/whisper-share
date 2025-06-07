import React from 'react';

interface Props {
  sharedFile: File | null;
  setSharedFile: (f: File | null) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  transcribe: () => void;
  transcribing: boolean;
  status: string;
  statusType: 'info' | 'loading' | 'success' | 'error';
  transcription: string;
}

export default function Home({
  sharedFile,
  setSharedFile,
  file,
  setFile,
  transcribe,
  transcribing,
  status,
  statusType,
  transcription,
}: Props) {
  const copyOutput = () => {
    if (transcription) navigator.clipboard.writeText(transcription);
  };
  const shareOutput = async () => {
    if (navigator.share && transcription) {
      await navigator.share({ text: transcription });
    } else {
      copyOutput();
    }
  };
  return (
    <div className="home page">
      {!sharedFile && (
        <>
          <button className="file-button">
            <label htmlFor="audioFile">Select Audio File</label>
            <input
              type="file"
              id="audioFile"
              accept="audio/*,.m4a"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
            />
          </button>
          {file && <p className="filename">{file.name}</p>}
        </>
      )}
      {sharedFile && (
        <div id="sharedFileInfo">
          <p>
            <strong>Shared file:</strong> {sharedFile.name} ({(sharedFile.size / 1024).toFixed(1)} KB)
          </p>
          <button onClick={() => setSharedFile(null)}>Change</button>
        </div>
      )}
      <button className="primary" onClick={transcribe} disabled={transcribing || !(sharedFile || file)}>
        {transcribing ? 'Transcribing…' : 'Transcribe'}
      </button>
      <div className={`status ${statusType}`}>{status}</div>
      {transcription && (
        <div className="output">
          <textarea readOnly rows={10} value={transcription}></textarea>
          <div className="actions">
            <button onClick={copyOutput}>Copy</button>
            <button onClick={shareOutput}>Share</button>
          </div>
        </div>
      )}
    </div>
  );
}
