import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
} from '@mui/material';

interface HistoryEntry {
  id: string;
  filename: string;
  text: string;
  date: string;
}


interface HistoryProps {
  history: HistoryEntry[];
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
}


const History: React.FC<HistoryProps> = ({ history, onCopy, onDelete }) => {
  // Share handler for Web Share API
  const handleShare = (entry: HistoryEntry) => {
    if (navigator.share) {
      navigator.share({
        title: entry.filename || 'Transcription',
        text: entry.text,
      });
    } else {
      alert('Web Share API is not supported in this browser.');
    }
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" gutterBottom>
        History
      </Typography>
      {history.length === 0 && (
        <Typography>No transcriptions yet.</Typography>
      )}
      {history.map(entry => (
        <Card key={entry.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
              <Typography component="span" fontWeight="bold">
                {entry.filename || 'Untitled'}
              </Typography>
              <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12 }}>
                {new Date(entry.date).toLocaleString()}
              </Typography>
            </Box>
            <TextField
              multiline
              rows={4}
              fullWidth
              value={entry.text}
              InputProps={{ readOnly: true }}
              sx={{ mt: 1 }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Button variant="outlined" onClick={() => onCopy(entry.text)}>
                Copy
              </Button>
              <Button variant="outlined" onClick={() => onDelete(entry.id)}>
                Delete
              </Button>
              {'share' in navigator && typeof navigator.share === 'function' && (
                <Button variant="outlined" onClick={() => handleShare(entry)}>
                  Share
                </Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};

export default History;
