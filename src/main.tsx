import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Self-hosted (no Google Fonts): no render-blocking third-party request,
// and the site still works where Google is blocked.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import './index.css';
import App from './App.tsx';
import { loadDataset } from './stores/loadDataset';

// Start both downloads before React renders: the dataset and the Pixi chunk
// arrive in parallel instead of one after the other.
void loadDataset();
void import('./render/StarfieldRenderer');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
