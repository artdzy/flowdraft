import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './credit.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LegalPage, legalKindFromPath } from './legal/LegalPage';
import { loadDraft } from './lib/draft';
import { initAuth } from './store/auth';
import { useEditor } from './store/editor';

const legal = legalKindFromPath(window.location.pathname);

if (!legal) {
  const draft = loadDraft();
  if (draft) {
    useEditor.getState().loadDoc(draft.doc, { title: draft.title, projectId: draft.projectId, dirty: draft.dirty });
  }
  initAuth();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{legal ? <LegalPage kind={legal} /> : <App />}</StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional.
    });
  });
}
