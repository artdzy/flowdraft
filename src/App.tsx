import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useSyncExternalStore } from 'react';
import { AuthModal } from './components/AuthModal';
import { Canvas } from './components/Canvas';
import { Credit } from './components/Credit';
import { NewDialog, ProjectsDialog, Toasts } from './components/Dialogs';
import { Inspector } from './components/Inspector';
import { MobileBar } from './components/MobileBar';
import { Palette } from './components/Palette';
import { TopBar } from './components/TopBar';
import { requestSave, saveToCloud } from './lib/actions';
import { saveDraft } from './lib/draft';
import { serializeDoc } from './lib/doc';
import { useAuth } from './store/auth';
import { isDirty, useEditor } from './store/editor';
import { useSettings } from './store/settings';

const mobileQuery = window.matchMedia('(max-width: 760px)');
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
    const unsubscribe = useEditor.subscribe((s, prev) => {
      if (s.nodes === prev.nodes && s.edges === prev.edges && s.title === prev.title && s.projectId === prev.projectId && s.savedRevision === prev.savedRevision) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const cur = useEditor.getState();
        saveDraft({
          title: cur.title,
          projectId: cur.projectId,
          dirty: isDirty(cur),
          doc: serializeDoc(cur.nodes, cur.edges),
        });
      }, 400);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

export default function App() {
  const mobile = useIsMobile();
  useShortcuts();
  useAutosave();
  useDraftMirror();

  return (
    <ReactFlowProvider>
      <div className={`fd-app${mobile ? ' is-mobile' : ''}`}>
        <TopBar mobile={mobile} />
        <main className="fd-main">
          {!mobile && (
            <aside className="fd-sidebar" aria-label="Parçalar">
              <Palette />
            </aside>
          )}
          <Canvas mobile={mobile} />
          {!mobile && (
            <aside className="fd-sidebar is-right" aria-label="Özellikler">
              <Inspector />
            </aside>
          )}
        </main>
        {mobile ? <MobileBar /> : <Credit />}
        <AuthModal />
        <ProjectsDialog />
        <NewDialog />
        <Toasts />
      </div>
    </ReactFlowProvider>
  );
}
