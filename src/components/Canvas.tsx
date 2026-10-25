import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useNodesInitialized,
  useOnViewportChange,
  useReactFlow,
  useViewport,
  type Connection,
  type FinalConnectionState,
  type OnConnectEnd,
  type XYPosition,
} from '@xyflow/react';
import { useCallback, useEffect, useRef, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { NODE_SIZE } from '../flow/defaults';
import { rectOf, setCanvasZoom } from '../flow/drag';
import { EDGE_TYPES, editEdgeLabel } from '../flow/edges';
import { editText, NODE_TYPES } from '../flow/nodes';
import { DND_MIME, PALETTE_BY_ID } from '../flow/palette';
import type { FlowEdge, FlowNode, NodeKind } from '../flow/types';
import { t } from '../i18n';
import { useClipboard } from '../lib/clipboard';
import { isTyping } from '../lib/keys';
import { useEditor } from '../store/editor';
import { useTheme } from '../store/theme';
import { toast, useUi, type ContextTarget } from '../store/ui';
import { TemplateGrid } from './Dialogs';
import { useAddNode } from './useAddNode';

const FIT = { padding: 0.15, maxZoom: 1 };
const ANIM = { duration: 200 };
const snap = (v: number) => Math.round(v / 10) * 10;

/** What appears when a connection is dropped on empty canvas, by the kind of node it was dragged from. */
const CONNECT_KIND: Partial<Record<NodeKind, NodeKind>> = { note: 'note', bubble: 'bubble', chip: 'chip' };

function minimapColor(node: FlowNode): string {
  if (node.type === 'lane') return 'var(--minimap-lane)';
  if ('tone' in node.data && node.data.tone === 'accent') return 'var(--accent)';
  return 'var(--minimap-node)';
}

/** Lane bodies let pointer events through to the pane, so a point has to be matched to a lane by hand. */
function laneAt(p: XYPosition): FlowNode | undefined {
  return [...useEditor.getState().nodes].reverse().find((n) => {
    if (n.type !== 'lane') return false;
    const r = rectOf(n);
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  });
}

function EmptyState() {
  const empty = useEditor((s) => s.nodes.length === 0);
  if (!empty) return null;
  return (
    <div className="fd-empty">
      <div className="fd-empty-card">
        <p className="fd-kicker">{t('Boş tuval', 'Blank canvas')}</p>
        <h2>{t('Bir parça sürükle ya da bir şablonla başla', 'Drag in a part or start from a template')}</h2>
        <TemplateGrid includeBlank={false} />
      </div>
    </div>
  );
}

/** Red alignment lines while a node is dragged level with a neighbour (src/flow/drag.ts decides where). */
function GuideLines() {
  const guides = useUi((s) => s.guides);
  const { x, y, zoom } = useViewport();
  if (!guides) return null;
  return (
    <>
      {guides.x !== undefined && <div className="fd-snap-guide is-v" style={{ left: guides.x * zoom + x }} />}
      {guides.y !== undefined && <div className="fd-snap-guide is-h" style={{ top: guides.y * zoom + y }} />}
    </>
  );
}

/** ⌘+ / ⌘− zoom, ⌘0 or ⇧1 fit everything, ⌘1 or ⇧0 is 100%, ⇧2 zooms to the selection. */
function useZoomShortcuts(enabled: boolean) {
  const rf = useReactFlow();
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || isTyping(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const zoomIn = meta && (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd');
      const zoomOut = meta && (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract');
      const fit = (meta && !e.shiftKey && e.code === 'Digit0') || (!meta && e.shiftKey && e.code === 'Digit1');
      const actual = (meta && e.code === 'Digit1') || (!meta && e.shiftKey && e.code === 'Digit0');
      const selection = !meta && e.shiftKey && e.code === 'Digit2';
      if (zoomIn) void rf.zoomIn(ANIM);
      else if (zoomOut) void rf.zoomOut(ANIM);
      else if (fit) void rf.fitView({ ...FIT, ...ANIM });
      else if (actual) void rf.zoomTo(1, ANIM);
      else if (selection) {
        const picked = useEditor.getState().nodes.filter((n) => n.selected);
        void rf.fitView(picked.length ? { nodes: picked, padding: 0.4, maxZoom: 1.5, ...ANIM } : { ...FIT, ...ANIM });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, rf]);
}

const pointOf = (event: MouseEvent | TouchEvent): XYPosition | null =>
  'clientX' in event
    ? { x: event.clientX, y: event.clientY }
    : event.changedTouches?.[0]
      ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
      : null;

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
  const theme = useTheme((s) => s.theme);
  const pendingFit = useRef(fitRequest > 0);
  const pointer = useRef<XYPosition | null>(null);
  const reconnected = useRef(false);
  const reconnectFrom = useRef<XYPosition | null>(null);

  useZoomShortcuts(!mobile);
  const pointerOnCanvas = useCallback(() => (pointer.current ? rf.screenToFlowPosition(pointer.current) : null), [rf]);
  useClipboard(pointerOnCanvas);

  // Snapping distances are measured on screen, so the drag logic needs the zoom.
  useOnViewportChange({ onChange: (v) => setCanvasZoom(v.zoom) });
  useEffect(() => setCanvasZoom(rf.getZoom()), [rf]);

  useEffect(() => {
    if (fitRequest) pendingFit.current = true;
  }, [fitRequest]);

  useEffect(() => {
    if (!pendingFit.current || (!initialized && nodes.length)) return;
    pendingFit.current = false;
    const frame = requestAnimationFrame(() => void rf.fitView(FIT));
    return () => cancelAnimationFrame(frame);
  }, [initialized, fitRequest, nodes.length, rf]);

  // Enter edits the text of the one selected node or the label of the one selected connection.
  useEffect(() => {
    if (mobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target !== document.body && !target.classList.contains('react-flow__node') && !target.classList.contains('react-flow__edge')) return;
      const { nodes, edges } = useEditor.getState();
      const pickedNodes = nodes.filter((n) => n.selected);
      const pickedEdges = edges.filter((edge) => edge.selected);
      if (pickedNodes.length === 1 && !pickedEdges.length) {
        e.preventDefault();
        editText(pickedNodes[0]);
      } else if (!pickedNodes.length && pickedEdges.length === 1) {
        e.preventDefault();
        editEdgeLabel(pickedEdges[0].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile]);

  const onNodeDoubleClick = (event: ReactMouseEvent, node: FlowNode) => {
    if (mobile) {
      useUi.setState({ inspectorSheet: true, paletteSheet: false });
      return;
    }
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-field]')?.dataset.field;
    editText(node, field);
  };

  const onEdgeDoubleClick = (_event: ReactMouseEvent, edge: FlowEdge) => {
    if (mobile) useUi.setState({ inspectorSheet: true, paletteSheet: false });
    else editEdgeLabel(edge.id);
  };

  // A plain click on a lane body selects the lane (its body is transparent to pointer events).
  const onPaneClick = (event: ReactMouseEvent) => {
    const lane = laneAt(rf.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    if (lane) useEditor.getState().selectOnly(lane.id);
  };

  /** Dropping a connection on empty canvas adds a new part there, already connected, and starts typing in it. */
  const onConnectEnd: OnConnectEnd = (_event, state) => {
    // Moving the end of an existing connection goes through the same gesture; that one is handled below.
    if (reconnectFrom.current) return;
    if (state.isValid !== null || !state.fromNode || !state.fromHandle?.id || !state.from || !state.to) return;
    if (Math.hypot(state.to.x - state.from.x, state.to.y - state.from.y) < 24) return;
    const source = state.fromNode as unknown as FlowNode;
    const kind = CONNECT_KIND[source.type] ?? 'card';
    const patch: Record<string, unknown> = {};
    if (source.type === 'bubble') patch.side = source.data.side === 'left' ? 'right' : 'left';
    const size = NODE_SIZE[kind] ?? {};
    const w = size.width ?? 160;
    const h = size.height ?? (kind === 'card' ? 92 : 56);
    const position = { x: snap(state.to.x - w / 2), y: snap(state.to.y - h / 2) };
    const id = useEditor.getState().connectNew({ id: source.id, handle: state.fromHandle.id }, kind, patch, position);
    if (mobile) return;
    requestAnimationFrame(() => {
      const node = useEditor.getState().nodes.find((n) => n.id === id);
      if (node) editText(node);
    });
  };

  // Dragging the end of a selected connection moves it to another handle; letting go in empty space removes it.
  const onReconnectStart = (event: ReactMouseEvent) => {
    reconnected.current = false;
    reconnectFrom.current = { x: event.clientX, y: event.clientY };
  };
  const onReconnect = (edge: FlowEdge, connection: Connection) => {
    reconnected.current = true;
    useEditor.getState().reconnect(edge.id, connection);
  };
  const onReconnectEnd = (event: MouseEvent | TouchEvent, edge: FlowEdge, _type: unknown, state: FinalConnectionState) => {
    const start = reconnectFrom.current;
    reconnectFrom.current = null;
    if (reconnected.current || state.isValid !== null) return;
    const end = pointOf(event);
    if (!start || !end || Math.hypot(end.x - start.x, end.y - start.y) < 8) return;
    useEditor.getState().removeEdges([edge.id]);
    toast(t('Bağlantı kaldırıldı. Geri almak için ⌘Z / Ctrl+Z', 'Connection removed. Press ⌘Z / Ctrl+Z to undo'));
  };

  const openMenu = (event: ReactMouseEvent | MouseEvent, target: ContextTarget) => {
    event.preventDefault();
    useUi.setState({ contextMenu: { x: event.clientX, y: event.clientY, target } });
  };
  const onNodeContextMenu = (event: ReactMouseEvent, node: FlowNode) => {
    if (!node.selected) useEditor.getState().selectOnly(node.id);
    openMenu(event, { kind: 'node', id: node.id });
  };
  const onEdgeContextMenu = (event: ReactMouseEvent, edge: FlowEdge) => {
    if (!edge.selected) useEditor.getState().selectOnly(edge.id);
    openMenu(event, { kind: 'edge', id: edge.id });
  };
  const onPaneContextMenu = (event: ReactMouseEvent | MouseEvent) => {
    const at = rf.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const lane = laneAt(at);
    if (!lane) {
      openMenu(event, { kind: 'pane', at });
      return;
    }
    if (!lane.selected) useEditor.getState().selectOnly(lane.id);
    openMenu(event, { kind: 'node', id: lane.id });
  };

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
    <div
      className="fd-canvas"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
      onPointerLeave={() => (pointer.current = null)}
    >
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onReconnectStart={onReconnectStart}
        onReconnect={onReconnect}
        onReconnectEnd={onReconnectEnd}
        reconnectRadius={7}
        onNodeDragStart={snapshot}
        onSelectionDragStart={snapshot}
        onBeforeDelete={async () => {
          snapshot();
          return true;
        }}
        onPaneClick={onPaneClick}
        selectionMode={SelectionMode.Partial}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onSelectionContextMenu={(event, picked) => picked[0] && openMenu(event, { kind: 'node', id: picked[0].id })}
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
        zoomOnDoubleClick={false}
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
              ariaLabel={t('Mini harita', 'Minimap')}
            />
            <Controls showInteractive={false} position="bottom-left" />
          </>
        )}
      </ReactFlow>
      <GuideLines />
      <EmptyState />
    </div>
  );
}
