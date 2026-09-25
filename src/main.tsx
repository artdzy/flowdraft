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
import { isGuidePath, McpGuidePage } from './guide/McpGuidePage';
import { ConsentPage, isConsentPath } from './oauth/ConsentPage';
import { lang } from './i18n';
import { initAuth } from './store/auth';
import { useEditor } from './store/editor';
import { initTheme } from './store/theme';

document.documentElement.lang = lang;
initTheme();
const path = window.location.pathname;
const legal = legalKindFromPath(path);
const consent = isConsentPath(path);
const guide = isGuidePath(path);
const editor = !legal && !consent && !guide;

if (editor) {
  const draft = loadDraft();
  if (draft) {
    useEditor.getState().loadDoc(draft.doc, { title: draft.title, projectId: draft.projectId, dirty: draft.dirty });
  }
}
if (editor || consent) initAuth();

function Page() {
  if (legal) return <LegalPage kind={legal} />;
  if (consent) return <ConsentPage />;
  if (guide) return <McpGuidePage />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is optional.
    });
  });
}
