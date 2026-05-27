import React from 'react';
import { createRoot } from 'react-dom/client';
import 'highlight.js/styles/github-dark.css';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element not found');
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
