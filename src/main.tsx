import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@xyflow/react/dist/style.css';
import './styles.css';
import './credit.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AdminPage, isAdminPath } from './admin/AdminPage';
import { LegalPage, legalKindFromPath } from './legal/LegalPage';
import { loadDraft } from './lib/draft';
import { isGuidePath, McpGuidePage } from './guide/McpGuidePage';
import { ConsentPage, isConsentPath } from './oauth/ConsentPage';
import { isProfilePath, ProfilePage } from './profile/ProfilePage';
import { isPromoPath, PromoPage } from './promo/PromoPage';
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
const promo = isPromoPath(path);
const admin = isAdminPath(path);
const profile = isProfilePath(path);
const editor = !legal && !consent && !guide && !promo && !admin && !profile;

if (editor) {
  const draft = loadDraft();
  if (draft) {
    useEditor.getState().loadDoc(draft.doc, { title: draft.title, projectId: draft.projectId, dirty: draft.dirty });
  }
}
if (editor || consent || admin || profile) initAuth();

function Page() {
  if (legal) return <LegalPage kind={legal} />;
  if (consent) return <ConsentPage />;
  if (guide) return <McpGuidePage />;
  if (promo) return <PromoPage />;
  if (admin) return <AdminPage />;
  if (profile) return <ProfilePage />;
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
