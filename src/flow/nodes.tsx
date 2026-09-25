import { Handle, NodeResizer, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { CircleAlert, CircleCheck, Info, OctagonAlert, StickyNote, TriangleAlert, type LucideIcon } from 'lucide-react';
import { memo } from 'react';
import { useEditor } from '../store/editor';
import { getIcon } from './icons';
import type { NodeKind, NodeOf, NoteKind } from './types';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const snapshot = () => useEditor.getState().snapshot();

function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top} id="t" className="fd-handle" />
      <Handle type="source" position={Position.Right} id="r" className="fd-handle" />
      <Handle type="source" position={Position.Bottom} id="b" className="fd-handle" />
      <Handle type="source" position={Position.Left} id="l" className="fd-handle" />
    </>
  );
}

function Resizer({ selected, minWidth, minHeight }: { selected: boolean; minWidth: number; minHeight: number }) {
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={minWidth}
      minHeight={minHeight}
      onResizeStart={snapshot}
      lineClassName="fd-resize-line"
      handleClassName="fd-resize-handle"
    />
  );
}

function CardNode({ data, selected }: NodeProps<NodeOf<'card'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-node fd-card', `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={140} minHeight={70} />
      <div className="fd-card-top">
        {data.tag ? <span className="fd-tag">{data.tag}</span> : <span />}
        {Icon && <Icon className="fd-card-icon" size={16} strokeWidth={1.75} aria-hidden />}
      </div>
      <div className="fd-card-title">
        <span className={cx(data.highlight && 'fd-mark')}>{data.title}</span>
      </div>
      {data.subtitle && <div className="fd-card-sub">{data.subtitle}</div>}
      <Handles />
    </div>
  );
}

function LaneNode({ data, selected }: NodeProps<NodeOf<'lane'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-lane', data.dashed && 'is-dashed', `tone-${data.tone}`, selected && 'is-selected')}>
      <Resizer selected={selected} minWidth={320} minHeight={70} />
      <div className="fd-lane-head">
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
        <span>{data.label}</span>
      </div>
    </div>
  );
}

const NOTE_ICON: Record<NoteKind, LucideIcon> = {
  note: StickyNote,
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
};

function NoteNode({ data, selected }: NodeProps<NodeOf<'note'>>) {
  const Icon = NOTE_ICON[data.kind] ?? CircleAlert;
  return (
    <div className={cx('fd-node fd-note', `kind-${data.kind}`)}>
      <Resizer selected={selected} minWidth={160} minHeight={50} />
      <Icon className="fd-note-icon" size={18} strokeWidth={1.9} aria-hidden />
      <div className="fd-note-body">
        {data.title && <div className="fd-note-title">{data.title}</div>}
        {data.text && <div className="fd-note-text">{data.text}</div>}
      </div>
      <Handles />
    </div>
  );
}

function DecisionNode({ data, selected }: NodeProps<NodeOf<'decision'>>) {
  return (
    <div className={cx('fd-node fd-decision', `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={110} minHeight={80} />
      <svg className="fd-decision-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points="50,1.5 98.5,50 50,98.5 1.5,50" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="fd-decision-text">{data.title}</div>
      <Handles />
    </div>
  );
}

function TerminalNode({ data }: NodeProps<NodeOf<'terminal'>>) {
  return (
    <div className={cx('fd-node fd-terminal', `tone-${data.tone}`)}>
      {data.title}
      <Handles />
    </div>
  );
}

function TextNode({ data, selected }: NodeProps<NodeOf<'text'>>) {
  return (
    <div className={cx('fd-node fd-text', `variant-${data.variant}`, `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={60} minHeight={20} />
      {data.text || ' '}
      <Handles />
    </div>
  );
}

function ChipNode({ data }: NodeProps<NodeOf<'chip'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-node fd-chip', `tone-${data.tone}`)}>
      {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
      <span>{data.text}</span>
      <Handles />
    </div>
  );
}

function BubbleNode({ data, selected }: NodeProps<NodeOf<'bubble'>>) {
  return (
    <div className={cx('fd-node fd-bubble', `side-${data.side}`, `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={140} minHeight={50} />
      {data.speaker && <div className="fd-bubble-speaker">{data.speaker}</div>}
      <div className="fd-bubble-text">{data.text}</div>
      <Handles />
    </div>
  );
}

export const NODE_TYPES = {
  card: memo(CardNode),
  lane: memo(LaneNode),
  note: memo(NoteNode),
  decision: memo(DecisionNode),
  terminal: memo(TerminalNode),
  text: memo(TextNode),
  chip: memo(ChipNode),
  bubble: memo(BubbleNode),
} satisfies Record<NodeKind, unknown> as NodeTypes;
