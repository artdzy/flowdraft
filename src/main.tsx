import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './credit.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadDraft } from './lib/draft';
import { initAuth } from './store/auth';
import { useEditor } from './store/editor';

const draft = loadDraft();
if (draft) {
  useEditor.getState().loadDoc(draft.doc, { title: draft.title, projectId: draft.projectId, dirty: draft.dirty });
}
initAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional.
    });
  });
}
