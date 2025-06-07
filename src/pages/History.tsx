import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const cancelDelete = () => {
    setDeleteId(null);
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
            <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'space-between' }}>
              <Box>
                <Button variant="outlined" onClick={() => onCopy(entry.text)}>
                  Copy
                </Button>
                {'share' in navigator && typeof navigator.share === 'function' && (
                  <Button variant="outlined" onClick={() => handleShare(entry)} sx={{ ml: 1 }}>
                    Share
                  </Button>
                )}
              </Box>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDelete(entry.id)}
                sx={{ ml: 'auto' }}
              >
                Delete
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ))}
      <Dialog open={!!deleteId} onClose={cancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this entry? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default History;
