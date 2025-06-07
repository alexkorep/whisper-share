import React, { useState } from 'react';

interface ApiKeyPageProps {
  onApiKeySave: (apiKey: string) => void;
}

const ApiKeyPage: React.FC<ApiKeyPageProps> = ({ onApiKeySave }) => {
  const [keyValue, setKeyValue] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSave = () => {
    if (!keyValue.trim()) {
      setError('API Key cannot be empty.');
      setSuccessMessage('');
      return;
    }
    // Add any other validation for the API key if needed
    setError('');
    onApiKeySave(keyValue);
    setSuccessMessage('API Key saved successfully!');
    // Optionally clear the key from view after saving, or navigate away
    // setKeyValue(''); 
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>Setup Your OpenAI API Key</h1>
      <p>
        To use Whisper Share, you need an API key from OpenAI. This key will be
        stored securely in your browser&apos;s local storage.
        <a href="https://openai.com/blog/openai-api" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '5px' }}>
          Learn more
        </a>
      </p>
      <input
        type="password"
        value={keyValue}
        onChange={(e) => {
          setKeyValue(e.target.value);
          setError(''); // Clear error when user starts typing
          setSuccessMessage(''); // Clear success message
        }}
        placeholder="Enter your OpenAI API Key"
        style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
      />
      <button
        onClick={handleSave}
        style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Save & Continue
      </button>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      {successMessage && <p style={{ color: 'green', marginTop: '10px' }}>{successMessage}</p>}
    </div>
  );
};

export default ApiKeyPage;
