import React, { useState, useRef, useEffect } from 'react';
import '../App.css'; // Assuming global styles are here

// Placeholder for a settings icon, e.g., from an icon library
const SettingsIcon = () => <span className="settings-icon">⚙️</span>; // Basic settings icon

const HomePage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sharedFileInfo, setSharedFileInfo] = useState<{ name: string; type: string } | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('Ready to transcribe.');
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptionOutputRef = useRef<HTMLDivElement>(null);

  // Effect to check for shared files via Web Share Target API on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // These are common query params for Web Share Target, but actual file handling is complex.
    const sharedTitle = params.get('title');
    const sharedText = params.get('text'); // Could be a URL to a file or direct text
    const sharedUrl = params.get('url'); // Another common param for URLs

    // This is a simplified simulation. Real Web Share Target for *files*
    // requires a service worker to handle a POST request with the file data.
    if (sharedTitle || sharedText || sharedUrl) {
      const name = sharedTitle || sharedText || sharedUrl || 'shared file';
      // We can't get the actual File object here without a service worker.
      // We'll just display info and ideally, the user would then be prompted
      // to confirm or re-select if the actual file data isn't available via the cache.
      setSharedFileInfo({ name: name, type: 'audio/unknown' }); // Type is unknown here
      setTranscriptionStatus(`Received "${name}" via share. Please confirm or select the file manually if needed.`);
      setSelectedFile(null); // Clear any manually selected file
    }
  }, []);

  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setSharedFileInfo(null); // Clear any shared file info if a new file is selected manually
      setTranscriptionStatus(`File selected: ${file.name}`);
      setTranscriptionResult(''); // Clear previous results
    }
  };

  const handleChangeSharedFile = () => {
    setSharedFileInfo(null);
    setSelectedFile(null);
    setTranscriptionStatus('Ready to transcribe.');
    handleFileSelectClick(); // Open file picker to select a new file
  };

  const handleTranscribe = async () => {
    let fileToTranscribe: File | null = selectedFile;
    let fileName = selectedFile?.name;

    if (sharedFileInfo && !selectedFile) {
      // This is where real Web Share Target handling would get the file from Cache API via service worker.
      // For this mock, we can't proceed without a File object.
      setTranscriptionStatus('Error: Cannot transcribe shared item without actual file data. Please select the file manually.');
      setIsTranscribing(false);
      return;
    }
    
    if (!fileToTranscribe) {
      setTranscriptionStatus('Error: No file selected or available to transcribe.');
      return;
    }

    fileName = fileToTranscribe.name;
    setIsTranscribing(true);
    setTranscriptionStatus(`Transcribing ${fileName}...`);
    setTranscriptionResult('');

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000)); // Simulate network delay

    // Mock response
    const success = Math.random() > 0.2; // 80% success rate
    if (success) {
      const mockText = `This is a mock transcription for the audio file named "${fileName}". It demonstrates how the transcribed text will appear. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`;
      setTranscriptionResult(mockText);
      setTranscriptionStatus(`Transcription successful for ${fileName}.`);
      setTimeout(() => {
        transcriptionOutputRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      setTranscriptionResult('');
      setTranscriptionStatus(`Error transcribing ${fileName}. Please check your connection or API key and try again.`);
    }
    setIsTranscribing(false);
  };

  const handleCopy = () => {
    if (transcriptionResult) {
      navigator.clipboard.writeText(transcriptionResult)
        .then(() => setTranscriptionStatus('Transcription copied to clipboard!'))
        .catch(err => {
            console.error('Failed to copy:', err);
            setTranscriptionStatus('Failed to copy transcription. Your browser may not support this feature or permissions may be denied.');
        });
    }
  };

  const handleShare = async () => {
    if (transcriptionResult) {
      if (navigator.share) {
        try {
          await navigator.share({
            title: `Transcription for ${selectedFile?.name || sharedFileInfo?.name || 'Audio File'}`,
            text: transcriptionResult,
          });
          setTranscriptionStatus('Transcription shared successfully!');
        } catch (error) {
          // Don't show error if user cancelled share dialog (AbortError)
          if ((error as DOMException).name !== 'AbortError') {
            console.error('Error sharing:', error);
            setTranscriptionStatus('Error sharing transcription.');
          }
        }
      } else {
        setTranscriptionStatus('Web Share API not supported. You can copy the text instead.');
        // As a fallback, we can also just re-trigger copy
        // handleCopy(); 
      }
    }
  };
  
  const getStatusColor = () => {
    const lowerStatus = transcriptionStatus.toLowerCase();
    if (lowerStatus.includes('error') || lowerStatus.includes('failed')) {
      return 'red';
    }
    if (lowerStatus.includes('successful') || lowerStatus.includes('copied') || lowerStatus.includes('shared')) {
      return 'green';
    }
    if (isTranscribing) {
      return 'orange'; // Or a specific blue for 'in progress'
    }
    return '#555'; // Default/neutral status color
  };

  return (
    <div className="PageContainer" style={{ padding: '1rem' }}>
      <header className="Header">
        <h1>Whisper Share</h1>
        <SettingsIcon />
      </header>

      <div className="file-selection-area Card" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        {sharedFileInfo && !selectedFile ? (
          <div style={{ textAlign: 'center' }}>
            <p>Received via share: <strong>{sharedFileInfo.name}</strong></p>
            <p style={{ fontSize: '0.9rem', color: '#666' }}><i>Actual file data for shared items needs to be handled by a service worker. You may need to select the file manually.</i></p>
            <button onClick={handleChangeSharedFile} className="action-button" style={{ marginTop: '0.5rem' }}>Change / Select File Manually</button>
          </div>
        ) : (
          <button onClick={handleFileSelectClick} className="action-button large-button" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
            {selectedFile ? selectedFile.name : 'Select Audio File'}
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
          accept="audio/*,video/*" // Accept common audio and video formats
        />
      </div>

      <button
        onClick={handleTranscribe}
        disabled={(!selectedFile && !sharedFileInfo) || isTranscribing} // Simplified logic for mock
        className="action-button primary-action-button large-button"
        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginBottom: '1rem' }}
      >
        {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
      </button>

      <div 
        className="status-area Card"
        style={{
            marginBottom: '1rem', 
            padding: '0.75rem', 
            borderLeft: `5px solid ${getStatusColor()}`,
            backgroundColor: '#f8f9fa', // Light background for the status
            color: getStatusColor(),
        }}>
        <p style={{ margin: 0, fontWeight: '500' }}>{transcriptionStatus}</p>
      </div>

      {transcriptionResult && (
        <div className="transcription-output Card" ref={transcriptionOutputRef} style={{ marginTop: '1rem' }}>
          <h2>Transcription Result:</h2>
          <textarea
            value={transcriptionResult}
            readOnly
            rows={12}
            style={{
              width: '100%', 
              minHeight: '200px', 
              marginBottom: '0.75rem', 
              border: '1px solid #ced4da',
              borderRadius: '4px',
              padding: '0.5rem',
              fontSize: '1rem',
              lineHeight: '1.5',
              resize: 'vertical'
            }}
            aria-label="Transcription Output"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button onClick={handleCopy} className="action-button">Copy Text</button>
            <button onClick={handleShare} className="action-button">Share Text</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
