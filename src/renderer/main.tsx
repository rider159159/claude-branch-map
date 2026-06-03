import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/noto-sans-tc/400.css';
import '@fontsource/noto-sans-tc/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './hljs-github-dark.css';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
