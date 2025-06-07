import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../style.css';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

const theme = createTheme();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
