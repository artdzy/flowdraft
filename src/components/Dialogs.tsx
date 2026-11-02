import { FilePlus2, LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { locale, t, UNTITLED } from '../i18n';
import { confirmDiscard, openProject } from '../lib/actions';
import { parseDoc } from '../lib/doc';
import { deleteProject, describeError, listProjects, type ProjectSummary } from '../lib/projects';
import { listSharedWithMe, shareUrl, type SharedFlow } from '../lib/share';
import { getIcon } from '../flow/icons';
import { TEMPLATES, type TemplateId } from '../flow/templates';
import { useEditor } from '../store/editor';
import { askConfirm, settleConfirm, toast, useUi, type ConfirmRequest } from '../store/ui';
import { DescribeButton } from './DescribeDialog';
import { Modal } from './Modal';

export async function startTemplate(id: TemplateId): Promise<boolean> {
  if (!(await confirmDiscard())) return false;
  const tpl = TEMPLATES.find((x) => x.id === id)!;
  useEditor.getState().loadDoc(parseDoc(tpl.build())!, {
    title: id === 'blank' ? UNTITLED : t(`${tpl.title} akışı`, `${tpl.title} flow`),
    projectId: null,
    dirty: false,
  });
  return true;
}

export function TemplateGrid({ onPicked, includeBlank = true }: { onPicked?: () => void; includeBlank?: boolean }) {
  return (
    <div className="fd-templates">
      {TEMPLATES.filter((tpl) => includeBlank || tpl.id !== 'blank').map((tpl) => {
        const Icon = getIcon(tpl.icon);
        return (
          <button
            key={tpl.id}
            type="button"
            className="fd-template"
            onClick={() => {
              void startTemplate(tpl.id).then((started) => started && onPicked?.());
            }}
          >
            <span className="fd-template-icon">{Icon && <Icon size={18} strokeWidth={1.75} aria-hidden />}</span>
            <span className="fd-template-title">{tpl.title}</span>
            <span className="fd-template-desc">{tpl.description}</span>
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
    <Modal open={open} onClose={close} title={t('Yeni akış', 'New flow')} titleId="fd-new-title">
      <DescribeButton />
      <TemplateGrid onPicked={close} />
    </Modal>
  );
}

const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function ProjectList({ onDone }: { onDone: () => void }) {
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const [shared, setShared] = useState<SharedFlow[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const currentId = useEditor((s) => s.projectId);

  useEffect(() => {
    listProjects()
      .then(setItems)
      .catch((err: unknown) => setError(describeError(err)));
    listSharedWithMe().then(setShared, () => setShared([]));
  }, []);

  const open = async (p: ProjectSummary) => {
    if (p.id !== currentId && !(await confirmDiscard())) return;
    setBusyId(p.id);
    try {
      await openProject(p.id);
      onDone();
    } catch (err) {
      toast(describeError(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Read-only flows open in the viewer, flows you may edit in the editor.
  const openShared = (p: SharedFlow) => {
    if (p.role === 'editor') void open(p);
    else window.location.assign(shareUrl(p.token));
  };

  const remove = async (p: ProjectSummary) => {
    const ok = await askConfirm({
      title: t('Projeyi sil', 'Delete project'),
      message: t(`“${p.title}” kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`, `Delete “${p.title}” permanently? This can’t be undone.`),
      confirmLabel: t('Sil', 'Delete'),
    });
    if (!ok) return;
    setBusyId(p.id);
    try {
      await deleteProject(p.id);
      setItems((list) => list?.filter((x) => x.id !== p.id) ?? null);
      if (p.id === useEditor.getState().projectId) useEditor.setState({ projectId: null, savedRevision: -1 });
      toast(t('Proje silindi', 'Project deleted'));
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
        <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
      </p>
    );

  return (
    <>
      {items.length > 0 ? (
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
                aria-label={t(`${p.title} projesini sil`, `Delete ${p.title}`)}
                onClick={() => void remove(p)}
                disabled={busyId === p.id}
              >
                {busyId === p.id ? <LoaderCircle size={16} className="fd-spin" /> : <Trash2 size={16} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fd-muted">
          {t(
            'Henüz kayıtlı projen yok. Çiz, sonra “Kaydet”e bas.',
            'You don’t have any saved projects yet. Draw something, then hit “Save”.',
          )}
        </p>
      )}
      {shared.length > 0 && (
        <>
          <h3 className="fd-projects-head">{t('Benimle paylaşılanlar', 'Shared with me')}</h3>
          <ul className="fd-projects">
            {shared.map((p) => (
              <li key={p.id} className={p.id === currentId ? 'is-current' : ''}>
                <button type="button" className="fd-project-open" onClick={() => openShared(p)} disabled={busyId === p.id}>
                  <span className="fd-project-title">{p.title}</span>
                  <span className="fd-project-date">
                    {p.role === 'editor' ? t('Düzenleyebilirsin', 'Can edit') : t('Salt okunur', 'Read only')} ·{' '}
                    {dateFmt.format(new Date(p.updated_at))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export function ProjectsDialog() {
  const open = useUi((s) => s.projectsOpen);
  const close = () => useUi.setState({ projectsOpen: false });
  return (
    <Modal open={open} onClose={close} title={t('Projelerim', 'My projects')} titleId="fd-projects-title">
      <button
        type="button"
        className="fd-btn is-block"
        onClick={() => useUi.setState({ projectsOpen: false, newOpen: true })}
      >
        <FilePlus2 size={16} /> {t('Yeni akış', 'New flow')}
      </button>
      <ProjectList onDone={close} />
      <p className="fd-muted fd-small">
        {t(
          'flowdraft ücretsizdir ve garanti verilmez; sunucudaki projeler silinebilir. Önemli akışlarını Dışa aktar → JSON ile yedekle.',
          'flowdraft is free and comes with no warranty; projects on the server may be deleted. Back up important flows with Export → JSON.',
        )}
      </p>
    </Modal>
  );
}

/** The app's own confirm dialog, used for every yes/no question instead of window.confirm. */
export function ConfirmDialog() {
  const request = useUi((s) => s.confirm);
  // Keeps the text on screen while the dialog closes.
  const last = useRef<ConfirmRequest | null>(null);
  if (request) last.current = request;
  const shown = request ?? last.current;
  return (
    <Modal
      open={!!request}
      onClose={() => settleConfirm(false)}
      title={shown?.title ?? ''}
      titleId="fd-confirm-title"
      className="is-narrow"
    >
      <p className="fd-confirm-text">{shown?.message}</p>
      <div className="fd-confirm-actions">
        <button type="button" className="fd-btn" onClick={() => settleConfirm(false)}>
          {t('Vazgeç', 'Cancel')}
        </button>
        <button type="button" className="fd-btn is-primary" onClick={() => settleConfirm(true)}>
          {shown?.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  return (
    <div className="fd-toasts" aria-live="polite">
      {toasts.map((item) => (
        <div key={item.id} className={`fd-toast tone-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
          {item.text}
        </div>
      ))}
    </div>
  );
}
