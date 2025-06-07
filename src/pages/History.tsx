import React from 'react';

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
  return (
    <div className="history-page">
      <h2>History</h2>
      {history.length === 0 && <div className="empty-history">No transcriptions yet.</div>}
      {history.map(entry => (
        <div className="history-entry-card" key={entry.id}>
          <div className="history-meta">
            <strong>{entry.filename || 'Untitled'}</strong>
            <span className="history-date">{new Date(entry.date).toLocaleString()}</span>
          </div>
          <textarea readOnly rows={4} value={entry.text}></textarea>
          <div className="history-actions">
            <button onClick={() => onCopy(entry.text)}>Copy</button>
            <button onClick={() => onDelete(entry.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default History;
