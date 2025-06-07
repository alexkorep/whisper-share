import React from 'react';

interface HistoryEntry {
  id: string;
  filename: string;
  text: string;
  date: string;
}

interface Props {
  history: HistoryEntry[];
  deleteHistory: (id: string) => void;
}

export default function History({ history, deleteHistory }: Props) {
  if (history.length === 0) {
    return <p className="empty">No history yet.</p>;
  }
  return (
    <div className="history page">
      {history.map((entry) => (
        <div className="history-entry" key={entry.id}>
          <div className="history-meta">
            <strong>{entry.filename}</strong>
            <span>{new Date(entry.date).toLocaleString()}</span>
          </div>
          <textarea readOnly rows={4} value={entry.text}></textarea>
          <div className="actions">
            <button onClick={() => navigator.clipboard.writeText(entry.text)}>Copy</button>
            <button onClick={() => deleteHistory(entry.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
