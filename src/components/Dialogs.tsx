import { FilePlus2, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { parseDoc } from '../lib/doc';
import { deleteProject, describeError, fetchProject, listProjects, type ProjectSummary } from '../lib/projects';
import { getIcon } from '../flow/icons';
import { TEMPLATES, type TemplateId } from '../flow/templates';
import { isDirty, useEditor } from '../store/editor';
import { toast, useUi } from '../store/ui';
import { Modal } from './Modal';

function confirmDiscard(): boolean {
  const s = useEditor.getState();
  if (!s.nodes.length || !isDirty(s)) return true;
  return window.confirm('Kaydedilmemiş değişikliklerin var. Bu akışı bırakıp devam edilsin mi?');
}

export function startTemplate(id: TemplateId): boolean {
  if (!confirmDiscard()) return false;
  const t = TEMPLATES.find((x) => x.id === id)!;
  useEditor.getState().loadDoc(parseDoc(t.build())!, {
    title: id === 'blank' ? 'Adsız akış' : `${t.title} akışı`,
    projectId: null,
    dirty: false,
  });
  return true;
}

export function TemplateGrid({ onPicked, includeBlank = true }: { onPicked?: () => void; includeBlank?: boolean }) {
  return (
    <div className="fd-templates">
      {TEMPLATES.filter((t) => includeBlank || t.id !== 'blank').map((t) => {
        const Icon = getIcon(t.icon);
        return (
          <button
            key={t.id}
            type="button"
            className="fd-template"
            onClick={() => {
              if (startTemplate(t.id)) onPicked?.();
            }}
          >
            <span className="fd-template-icon">{Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}</span>
            <span className="fd-template-title">{t.title}</span>
            <span className="fd-template-desc">{t.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export function NewDialog() {
  const open = useUi((s) => s.newOpen);
  const close = () => useUi.setState({ newOpen: false });
  return (
    <Modal open={open} onClose={close} title="Yeni akış" titleId="fd-new-title">
      <TemplateGrid onPicked={close} />
    </Modal>
  );
}

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ProjectList({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const currentId = useEditor((s) => s.projectId);

  useEffect(() => {
    listProjects()
      .then(setItems)
      .catch((err: unknown) => setError(describeError(err)));
  }, []);

  const open = async (p: ProjectSummary) => {
    if (p.id !== currentId && !confirmDiscard()) return;
    setBusyId(p.id);
    try {
      const row = await fetchProject(p.id);
      const doc = parseDoc(row.content);
      if (!doc) throw new Error('Proje verisi okunamadı.');
      useEditor.getState().loadDoc(doc, { title: row.title, projectId: row.id, dirty: false });
      onDone();
    } catch (err) {
      toast(describeError(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: ProjectSummary) => {
    if (!window.confirm(`“${p.title}” kalıcı olarak silinsin mi?`)) return;
    setBusyId(p.id);
    try {
      await deleteProject(p.id);
      setItems((list) => list?.filter((x) => x.id !== p.id) ?? null);
      if (p.id === useEditor.getState().projectId) useEditor.setState({ projectId: null, savedRevision: -1 });
      toast('Proje silindi');
    } catch (err) {
      toast(describeError(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="fd-form-error">{error}</p>;
  if (!items)
    return (
      <p className="fd-muted fd-loading">
        <LoaderCircle size={16} className="fd-spin" /> Yükleniyor…
      </p>
    );
  if (!items.length) return <p className="fd-muted">Henüz kayıtlı projen yok. Çiz, sonra “Kaydet”e bas.</p>;

  return (
    <ul className="fd-projects">
      {items.map((p) => (
        <li key={p.id} className={p.id === currentId ? 'is-current' : ''}>
          <button type="button" className="fd-project-open" onClick={() => void open(p)} disabled={busyId === p.id}>
            <span className="fd-project-title">{p.title}</span>
            <span className="fd-project-date">{dateFmt.format(new Date(p.updated_at))}</span>
          </button>
          <button
            type="button"
            className="fd-icon-btn"
            aria-label={`${p.title} projesini sil`}
            onClick={() => void remove(p)}
            disabled={busyId === p.id}
          >
            {busyId === p.id ? <LoaderCircle size={16} className="fd-spin" /> : <Trash2 size={16} />}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ProjectsDialog() {
  const open = useUi((s) => s.projectsOpen);
  const close = () => useUi.setState({ projectsOpen: false });
  return (
    <Modal open={open} onClose={close} title="Projelerim" titleId="fd-projects-title">
      <button
        type="button"
        className="fd-btn is-block"
        onClick={() => useUi.setState({ projectsOpen: false, newOpen: true })}
      >
        <FilePlus2 size={16} /> Yeni akış
      </button>
      <ProjectList onDone={close} />
      <p className="fd-muted fd-small">
        flowdraft ücretsizdir ve garanti verilmez; sunucudaki projeler silinebilir. Önemli akışlarını Dışa aktar → JSON ile
        yedekle.
      </p>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="fd-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`fd-toast tone-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
