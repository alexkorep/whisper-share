import React, { useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  Stack,
} from '@mui/material';

interface HomeProps {
  apiKey: string;
  setApiKey: (k: string) => void;
  apiKeyStatus: string;
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

  const alertSeverity =
    statusType === 'error'
      ? 'error'
      : statusType === 'success'
      ? 'success'
      : 'info';

  return (
    <Box className="home-page">
      {!apiKey && (
        <Card className="onboarding-card">
          <CardContent>
            <Typography variant="h5" gutterBottom>
              Welcome to Whisper Share
            </Typography>
            <Typography sx={{ mb: 2 }}>
              Enter your OpenAI API Key to get started.
            </Typography>
            <TextField
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              label="OpenAI API Key"
              fullWidth
              autoFocus
              margin="dense"
            />
            <Button variant="contained" fullWidth sx={{ mt: 1 }} onClick={saveKey}>
              Save & Continue
            </Button>
            <Typography variant="body2" className="status-message" sx={{ mt: 1 }}>
              {apiKeyStatus}
            </Typography>
          </CardContent>
        </Card>
      )}
      {apiKey && (
        <>
          <Card className="file-card" sx={{ mb: 2 }}>
            <CardContent>
              {!sharedFile ? (
                <>
                  <Button
                    variant="contained"
                    component="label"
                    className="file-select-btn"
                  >
                    {file ? `Selected: ${file.name}` : 'Select Audio File'}
                    <input
                      type="file"
                      accept="audio/*,.m4a"
                      hidden
                      ref={fileInputRef}
                      onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                    />
                  </Button>
                </>
              ) : (
                <Box className="shared-file-info">
                  <Typography>
                    <strong>Shared file:</strong> {sharedFile.name} ({(sharedFile.size / 1024).toFixed(1)} KB)
                  </Typography>
                  <Button onClick={() => setSharedFile(null)}>Change</Button>
                </Box>
              )}
            </CardContent>
          </Card>
          <Stack spacing={2}>
            <Button
              variant="contained"
              onClick={transcribe}
              disabled={transcribing || (!file && !sharedFile)}
            >
              {transcribing ? 'Transcribing…' : 'Transcribe'}
            </Button>
            <Alert severity={alertSeverity}>{status}</Alert>
          </Stack>
          {transcription && (
            <Card className="transcription-output-card" sx={{ mt: 2 }}>
              <CardContent>
                <TextField
                  multiline
                  rows={8}
                  fullWidth
                  value={transcription}
                  InputProps={{ readOnly: true }}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 1 }} className="output-actions">
                  <Button
                    variant="outlined"
                    onClick={() => navigator.clipboard.writeText(transcription)}
                  >
                    Copy
                  </Button>
                  {navigator.share && (
                    <Button variant="outlined" onClick={() => navigator.share({ text: transcription })}>
                      Share
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};

export default Home;
