import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useSyncExternalStore } from 'react';
import { AiDialog } from './components/AiDialog';
import { AuthModal } from './components/AuthModal';
import { Canvas } from './components/Canvas';
import { Credit } from './components/Credit';
import { ConfirmDialog, NewDialog, ProjectsDialog, Toasts } from './components/Dialogs';
import { Inspector } from './components/Inspector';
import { MobileBar } from './components/MobileBar';
import { Palette } from './components/Palette';
import { PromoDialog } from './components/PromoDialog';
import { TopBar } from './components/TopBar';
import { t, UNTITLED } from './i18n';
import { openProjectLink, refreshFromCloud, requestSave, saveToCloud } from './lib/actions';
import { saveDraft } from './lib/draft';
import { serializeDoc } from './lib/doc';
import { useAuth } from './store/auth';
import { isDirty, useEditor } from './store/editor';
import { useSettings } from './store/settings';

const mobileQuery = window.matchMedia('(max-width: 960px)');
const subscribeMobile = (cb: () => void) => {
  mobileQuery.addEventListener('change', cb);
  return () => mobileQuery.removeEventListener('change', cb);
};

function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => mobileQuery.matches);
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        requestSave();
        return;
      }
      if (isTyping(e.target)) return;
      const editor = useEditor.getState();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        editor.redo();
      } else if (key === 'd') {
        e.preventDefault();
        editor.duplicateSelection();
      } else if (key === 'a') {
        e.preventDefault();
        editor.selectAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Saves to the cloud a moment after edits stop, only when signed in and switched on. */
function useAutosave() {
  const on = useSettings((s) => s.autosave);
  const user = useAuth((s) => s.user);
  const revision = useEditor((s) => s.revision);
  const dirty = useEditor(isDirty);
  useEffect(() => {
    if (!on || !user || !dirty) return;
    const timer = setTimeout(() => void saveToCloud(), 1500);
    return () => clearTimeout(timer);
  }, [on, user, dirty, revision]);
}

/** Mirrors the canvas to this device so nothing is lost on refresh, signed in or not. */
function useDraftMirror() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      const cur = useEditor.getState();
      saveDraft({
        title: cur.title,
        projectId: cur.projectId,
        dirty: isDirty(cur),
        doc: serializeDoc(cur.nodes, cur.edges),
      });
    };
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.title === prev.title && s.projectId === prev.projectId && s.savedRevision === prev.savedRevision) return;
      clearTimeout(timer);
      timer = setTimeout(save, 400);
    });
    // A reload (such as switching language) must not drop the last edits still waiting to be mirrored.
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      save();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      window.removeEventListener('pagehide', flush);
    };
  }, []);
}

/** Opens the diagram from a ?p=<id> link (AI tools hand these out), then drops the parameter. */
function useProjectLink() {
  const ready = useAuth((s) => s.ready);
  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    const id = url.searchParams.get('p');
    if (!id) return;
    url.searchParams.delete('p');
    window.history.replaceState(window.history.state, '', url);
    openProjectLink(id);
  }, [ready]);
}

/** Picks up edits made elsewhere (an AI tool, another device) on sign-in and whenever the tab comes back into view. */
function useCloudRefresh() {
  const userId = useAuth((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    void refreshFromCloud();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshFromCloud();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId]);
}

/** Browser tab shows the open diagram, with a dot while there are unsaved cloud changes. */
function useDocumentTitle() {
  const title = useEditor((s) => s.title.trim() || UNTITLED);
  const unsaved = useEditor((s) => isDirty(s) && !!s.projectId);
  useEffect(() => {
    document.title = `${unsaved ? '● ' : ''}${title} · flowdraft`;
  }, [title, unsaved]);
}

export default function App() {
  const mobile = useIsMobile();
  useDocumentTitle();
  useShortcuts();
  useAutosave();
  useDraftMirror();
  useProjectLink();
  useCloudRefresh();

  return (
    <ReactFlowProvider>
      <div className={`fd-app${mobile ? ' is-mobile' : ''}`}>
        <TopBar mobile={mobile} />
        <main className="fd-main">
          {!mobile && (
            <aside className="fd-sidebar" aria-label={t('Parçalar', 'Parts')}>
              <Palette />
            </aside>
          )}
          <Canvas mobile={mobile} />
          {!mobile && (
            <aside className="fd-sidebar is-right" aria-label={t('Özellikler', 'Properties')}>
              <Inspector />
            </aside>
          )}
        </main>
        {mobile ? <MobileBar /> : <Credit />}
        <AuthModal />
        <ProjectsDialog />
        <NewDialog />
        <AiDialog />
        <PromoDialog />
        <ConfirmDialog />
        <Toasts />
      </div>
    </ReactFlowProvider>
  );
}
