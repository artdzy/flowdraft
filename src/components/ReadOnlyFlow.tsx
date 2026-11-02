import { Background, BackgroundVariant, ConnectionMode, Controls, ReactFlow, ReactFlowProvider } from '@xyflow/react';
import { decorateEdge } from '../flow/edgeStyle';
import { EDGE_TYPES } from '../flow/edges';
import { NODE_TYPES } from '../flow/nodes';
import type { FlowDoc, FlowEdge, FlowNode } from '../flow/types';
import { useTheme } from '../store/theme';

/** A flow that can be panned and zoomed; nothing can be selected, moved or edited. */
export function ReadOnlyFlow({ doc }: { doc: FlowDoc }) {
  const theme = useTheme((s) => s.theme);
  return (
    <ReactFlowProvider>
      <ReactFlow<FlowNode, FlowEdge>
        nodes={doc.nodes}
        edges={doc.edges.map(decorateEdge)}
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
  );
}
