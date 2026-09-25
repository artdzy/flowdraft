import { Handle, NodeResizer, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { CircleAlert, CircleCheck, Info, OctagonAlert, StickyNote, TriangleAlert, type LucideIcon } from 'lucide-react';
import { memo, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { locale } from '../i18n';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { getIcon } from './icons';
import type { FlowNode, NodeKind, NodeOf, NoteKind } from './types';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const snapshot = () => useEditor.getState().snapshot();

/** Field edited when a node is double-clicked outside its texts, or Enter is pressed with it selected. */
const PRIMARY_FIELD: Record<FlowNode['type'], string> = {
  card: 'title',
  lane: 'label',
  note: 'text',
  decision: 'title',
  terminal: 'title',
  text: 'text',
  chip: 'text',
  bubble: 'text',
};

export function editText(node: FlowNode, field: string = PRIMARY_FIELD[node.type]) {
  useUi.setState({ editing: { id: node.id, field } });
}

const stopEditing = () => useUi.setState({ editing: null });

/** Reads what the user typed; depending on the browser a line break is "\n", a <br> or a new <div>. */
function readText(el: HTMLElement): string {
  let text = '';
  const walk = (parent: Node) =>
    parent.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) text += child.nodeValue;
      else if (child.nodeName === 'BR') text += '\n';
      else {
        if ((child.nodeName === 'DIV' || child.nodeName === 'P') && text && !text.endsWith('\n')) text += '\n';
        walk(child);
      }
    });
  walk(el);
  return text;
}

/** Types plain text at the caret, keeping line breaks as text rather than new blocks. */
function insertPlain(text: string) {
  text.split('\n').forEach((line, i) => {
    if (i && !document.execCommand('insertLineBreak')) document.execCommand('insertText', false, '\n');
    if (line) document.execCommand('insertText', false, line);
  });
}

type EditableProps = {
  id: string;
  field: string;
  value: string;
  as?: 'div' | 'span';
  className?: string;
  /** Enter adds a line break (⌘/Ctrl+Enter or Esc finishes) instead of finishing. */
  multiline?: boolean;
  /** Stored upper-case, like the matching sidebar field. */
  upper?: boolean;
  /** Hidden while empty, unless it is being edited. */
  optional?: boolean;
};

/** A node text that turns into an in-place editor on double-click; edits go to the store as you type. */
function Editable(props: EditableProps) {
  const { id, field, value, as: Tag = 'span', className, optional } = props;
  const editing = useUi((s) => s.editing?.id === id && s.editing.field === field);
  if (editing) return <InlineEditor {...props} />;
  if (!value && optional) return null;
  return (
    <Tag className={className} data-field={field}>
      {value || '\u00a0'}
    </Tag>
  );
}

function InlineEditor({ id, field, value, as: Tag = 'span', className, multiline, upper }: EditableProps) {
  const ref = useRef<HTMLElement>(null);
  const initial = useRef(value);

  // The editor is uncontrolled: React never re-renders its text, so the caret stays put while the store updates.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = initial.current;
    el.focus();
    getSelection()?.selectAllChildren(el);
  }, []);

  const save = (text: string) => {
    const next = upper ? text.toLocaleUpperCase(locale) : text;
    if (next !== value) useEditor.getState().updateNodeData(id, { [field]: next });
  };

  // Browsers keep a placeholder line break after a trailing Enter; drop trailing breaks once editing ends.
  const finish = () => {
    save(readText(ref.current!).replace(/\n+$/, ''));
    stopEditing();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' || (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      ref.current?.blur();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      insertPlain('\n');
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    insertPlain(multiline ? text : text.replace(/\s*\n\s*/g, ' '));
  };

  return (
    <Tag
      ref={ref as never}
      className={cx(className, 'fd-editing nodrag', upper && 'is-upper')}
      data-field={field}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      onInput={() => save(readText(ref.current!))}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      onBlur={finish}
    />
  );
}

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

function CardNode({ id, data, selected }: NodeProps<NodeOf<'card'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-node fd-card', `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={140} minHeight={70} />
      <div className="fd-card-top">
        <Editable id={id} field="tag" value={data.tag} className="fd-tag" upper optional />
        {Icon && <Icon className="fd-card-icon" size={16} strokeWidth={1.75} aria-hidden />}
      </div>
      <div className="fd-card-title">
        <Editable id={id} field="title" value={data.title} className={cx(data.highlight && 'fd-mark')} />
      </div>
      <Editable id={id} field="subtitle" value={data.subtitle} as="div" className="fd-card-sub" optional />
      <Handles />
    </div>
  );
}

function LaneNode({ id, data, selected }: NodeProps<NodeOf<'lane'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-lane', data.dashed && 'is-dashed', `tone-${data.tone}`, selected && 'is-selected')}>
      <Resizer selected={selected} minWidth={320} minHeight={70} />
      <div className="fd-lane-head">
        {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
        <Editable id={id} field="label" value={data.label} upper />
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

function NoteNode({ id, data, selected }: NodeProps<NodeOf<'note'>>) {
  const Icon = NOTE_ICON[data.kind] ?? CircleAlert;
  return (
    <div className={cx('fd-node fd-note', `kind-${data.kind}`)}>
      <Resizer selected={selected} minWidth={160} minHeight={50} />
      <Icon className="fd-note-icon" size={18} strokeWidth={1.9} aria-hidden />
      <div className="fd-note-body">
        <Editable id={id} field="title" value={data.title} as="div" className="fd-note-title" optional />
        <Editable id={id} field="text" value={data.text} as="div" className="fd-note-text" multiline optional />
      </div>
      <Handles />
    </div>
  );
}

function DecisionNode({ id, data, selected }: NodeProps<NodeOf<'decision'>>) {
  return (
    <div className={cx('fd-node fd-decision', `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={110} minHeight={80} />
      <svg className="fd-decision-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points="50,1.5 98.5,50 50,98.5 1.5,50" vectorEffect="non-scaling-stroke" />
      </svg>
      <Editable id={id} field="title" value={data.title} as="div" className="fd-decision-text" />
      <Handles />
    </div>
  );
}

function TerminalNode({ id, data }: NodeProps<NodeOf<'terminal'>>) {
  return (
    <div className={cx('fd-node fd-terminal', `tone-${data.tone}`)}>
      <Editable id={id} field="title" value={data.title} />
      <Handles />
    </div>
  );
}

function TextNode({ id, data, selected }: NodeProps<NodeOf<'text'>>) {
  return (
    <div className={cx('fd-node fd-text', `variant-${data.variant}`, `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={60} minHeight={20} />
      <Editable id={id} field="text" value={data.text} multiline />
      <Handles />
    </div>
  );
}

function ChipNode({ id, data }: NodeProps<NodeOf<'chip'>>) {
  const Icon = getIcon(data.icon);
  return (
    <div className={cx('fd-node fd-chip', `tone-${data.tone}`)}>
      {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
      <Editable id={id} field="text" value={data.text} />
      <Handles />
    </div>
  );
}

function BubbleNode({ id, data, selected }: NodeProps<NodeOf<'bubble'>>) {
  return (
    <div className={cx('fd-node fd-bubble', `side-${data.side}`, `tone-${data.tone}`)}>
      <Resizer selected={selected} minWidth={140} minHeight={50} />
      <Editable id={id} field="speaker" value={data.speaker} as="div" className="fd-bubble-speaker" upper optional />
      <Editable id={id} field="text" value={data.text} as="div" className="fd-bubble-text" multiline />
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
