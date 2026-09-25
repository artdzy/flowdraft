import type { Edge, Node } from '@xyflow/react';

export type Tone = 'default' | 'accent' | 'gate' | 'muted';
export type SimpleTone = 'default' | 'accent' | 'muted';

export type CardData = {
  tag: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: Tone;
  highlight: boolean;
};
export type LaneData = { label: string; icon: string; dashed: boolean; tone: SimpleTone };
export type NoteKind = 'note' | 'info' | 'warning' | 'danger' | 'success';
export type NoteData = { kind: NoteKind; title: string; text: string };
export type DecisionData = { title: string; tone: SimpleTone };
export type TerminalData = { title: string; tone: SimpleTone };
export type TextVariant = 'heading' | 'label' | 'body';
export type TextData = { text: string; variant: TextVariant; tone: SimpleTone };
export type ChipData = { text: string; icon: string; tone: SimpleTone };
export type BubbleData = { speaker: string; text: string; side: 'left' | 'right'; tone: SimpleTone };

export type NodeDataMap = {
  card: CardData;
  lane: LaneData;
  note: NoteData;
  decision: DecisionData;
  terminal: TerminalData;
  text: TextData;
  chip: ChipData;
  bubble: BubbleData;
};
export type NodeKind = keyof NodeDataMap;
export type NodeOf<K extends NodeKind> = Node<NodeDataMap[K], K>;
export type FlowNode = { [K in NodeKind]: NodeOf<K> }[NodeKind];

export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type EdgeColor = 'light' | 'accent' | 'muted' | 'blue' | 'green' | 'amber';
export type PathKind = 'smooth' | 'bezier' | 'straight';
export type ArrowKind = 'end' | 'both' | 'none';
export type FlowEdgeData = {
  line: LineStyle;
  color: EdgeColor;
  path: PathKind;
  arrow: ArrowKind;
  animated: boolean;
  label: string;
};
export type FlowEdge = Edge<FlowEdgeData, 'flow'>;

export type FlowDoc = { version: 1; nodes: FlowNode[]; edges: FlowEdge[] };
