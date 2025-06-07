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
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" gutterBottom>
        Settings
      </Typography>
      <Card sx={{ mb: 2 }}>
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
          <Typography variant="body2" sx={{ mt: 1 }}>
            {apiKeyStatus}
          </Typography>
        </CardContent>
      </Card>
      <Card sx={{ mt: 2 }}>
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
