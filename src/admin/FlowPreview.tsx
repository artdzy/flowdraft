import { Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { decorateEdge } from '../flow/edgeStyle';
import { EDGE_TYPES } from '../flow/edges';
import { NODE_TYPES } from '../flow/nodes';
import type { FlowDoc, FlowEdge, FlowNode } from '../flow/types';
import { t } from '../i18n';
import { fetchMemberFlow, type MemberFlow } from '../lib/admin';
import { parseDoc } from '../lib/doc';
import { describeError } from '../lib/projects';
import { useTheme } from '../store/theme';

type View = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: FlowDoc };

/** Read-only look at a member's flow: can be panned and zoomed, nothing can be selected, moved or edited. */
export function FlowPreview({ flow, onClose }: { flow: MemberFlow | null; onClose: () => void }) {
  const theme = useTheme((s) => s.theme);
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
        if (doc) setView({ status: 'ready', doc: { ...doc, edges: doc.edges.map(decorateEdge) } });
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
          <ReactFlowProvider>
            <ReactFlow<FlowNode, FlowEdge>
              nodes={view.doc.nodes}
              edges={view.doc.edges}
              nodeTypes={NODE_TYPES}
              edgeTypes={EDGE_TYPES}
              // Same as the editor: every handle is a source, so edges only resolve in loose mode.
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={false}
              nodesConnectable={false}
              nodesFocusable={false}
              edgesFocusable={false}
              elementsSelectable={false}
              deleteKeyCode={null}
              fitView
              fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
              minZoom={0.05}
              maxZoom={2.5}
              colorMode={theme}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--grid-dot)" />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </ReactFlowProvider>
        )}
      </div>
      <p className="fd-muted fd-small">
        {t('Salt okunur önizleme. Akış değiştirilemez.', 'Read-only preview. The flow can’t be changed.')}
      </p>
    </Modal>
  );
}
