import { create } from 'zustand';
import { t, UNTITLED } from '../i18n';
import { requireAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';
import { parseDoc, serializeDoc } from './doc';
import { nativeApp } from './platform';
import { exportImage, exportJson, type ExportKind } from './exporter';
import { createProject, describeError, fetchProject, fetchUpdatedAt, updateProject, type ProjectRow } from './projects';

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; savedAt: number | null; error: string | null };

export const useSaveState = create<SaveState>()(() => ({ status: 'idle', savedAt: null, error: null }));

let inflight: Promise<boolean> | null = null;

/** Last cloud version of the open project we know of, to notice edits made elsewhere (another device, an AI tool). */
let cloudVersion: { id: string; updatedAt: string } | null = null;

/** Writes the current canvas to the signed-in user's projects (creates the row on first save). */
export async function saveToCloud(): Promise<boolean> {
  while (inflight) await inflight;
  const run = (async () => {
    const s = useEditor.getState();
    const revision = s.revision;
    const title = s.title.trim() || UNTITLED;
    const doc = serializeDoc(s.nodes, s.edges);
    useSaveState.setState({ status: 'saving', error: null });
    try {
      let id = s.projectId;
      let updatedAt = id ? await updateProject(id, title, doc) : null;
      if (!id || !updatedAt) {
        const created = await createProject(title, doc);
        id = created.id;
        updatedAt = created.updated_at;
      }
      useEditor.getState().markSaved(revision, id);
      cloudVersion = { id, updatedAt };
      useSaveState.setState({ status: 'saved', savedAt: Date.now(), error: null });
      return true;
    } catch (err) {
      const message = describeError(err);
      useSaveState.setState({ status: 'error', error: message });
      toast(t(`Kaydedilemedi: ${message}`, `Couldn’t save: ${message}`), 'error');
      return false;
    }
  })();
  inflight = run;
  try {
    return await run;
  } finally {
    inflight = null;
  }
}

export function confirmDiscard(): boolean {
  const s = useEditor.getState();
  if (!s.nodes.length || !isDirty(s)) return true;
  return window.confirm(
    t(
      'Kaydedilmemiş değişikliklerin var. Bu akışı bırakıp devam edilsin mi?',
      'You have unsaved changes. Leave this flow and continue?',
    ),
  );
}

function showProject(row: ProjectRow) {
  const doc = parseDoc(row.content);
  if (!doc) throw new Error(t('Proje verisi okunamadı.', 'Couldn’t read the project data.'));
  useEditor.getState().loadDoc(doc, { title: row.title, projectId: row.id, dirty: false });
  cloudVersion = { id: row.id, updatedAt: row.updated_at };
}

export async function openProject(id: string): Promise<void> {
  showProject(await fetchProject(id));
}

/** Opens a ?p=<id> link, e.g. one handed out by an AI tool connected over MCP (only the owner can open it). */
export function openProjectLink(id: string) {
  requireAuth(t('Bu akışı açmak için giriş yap.', 'Sign in to open this flow.'), () => {
    if (!confirmDiscard()) return;
    openProject(id).catch((err: unknown) => toast(describeError(err), 'error'));
  });
}

/** Reloads the open project when it changed in the cloud and nothing here is unsaved. */
export async function refreshFromCloud() {
  const s = useEditor.getState();
  const id = s.projectId;
  if (!id || isDirty(s) || inflight) return;
  try {
    const updatedAt = await fetchUpdatedAt(id);
    const known = cloudVersion?.id === id;
    if (!updatedAt || (known && cloudVersion?.updatedAt === updatedAt)) return;
    const row = await fetchProject(id);
    const now = useEditor.getState();
    // The user may have opened something else or started editing while we were fetching.
    if (now.projectId !== id || isDirty(now) || inflight) return;
    showProject(row);
    if (known) {
      toast(t('Akış başka bir yerde değişti; son hali yüklendi.', 'This flow changed somewhere else; the latest version is loaded.'));
    }
  } catch {
    // Offline or signed out: the next visit tries again.
  }
}

export function requestSave() {
  const reason = t(
    'Akışını kaydetmek için giriş yap. Çizdiklerin kaybolmaz.',
    'Sign in to save your flow. You won’t lose what you’ve drawn.',
  );
  requireAuth(reason, () => {
    void saveToCloud().then((ok) => ok && toast(t('Kaydedildi', 'Saved')));
  });
}

export function requestAutosave(on: boolean) {
  if (!on) {
    useSettings.getState().setAutosave(false);
    return;
  }
  requireAuth(t('Otomatik kaydetme için giriş yap.', 'Sign in to turn on auto-save.'), () => {
    useSettings.getState().setAutosave(true);
    void saveToCloud();
    toast(t('Otomatik kaydetme açık', 'Auto-save is on'));
  });
}

export function requestExport(kind: ExportKind) {
  const run = () => {
    const { nodes, edges, title } = useEditor.getState();
    if (kind === 'json') {
      exportJson(serializeDoc(nodes, edges), title);
      return;
    }
    exportImage(kind, nodes, title).catch((err: unknown) =>
      toast(err instanceof Error ? err.message : t('Dışa aktarılamadı.', 'Couldn’t export.'), 'error'),
    );
  };
  // The iPad app saves exports to the device through the share sheet, so no account is involved there.
  if (nativeApp) run();
  else requireAuth(t('Dışa aktarmak için giriş yap.', 'Sign in to export.'), run);
}

export async function importFile(file: File) {
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error(t('Dosya çok büyük.', 'This file is too large.'));
    const raw = JSON.parse(await file.text()) as { title?: unknown };
    const doc = parseDoc(raw);
    if (!doc) throw new Error(t('Bu bir flowdraft JSON dosyası değil.', 'This isn’t a flowdraft JSON file.'));
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title : file.name.replace(/\.json$/i, '');
    useEditor.getState().loadDoc(doc, { title, projectId: null, dirty: true });
    toast(t('İçe aktarıldı', 'Imported'));
  } catch (err) {
    toast(err instanceof Error ? err.message : t('İçe aktarılamadı.', 'Couldn’t import.'), 'error');
  }
}
