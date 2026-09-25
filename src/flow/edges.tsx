import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import { memo } from 'react';
import { EDGE_DEFAULTS, EDGE_HEX } from './defaults';
import { dashFor } from './edgeStyle';
import type { FlowEdge } from './types';

function FlowEdgeView(props: EdgeProps<FlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, markerStart, selected } = props;
  const d = { ...EDGE_DEFAULTS, ...props.data };
  const geo = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] =
    d.path === 'bezier'
      ? getBezierPath(geo)
      : d.path === 'straight'
        ? getStraightPath(geo)
        : getSmoothStepPath({ ...geo, borderRadius: 10, offset: 24 });

  const dotted = d.line === 'dotted';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={20}
        className={['fd-edge', `line-${d.line}`, d.animated && 'is-animated', selected && 'is-selected']
          .filter(Boolean)
          .join(' ')}
        style={{
          stroke: EDGE_HEX[d.color],
          strokeWidth: (dotted ? 2.2 : 1.5) + (selected ? 0.75 : 0),
          strokeDasharray: dashFor(d.line, d.animated),
          strokeLinecap: dotted ? 'round' : 'butt',
        }}
      />
      {d.label && (
        <EdgeLabelRenderer>
          <div
            className={`fd-edge-label color-${d.color} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {d.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const EDGE_TYPES = { flow: memo(FlowEdgeView) } as EdgeTypes;
