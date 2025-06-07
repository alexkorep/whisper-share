import React, { useState, useEffect } from 'react';

interface SettingsPageProps {
  currentApiKey: string | null;
  onApiKeyUpdate: (newApiKey: string) => void;
  onApiKeyRemove: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ currentApiKey, onApiKeyUpdate, onApiKeyRemove }) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');

  useEffect(() => {
    if (currentApiKey) {
      setApiKeyInput(currentApiKey);
    }
  }, [currentApiKey]);

  const handleUpdateKey = () => {
    if (!apiKeyInput.trim()) {
      setUpdateStatus('API Key cannot be empty.');
      return;
    }
    onApiKeyUpdate(apiKeyInput);
    setUpdateStatus('API Key updated successfully!');
    setTimeout(() => setUpdateStatus(''), 3000); // Clear message after 3 seconds
  };

  const handleRemoveKey = () => {
    onApiKeyRemove();
    setApiKeyInput(''); // Clear the input field
    setUpdateStatus('API Key removed.');
     setTimeout(() => setUpdateStatus(''), 3000);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Settings</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2>API Key Management</h2>
        <input
          type={showApiKey ? 'text' : 'password'}
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="Enter new API Key"
          style={{ padding: '8px', marginRight: '10px', minWidth: '250px' }}
        />
        <button onClick={() => setShowApiKey(!showApiKey)} style={{ marginRight: '10px' }}>
          {showApiKey ? 'Hide' : 'Show'} Key
        </button>
        <br />
        <button onClick={handleUpdateKey} style={{ marginTop: '10px', marginRight: '10px', backgroundColor: 'green', color: 'white' }}>
          Update API Key
        </button>
        <button onClick={handleRemoveKey} style={{ marginTop: '10px', backgroundColor: 'red', color: 'white' }}>
          Remove API Key
        </button>
        {updateStatus && <p style={{ marginTop: '10px', color: updateStatus.includes('successfully') ? 'green' : 'red' }}>{updateStatus}</p>}
      </section>

      <section>
        <h2>About</h2>
        <p>App Version: 1.0.0 (Redesign)</p>
        <p>Privacy Info: Your API key is stored locally in your browser and is only used to communicate with the OpenAI API.</p>
        {/* Add more links or info as needed */}
      </section>
    </div>
  );
};

export default SettingsPage;
