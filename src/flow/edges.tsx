import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react';
import { memo, type MouseEvent } from 'react';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { EDGE_DEFAULTS, EDGE_COLOR } from './defaults';
import { dashFor } from './edgeStyle';
import { InlineEditor } from './nodes';
import type { FlowEdge } from './types';

/** Selects a connection and puts the caret in its label; the label box shows even while it is still empty. */
export function editEdgeLabel(id: string) {
  useEditor.getState().selectOnly(id);
  useUi.setState({ editing: { id, field: 'label' } });
}

function FlowEdgeView(props: EdgeProps<FlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, markerStart, selected } = props;
  const d = { ...EDGE_DEFAULTS, ...props.data };
  const editing = useUi((s) => s.editing?.id === id);
  const geo = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  const [path, labelX, labelY] =
    d.path === 'bezier'
      ? getBezierPath(geo)
      : d.path === 'straight'
        ? getStraightPath(geo)
        : getSmoothStepPath({ ...geo, borderRadius: 10, offset: 24 });

  // The label lives outside the edge's SVG, so it handles its own clicks instead of letting them reach the pane.
  const select = (event: MouseEvent) => {
    event.stopPropagation();
    useEditor.getState().selectOnly(id);
  };
  const open = (event: MouseEvent) => {
    event.stopPropagation();
    editEdgeLabel(id);
  };
  const menu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    useEditor.getState().selectOnly(id);
    useUi.setState({ contextMenu: { x: event.clientX, y: event.clientY, target: { kind: 'edge', id } } });
  };

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
          stroke: EDGE_COLOR[d.color],
          strokeWidth: (dotted ? 2.2 : 1.5) + (selected ? 0.75 : 0),
          strokeDasharray: dashFor(d.line, d.animated),
          strokeLinecap: dotted ? 'round' : 'butt',
        }}
      />
      {(d.label || editing) && (
        <EdgeLabelRenderer>
          <div
            className="fd-edge-label-wrap nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={select}
            onDoubleClick={open}
            onContextMenu={menu}
          >
            {editing ? (
              <InlineEditor
                id={id}
                field="label"
                value={d.label}
                as="div"
                className={`fd-edge-label color-${d.color}`}
                onSave={(label) => useEditor.getState().updateEdges([id], { label })}
              />
            ) : (
              <div className={`fd-edge-label color-${d.color}`}>{d.label}</div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const EDGE_TYPES = { flow: memo(FlowEdgeView) } as EdgeTypes;
