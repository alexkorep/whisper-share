import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
} from '@mui/material';

interface SettingsProps {
  apiKey: string;
  setApiKey: (k: string) => void;
  apiKeyStatus: string;
  saveKey: () => void;
}

const Settings: React.FC<SettingsProps> = ({ apiKey, setApiKey, apiKeyStatus, saveKey }) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <Box className="settings-page">
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>
      <Card className="api-key-section">
        <CardContent>
          <Typography gutterBottom>OpenAI API Key</Typography>
          <TextField
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="OpenAI API Key"
            fullWidth
            margin="dense"
          />
          <Button fullWidth variant="outlined" onClick={() => setShowKey(v => !v)}>
            {showKey ? 'Hide' : 'Show'} Key
          </Button>
          <Button fullWidth variant="contained" sx={{ mt: 1 }} onClick={saveKey}>
            Save
          </Button>
          <Typography variant="body2" className="status-message" sx={{ mt: 1 }}>
            {apiKeyStatus}
          </Typography>
        </CardContent>
      </Card>
      <Card className="about-section">
        <CardContent>
          <Typography variant="h6" gutterBottom>About</Typography>
          <Typography>Whisper Share v1.0</Typography>
          <Typography>All processing is local except transcription (OpenAI API).</Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Settings;
