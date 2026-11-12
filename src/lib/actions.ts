import { create } from 'zustand';
import { lang, t, UNTITLED } from '../i18n';
import { requireAuth } from '../store/auth';
import { isDirty, useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { askConfirm, toast, useUi } from '../store/ui';
import { parseDoc, serializeDoc } from './doc';
import { nativeApp, siteOrigin } from './platform';
import { exportImage, exportJson, exportPdf, type ExportKind } from './exporter';
import { getShare, shareUrl } from './share';
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

export async function confirmDiscard(): Promise<boolean> {
  const s = useEditor.getState();
  if (!s.nodes.length || !isDirty(s)) return true;
  return askConfirm({
    title: t('Kaydedilmemiş değişiklikler', 'Unsaved changes'),
    message: t(
      'Kaydedilmemiş değişikliklerin var. Bu akışı bırakıp devam edilsin mi?',
      'You have unsaved changes. Leave this flow and continue?',
    ),
    confirmLabel: t('Bırak ve devam et', 'Leave and continue'),
  });
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
  requireAuth(t('Bu akışı açmak için giriş yap.', 'Sign in to open this flow.'), async () => {
    if (!(await confirmDiscard())) return;
    openProject(id).catch((err: unknown) => toast(describeError(err), 'error'));
  });
}

/**
 * Opens an example diagram of the guide pages (a ?ornek=<id> link, seo/guides.js) as a new, unsaved flow, the way a
 * template starts. No account needed.
 */
export async function openExampleLink(id: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(id) || !(await confirmDiscard())) return;
  try {
    const res = await fetch(`/ornekler/${lang}/${id}.json`);
    if (!res.ok) throw new Error(t('Bu örnek bulunamadı.', 'Couldn’t find this example.'));
    const raw = (await res.json()) as { title?: unknown };
    const doc = parseDoc(raw);
    if (!doc) throw new Error(t('Örnek okunamadı.', 'Couldn’t read the example.'));
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title : UNTITLED;
    useEditor.getState().loadDoc(doc, { title, projectId: null, dirty: false });
  } catch (err) {
    const fallback = t('Örnek açılamadı. Bağlantını kontrol et.', 'Couldn’t open the example. Check your connection.');
    // Network and JSON errors (TypeError, SyntaxError) get the friendly message; our own ones say what went wrong.
    toast(err instanceof Error && err.name === 'Error' ? err.message : fallback, 'error');
  }
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

/**
 * Realtime told us a project row changed (src/lib/live.ts). Reloads the open one right away when it was changed
 * somewhere else, e.g. by a connected AI tool; our own saves come back here too and are ignored.
 */
export async function handleRemoteUpdate(id: string) {
  while (inflight) await inflight;
  if (useEditor.getState().projectId !== id) return;
  // Compare in PostgREST's timestamp format (the one cloudVersion holds), not the Realtime payload's.
  let latest: string | null;
  try {
    latest = await fetchUpdatedAt(id);
  } catch {
    return;
  }
  if (!latest || (cloudVersion?.id === id && cloudVersion.updatedAt === latest)) return;
  const s = useEditor.getState();
  if (s.projectId !== id || inflight) return;
  if (isDirty(s)) {
    toast(
      t(
        'Bu akış başka bir yerde değişti. Sende kaydedilmemiş değişiklikler var; kaydedersen o değişikliklerin üstüne yazılır.',
        'This flow changed somewhere else. You have unsaved changes here; saving will overwrite that version.',
      ),
      'error',
    );
    return;
  }
  await refreshFromCloud();
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

/** A share link shows the saved flow, so the canvas is saved first. */
export function requestShare() {
  if (!useEditor.getState().nodes.length) {
    toast(t('Paylaşmadan önce bir şeyler çiz.', 'Draw something before sharing.'));
    return;
  }
  requireAuth(t('Akışını paylaşmak için giriş yap.', 'Sign in to share your flow.'), () => {
    const s = useEditor.getState();
    void (s.projectId && !isDirty(s) ? Promise.resolve(true) : saveToCloud()).then((ok) => ok && useUi.setState({ shareOpen: true }));
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

/**
 * Where a saved flow lives on the web, for the QR code of a PDF: its share link when it is shared, otherwise the
 * link that opens it for its owner. A flow that was never saved has none.
 */
async function flowUrl(projectId: string | null): Promise<string | null> {
  if (!projectId) return null;
  // Only the owner may read the share settings; for anyone else this fails and the plain link is used.
  const share = await getShare(projectId).catch(() => null);
  return share ? shareUrl(share.token) : `${siteOrigin}/?p=${projectId}`;
}

export function requestExport(kind: ExportKind) {
  const run = () => {
    const { nodes, edges, title, projectId } = useEditor.getState();
    if (kind === 'json') {
      exportJson(serializeDoc(nodes, edges), title);
      return;
    }
    const work =
      kind === 'pdfA4' || kind === 'pdfA3'
        ? flowUrl(projectId).then((url) => exportPdf(kind === 'pdfA4' ? 'a4' : 'a3', nodes, title, url))
        : exportImage(kind, nodes, title);
    work.catch((err: unknown) =>
      toast(err instanceof Error ? err.message : t('Dışa aktarılamadı.', 'Couldn’t export.'), 'error'),
    );
  };
  // The iPad app saves exports to the device through the share sheet, so no account is involved there.
  if (nativeApp) run();
  else requireAuth(t('Dışa aktarmak için giriş yap.', 'Sign in to export.'), run);
}

export async function importFile(file: File) {
  if (file.size > 2 * 1024 * 1024) {
    toast(t('Dosya çok büyük.', 'This file is too large.'), 'error');
    return;
  }
  importText(await file.text(), file.name);
}

/** Opens an exported flowdraft JSON file as a new, unsaved flow. */
export function importText(text: string, filename: string) {
  try {
    const raw = JSON.parse(text) as { title?: unknown };
    const doc = parseDoc(raw);
    if (!doc) throw new Error(t('Bu bir flowdraft JSON dosyası değil.', 'This isn’t a flowdraft JSON file.'));
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title : filename.replace(/\.json$/i, '');
    useEditor.getState().loadDoc(doc, { title, projectId: null, dirty: true });
    toast(t('İçe aktarıldı', 'Imported'));
  } catch (err) {
    const message = err instanceof SyntaxError ? t('Bu bir flowdraft JSON dosyası değil.', 'This isn’t a flowdraft JSON file.') : null;
    toast(message ?? (err instanceof Error ? err.message : t('İçe aktarılamadı.', 'Couldn’t import.')), 'error');
  }
}
