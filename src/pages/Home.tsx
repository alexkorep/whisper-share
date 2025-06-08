import React, { useRef } from 'react';
import { Radio, RadioGroup, FormControlLabel, FormControl, FormLabel } from '@mui/material';
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
  apiKeySaved: boolean;
  file: File | null;
  setFile: (f: File | null) => void;
  sharedFile: File | null;
  setSharedFile: (f: File | null) => void;
  transcribe: () => void;
  transcribing: boolean;
  status: string;
  statusType: "info" | "loading" | "success" | "error";
  transcription: string;
  selectedApi: string;
  setSelectedApi: (api: string) => void;
}

const Home: React.FC<HomeProps> = ({
  apiKey,
  setApiKey,
  apiKeyStatus,
  saveKey,
  apiKeySaved,
  file,
  setFile,
  sharedFile,
  setSharedFile,
  transcribe,
  transcribing,
  status,
  statusType,
  transcription,
  selectedApi,
  setSelectedApi,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const alertSeverity =
    statusType === 'error'
      ? 'error'
      : statusType === 'success'
      ? 'success'
      : 'info';

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {!apiKeySaved && (
        <Card sx={{ mb: 2 }}>
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
            <Typography variant="body2" sx={{ mt: 1 }}>
              {apiKeyStatus}
            </Typography>
          </CardContent>
        </Card>
      )}
      {apiKey && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">Transcription API</FormLabel>
                <RadioGroup
                  row
                  value={selectedApi}
                  onChange={e => setSelectedApi(e.target.value)}
                  name="transcription-api"
                >
                  <FormControlLabel value="gpt4o" control={<Radio />} label="GPT-4o" />
                  <FormControlLabel value="whisper" control={<Radio />} label="Whisper API" />
                </RadioGroup>
              </FormControl>
              {!sharedFile ? (
                <>
                  <Button
                    variant="contained"
                    component="label"
                  >
                    {file
                      ? `Selected: ${file.name} (${file.size >= 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : (file.size / 1024).toFixed(1) + ' KB'})`
                      : 'Select Audio File'}
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
                <Box sx={{ mt: 1, mb: 1, p: 1, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography>
                    <strong>Shared file:</strong> {sharedFile.name} ({sharedFile.size >= 1024 * 1024 ? (sharedFile.size / (1024 * 1024)).toFixed(2) + ' MB' : (sharedFile.size / 1024).toFixed(1) + ' KB'})
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
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <TextField
                  multiline
                  rows={8}
                  fullWidth
                  value={transcription}
                  InputProps={{ readOnly: true }}
                />
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
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
