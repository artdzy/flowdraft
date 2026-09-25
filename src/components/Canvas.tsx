import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
} from '@xyflow/react';
import { useEffect, useRef, type DragEvent } from 'react';
import { EDGE_TYPES } from '../flow/edges';
import { NODE_TYPES } from '../flow/nodes';
import { DND_MIME, PALETTE_BY_ID } from '../flow/palette';
import type { FlowEdge, FlowNode } from '../flow/types';
import { useEditor } from '../store/editor';
import { useTheme } from '../store/theme';
import { useUi } from '../store/ui';
import { TemplateGrid } from './Dialogs';
import { useAddNode } from './useAddNode';

const FIT = { padding: 0.15, maxZoom: 1 };

function minimapColor(node: FlowNode): string {
  if (node.type === 'lane') return 'var(--minimap-lane)';
  if ('tone' in node.data && node.data.tone === 'accent') return 'var(--accent)';
  return 'var(--minimap-node)';
}

function EmptyState() {
  const empty = useEditor((s) => s.nodes.length === 0);
  if (!empty) return null;
  return (
    <div className="fd-empty">
      <div className="fd-empty-card">
        <p className="fd-kicker">Boş tuval</p>
        <h2>Bir parça sürükle ya da bir şablonla başla</h2>
        <TemplateGrid includeBlank={false} />
      </div>
    </div>
  );
}

export function Canvas({ mobile }: { mobile: boolean }) {
  const rf = useReactFlow();
  const add = useAddNode();
  const nodes = useEditor((s) => s.nodes);
  const edges = useEditor((s) => s.edges);
  const onNodesChange = useEditor((s) => s.onNodesChange);
  const onEdgesChange = useEditor((s) => s.onEdgesChange);
  const onConnect = useEditor((s) => s.onConnect);
  const snapshot = useEditor((s) => s.snapshot);
  const fitRequest = useEditor((s) => s.fitRequest);
  const initialized = useNodesInitialized();
  const theme = useTheme((t) => t.theme);
  const pendingFit = useRef(fitRequest > 0);

  useEffect(() => {
    if (fitRequest) pendingFit.current = true;
  }, [fitRequest]);

  useEffect(() => {
    if (!pendingFit.current || (!initialized && nodes.length)) return;
    pendingFit.current = false;
    const frame = requestAnimationFrame(() => void rf.fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [initialized, fitRequest, nodes.length, rf]);

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(DND_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent) => {
    const item = PALETTE_BY_ID[event.dataTransfer.getData(DND_MIME)];
    if (!item) return;
    event.preventDefault();
    add(item, { x: event.clientX, y: event.clientY });
  };

  return (
    <div className="fd-canvas" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStart={snapshot}
        onSelectionDragStart={snapshot}
        onBeforeDelete={async () => {
          snapshot();
          return true;
        }}
        onNodeDoubleClick={() => mobile && useUi.setState({ inspectorSheet: true, paletteSheet: false })}
        onEdgeDoubleClick={() => mobile && useUi.setState({ inspectorSheet: true, paletteSheet: false })}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 1.5 }}
        connectionRadius={28}
        elevateNodesOnSelect={false}
        elevateEdgesOnSelect
        snapToGrid
        snapGrid={[10, 10]}
        fitView
        fitViewOptions={FIT}
        minZoom={0.1}
        maxZoom={2.5}
        panOnScroll={!mobile}
        selectionOnDrag={false}
        deleteKeyCode={['Backspace', 'Delete']}
        colorMode={theme}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--grid-dot)" />
        {!mobile && (
          <>
            <MiniMap<FlowNode>
              pannable
              zoomable
              nodeColor={minimapColor}
              nodeStrokeWidth={0}
              maskColor={theme === 'light' ? 'rgba(245,245,243,0.75)' : 'rgba(10,10,10,0.72)'}
              ariaLabel="Mini harita"
            />
            <Controls showInteractive={false} position="bottom-left" />
          </>
        )}
      </ReactFlow>
      <EmptyState />
    </div>
  );
}
