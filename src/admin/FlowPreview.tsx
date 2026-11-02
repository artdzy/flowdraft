import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { ReadOnlyFlow } from '../components/ReadOnlyFlow';
import type { FlowDoc } from '../flow/types';
import { t } from '../i18n';
import { fetchMemberFlow, type MemberFlow } from '../lib/admin';
import { parseDoc } from '../lib/doc';
import { describeError } from '../lib/projects';

type View = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: FlowDoc };

/** Read-only look at a member's flow: can be panned and zoomed, nothing can be selected, moved or edited. */
export function FlowPreview({ flow, onClose }: { flow: MemberFlow | null; onClose: () => void }) {
  const [view, setView] = useState<View>({ status: 'loading' });
  // Keeps the title on screen while the dialog closes.
  const last = useRef<MemberFlow | null>(null);
  if (flow) last.current = flow;
  const id = flow?.id;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setView({ status: 'loading' });
    fetchMemberFlow(id).then(
      (content) => {
        if (!alive) return;
        const doc = parseDoc(content);
        if (doc) setView({ status: 'ready', doc });
        else setView({ status: 'error', message: t('Bu akış açılamadı.', 'This flow couldn’t be opened.') });
      },
      (err) => alive && setView({ status: 'error', message: describeError(err) }),
    );
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <Modal
      open={!!flow}
      onClose={onClose}
      title={(flow ?? last.current)?.title ?? ''}
      titleId="fd-admin-flow-title"
      className="fd-admin-flow-modal"
    >
      <div className="fd-admin-flow-canvas">
        {view.status === 'loading' && (
          <p className="fd-muted fd-loading">
            <LoaderCircle size={16} className="fd-spin" /> {t('Yükleniyor…', 'Loading…')}
          </p>
        )}
        {view.status === 'error' && <p className="fd-form-error">{view.message}</p>}
        {view.status === 'ready' && (
          <ReadOnlyFlow doc={view.doc} />
        )}
      </div>
      <p className="fd-muted fd-small">
        {t('Salt okunur önizleme. Akış değiştirilemez.', 'Read-only preview. The flow can’t be changed.')}
      </p>
    </Modal>
  );
}
