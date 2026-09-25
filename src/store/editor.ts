import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import { create } from 'zustand';
import { EDGE_DEFAULTS, NODE_DEFAULTS, NODE_SIZE } from '../flow/defaults';
import { decorateEdge } from '../flow/edgeStyle';
import type { FlowDoc, FlowEdge, FlowEdgeData, FlowNode, NodeDataMap, NodeKind } from '../flow/types';
import { uid } from '../lib/doc';

type Snapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

export type EditorState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  title: string;
  projectId: string | null;
  /** Bumped on every content change; compared with savedRevision for dirty state. */
  revision: number;
  savedRevision: number;
  past: Snapshot[];
  future: Snapshot[];
  /** Style applied to newly drawn connections (follows the last edited edge). */
  edgeDraft: FlowEdgeData;
  /** Incremented to ask the canvas to fit the view (after loading a doc). */
  fitRequest: number;

  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  snapshot: () => void;
  undo: () => void;
  redo: () => void;
  addNode: <K extends NodeKind>(kind: K, patch: Partial<NodeDataMap[K]>, position: XYPosition) => string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateEdges: (ids: string[], patch: Partial<FlowEdgeData>) => void;
  setEdgeDraft: (patch: Partial<FlowEdgeData>) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  setTitle: (title: string) => void;
  loadDoc: (doc: FlowDoc, meta: { title: string; projectId: string | null; dirty: boolean }) => void;
  markSaved: (revision: number, projectId: string) => void;
};

const HISTORY_LIMIT = 100;
const TYPING_SNAPSHOT_GAP = 800;
let lastTypingSnapshot = 0;

function typingSnapshot(snapshot: () => void) {
  const now = Date.now();
  if (now - lastTypingSnapshot > TYPING_SNAPSHOT_GAP) snapshot();
  lastTypingSnapshot = now;
}

export const useEditor = create<EditorState>()((set, get) => ({
  nodes: [],
  edges: [],
  title: 'Adsız akış',
  projectId: null,
  revision: 0,
  savedRevision: 0,
  past: [],
  future: [],
  edgeDraft: EDGE_DEFAULTS,
  fitRequest: 0,

  onNodesChange: (changes) => {
    const content = changes.some(
      (c) =>
        c.type === 'position' ||
        c.type === 'remove' ||
        c.type === 'add' ||
        c.type === 'replace' ||
        (c.type === 'dimensions' && c.resizing),
    );
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), revision: content ? s.revision + 1 : s.revision }));
  },

  onEdgesChange: (changes) => {
    const content = changes.some((c) => c.type === 'remove' || c.type === 'add' || c.type === 'replace');
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), revision: content ? s.revision + 1 : s.revision }));
  },

  onConnect: (connection) => {
    if (connection.source === connection.target && connection.sourceHandle === connection.targetHandle) return;
    get().snapshot();
    set((s) => {
      const edge = decorateEdge({
        ...connection,
        id: uid('e'),
        type: 'flow',
        data: { ...s.edgeDraft, label: '' },
      } as FlowEdge);
      return { edges: addEdge(edge, s.edges), revision: s.revision + 1 };
    });
  },

  snapshot: () => {
    const { nodes, edges, past } = get();
    set({ past: [...past.slice(-(HISTORY_LIMIT - 1)), { nodes, edges }], future: [] });
  },

  undo: () => {
    const { past, future, nodes, edges, revision } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set({ past: past.slice(0, -1), future: [...future, { nodes, edges }], ...prev, revision: revision + 1 });
  },

  redo: () => {
    const { past, future, nodes, edges, revision } = get();
    const next = future.at(-1);
    if (!next) return;
    set({ future: future.slice(0, -1), past: [...past, { nodes, edges }], ...next, revision: revision + 1 });
  },

  addNode: (kind, patch, position) => {
    get().snapshot();
    const id = uid('n');
    const node = {
      id,
      type: kind,
      position,
      data: { ...NODE_DEFAULTS[kind], ...patch },
      ...NODE_SIZE[kind],
      zIndex: kind === 'lane' ? -1 : undefined,
      selected: true,
    } as FlowNode;
    set((s) => ({
      nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), node],
      edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
      revision: s.revision + 1,
    }));
    return id;
  },

  updateNodeData: (id, patch) => {
    typingSnapshot(get().snapshot);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as FlowNode) : n)),
      revision: s.revision + 1,
    }));
  },

  updateEdges: (ids, patch) => {
    typingSnapshot(get().snapshot);
    const { label: _label, ...style } = patch;
    set((s) => ({
      edges: s.edges.map((e) =>
        ids.includes(e.id) ? decorateEdge({ ...e, data: { ...EDGE_DEFAULTS, ...e.data, ...patch } }) : e,
      ),
      edgeDraft: { ...s.edgeDraft, ...style },
      revision: s.revision + 1,
    }));
  },

  setEdgeDraft: (patch) => set((s) => ({ edgeDraft: { ...s.edgeDraft, ...patch, label: '' } })),

  deleteSelection: () => {
    const { nodes, edges } = get();
    const gone = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    const hasEdges = edges.some((e) => e.selected);
    if (!gone.size && !hasEdges) return;
    get().snapshot();
    set((s) => ({
      nodes: s.nodes.filter((n) => !gone.has(n.id)),
      edges: s.edges.filter((e) => !e.selected && !gone.has(e.source) && !gone.has(e.target)),
      revision: s.revision + 1,
    }));
  },

  duplicateSelection: () => {
    const { nodes, edges } = get();
    const picked = nodes.filter((n) => n.selected);
    if (!picked.length) return;
    get().snapshot();
    const idMap = new Map(picked.map((n) => [n.id, uid('n')]));
    const clones = picked.map(
      (n) =>
        ({
          ...n,
          id: idMap.get(n.id)!,
          position: { x: n.position.x + 30, y: n.position.y + 30 },
          selected: true,
          dragging: false,
        }) as FlowNode,
    );
    const cloneEdges = edges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e) => ({ ...e, id: uid('e'), source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false }));
    set((s) => ({
      nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...clones],
      edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...cloneEdges],
      revision: s.revision + 1,
    }));
  },

  setTitle: (title) => set((s) => ({ title: title.slice(0, 120), revision: s.revision + 1 })),

  loadDoc: (doc, meta) =>
    set((s) => ({
      nodes: doc.nodes,
      edges: doc.edges.map(decorateEdge),
      title: meta.title,
      projectId: meta.projectId,
      revision: 0,
      savedRevision: meta.dirty ? -1 : 0,
      past: [],
      future: [],
      fitRequest: s.fitRequest + 1,
    })),

  markSaved: (revision, projectId) => set({ savedRevision: revision, projectId }),
}));

export const isDirty = (s: EditorState) => s.revision !== s.savedRevision;
