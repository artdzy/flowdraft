import { MarkerType, type EdgeMarker } from '@xyflow/react';
import { EDGE_DEFAULTS, EDGE_COLOR } from './defaults';
import type { FlowEdge, FlowEdgeData } from './types';

/** Derives React Flow marker/type props from the edge's own style data. */
export function decorateEdge(edge: FlowEdge): FlowEdge {
  const data: FlowEdgeData = { ...EDGE_DEFAULTS, ...edge.data };
  const marker: EdgeMarker = { type: MarkerType.ArrowClosed, color: EDGE_COLOR[data.color], width: 14, height: 14 };
  return {
    ...edge,
    type: 'flow',
    data,
    markerEnd: data.arrow === 'none' ? undefined : marker,
    markerStart: data.arrow === 'both' ? marker : undefined,
  };
}

export function dashFor(line: FlowEdgeData['line'], animated: boolean): string | undefined {
  if (line === 'dashed') return '7 6';
  if (line === 'dotted') return '0.1 6';
  return animated ? '7 6' : undefined;
}
