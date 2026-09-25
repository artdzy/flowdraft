import { create } from 'zustand';
import { requireAuth } from '../store/auth';
import { useEditor } from '../store/editor';
import { useSettings } from '../store/settings';
import { toast } from '../store/ui';
import { parseDoc, serializeDoc } from './doc';
import { exportImage, exportJson, type ExportKind } from './exporter';
import { createProject, describeError, updateProject } from './projects';

type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; savedAt: number | null; error: string | null };

export const useSaveState = create<SaveState>()(() => ({ status: 'idle', savedAt: null, error: null }));

let inflight: Promise<boolean> | null = null;

/** Writes the current canvas to the signed-in user's projects (creates the row on first save). */
export async function saveToCloud(): Promise<boolean> {
  while (inflight) await inflight;
  const run = (async () => {
    const s = useEditor.getState();
    const revision = s.revision;
    const title = s.title.trim() || 'Adsız akış';
    const doc = serializeDoc(s.nodes, s.edges);
    useSaveState.setState({ status: 'saving', error: null });
    try {
      let id = s.projectId;
      if (id && !(await updateProject(id, title, doc))) id = null;
      if (!id) id = await createProject(title, doc);
      useEditor.getState().markSaved(revision, id);
      useSaveState.setState({ status: 'saved', savedAt: Date.now(), error: null });
      return true;
    } catch (err) {
      const message = describeError(err);
      useSaveState.setState({ status: 'error', error: message });
      toast(`Kaydedilemedi: ${message}`, 'error');
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

export function requestSave() {
  requireAuth('Akışını kaydetmek için giriş yap. Çizdiklerin kaybolmaz.', () => {
    void saveToCloud().then((ok) => ok && toast('Kaydedildi'));
  });
}

export function requestAutosave(on: boolean) {
  if (!on) {
    useSettings.getState().setAutosave(false);
    return;
  }
  requireAuth('Otomatik kaydetme için giriş yap.', () => {
    useSettings.getState().setAutosave(true);
    void saveToCloud();
    toast('Otomatik kaydetme açık');
  });
}

export function requestExport(kind: ExportKind) {
  requireAuth('Dışa aktarmak için giriş yap.', () => {
    const { nodes, edges, title } = useEditor.getState();
    if (kind === 'json') {
      exportJson(serializeDoc(nodes, edges), title);
      return;
    }
    exportImage(kind, nodes, title).catch((err: unknown) =>
      toast(err instanceof Error ? err.message : 'Dışa aktarılamadı.', 'error'),
    );
  });
}

export async function importFile(file: File) {
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error('Dosya çok büyük.');
    const raw = JSON.parse(await file.text()) as { title?: unknown };
    const doc = parseDoc(raw);
    if (!doc) throw new Error('Bu bir flowdraft JSON dosyası değil.');
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title : file.name.replace(/\.json$/i, '');
    useEditor.getState().loadDoc(doc, { title, projectId: null, dirty: true });
    toast('İçe aktarıldı');
  } catch (err) {
    toast(err instanceof Error ? err.message : 'İçe aktarılamadı.', 'error');
  }
}
