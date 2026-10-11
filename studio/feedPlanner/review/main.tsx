import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { parseQa } from '../qaScenario';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App qa={parseQa(window.location.search, window.location.hostname)} />
  </React.StrictMode>,
);
