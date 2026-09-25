import { ArrowLeftRight, ArrowRight, Copy, Minus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { EDGE_DEFAULTS, EDGE_COLOR } from '../flow/defaults';
import type { EdgeColor, FlowEdgeData, FlowNode, NoteKind, SimpleTone, TextVariant, Tone } from '../flow/types';
import { useEditor } from '../store/editor';
import { IconPicker, Segmented, Swatches, Switch, TextInput } from './fields';

const SIMPLE_TONES: { value: SimpleTone; label: string }[] = [
  { value: 'default', label: 'Normal' },
  { value: 'accent', label: 'Vurgu' },
  { value: 'muted', label: 'Soluk' },
];

const CARD_TONES: { value: Tone; label: string; title: string }[] = [
  { value: 'default', label: 'Normal', title: 'Normal' },
  { value: 'accent', label: 'Vurgu', title: 'Kırmızı vurgu' },
  { value: 'gate', label: 'Kapı', title: 'İnsan onayı: beyaz çerçeve' },
  { value: 'muted', label: 'Soluk', title: 'Soluk' },
];

const COLORS: { value: EdgeColor; title: string }[] = [
  { value: 'light', title: 'Açık gri' },
  { value: 'accent', title: 'Kırmızı' },
  { value: 'muted', title: 'Koyu gri' },
  { value: 'blue', title: 'Mavi' },
  { value: 'green', title: 'Yeşil' },
  { value: 'amber', title: 'Turuncu' },
];

function LinePreview({ line }: { line: FlowEdgeData['line'] }) {
  const dash = line === 'dashed' ? '6 5' : line === 'dotted' ? '0.1 5' : undefined;
  return (
    <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden>
      <line
        x1="2"
        y1="5"
        x2="32"
        y2="5"
        stroke="currentColor"
        strokeWidth={line === 'dotted' ? 2.4 : 1.6}
        strokeDasharray={dash}
        strokeLinecap={line === 'dotted' ? 'round' : 'butt'}
      />
    </svg>
  );
}

export function EdgeStyleFields({
  value,
  onChange,
  withLabel,
}: {
  value: FlowEdgeData;
  onChange: (patch: Partial<FlowEdgeData>) => void;
  withLabel: boolean;
}) {
  return (
    <>
      <Segmented
        label="Çizgi"
        value={value.line}
        onChange={(line) => onChange({ line })}
        options={[
          { value: 'solid', label: <LinePreview line="solid" />, title: 'Düz çizgi' },
          { value: 'dashed', label: <LinePreview line="dashed" />, title: 'Kesikli çizgi' },
          { value: 'dotted', label: <LinePreview line="dotted" />, title: 'Noktalı çizgi' },
        ]}
      />
      <Swatches
        label="Renk"
        value={value.color}
        onChange={(color) => onChange({ color })}
        options={COLORS.map((c) => ({ ...c, color: EDGE_COLOR[c.value] }))}
      />
      <Segmented
        label="Yol"
        value={value.path}
        onChange={(path) => onChange({ path })}
        options={[
          { value: 'smooth', label: 'Köşeli' },
          { value: 'bezier', label: 'Eğri' },
          { value: 'straight', label: 'Düz' },
        ]}
      />
      <Segmented
        label="Ok"
        value={value.arrow}
        onChange={(arrow) => onChange({ arrow })}
        options={[
          { value: 'end', label: <ArrowRight size={15} />, title: 'Sonda ok' },
          { value: 'both', label: <ArrowLeftRight size={15} />, title: 'İki uçta ok' },
          { value: 'none', label: <Minus size={15} />, title: 'Oksuz' },
        ]}
      />
      <Switch label="Akış animasyonu" checked={value.animated} onChange={(animated) => onChange({ animated })} />
      {withLabel && (
        <TextInput label="Etiket" value={value.label} placeholder="ör. evet, tetik" onChange={(label) => onChange({ label })} />
      )}
    </>
  );
}

function NodeFields({ node }: { node: FlowNode }) {
  const update = useEditor((s) => s.updateNodeData);
  const set = (patch: Record<string, unknown>) => update(node.id, patch);

  switch (node.type) {
    case 'card': {
      const d = node.data;
      return (
        <>
          <TextInput label="Başlık" value={d.title} onChange={(title) => set({ title })} />
          <TextInput label="Alt yazı" value={d.subtitle} onChange={(subtitle) => set({ subtitle })} />
          <TextInput label="Etiket" value={d.tag} placeholder="ör. BOT, SEN, API" onChange={(tag) => set({ tag: tag.toLocaleUpperCase('tr') })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label="Görünüm" value={d.tone} options={CARD_TONES} onChange={(tone) => set({ tone })} />
          <Switch label="Başlığı vurgula" checked={d.highlight} onChange={(highlight) => set({ highlight })} />
        </>
      );
    }
    case 'lane': {
      const d = node.data;
      return (
        <>
          <TextInput label="Kulvar adı" value={d.label} onChange={(label) => set({ label: label.toLocaleUpperCase('tr') })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label="Renk" value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
          <Switch label="Kesikli çerçeve (otomatik bölge)" checked={d.dashed} onChange={(dashed) => set({ dashed })} />
        </>
      );
    }
    case 'note': {
      const d = node.data;
      return (
        <>
          <Segmented<NoteKind>
            label="Tür"
            value={d.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'note', label: 'Not' },
              { value: 'info', label: 'Bilgi' },
              { value: 'warning', label: 'Uyarı' },
              { value: 'danger', label: 'Hata' },
              { value: 'success', label: 'Tamam' },
            ]}
          />
          <TextInput label="Başlık" value={d.title} onChange={(title) => set({ title })} />
          <TextInput label="Metin" value={d.text} multiline onChange={(text) => set({ text })} />
        </>
      );
    }
    case 'decision':
    case 'terminal': {
      const d = node.data;
      return (
        <>
          <TextInput label={node.type === 'decision' ? 'Soru' : 'Metin'} value={d.title} onChange={(title) => set({ title })} />
          <Segmented label="Renk" value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'text': {
      const d = node.data;
      return (
        <>
          <TextInput label="Metin" value={d.text} multiline onChange={(text) => set({ text })} />
          <Segmented<TextVariant>
            label="Stil"
            value={d.variant}
            onChange={(variant) => set({ variant })}
            options={[
              { value: 'heading', label: 'Başlık' },
              { value: 'label', label: 'Etiket' },
              { value: 'body', label: 'Metin' },
            ]}
          />
          <Segmented label="Renk" value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'chip': {
      const d = node.data;
      return (
        <>
          <TextInput label="Metin" value={d.text} onChange={(text) => set({ text })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label="Renk" value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'bubble': {
      const d = node.data;
      return (
        <>
          <TextInput label="Konuşan" value={d.speaker} onChange={(speaker) => set({ speaker: speaker.toLocaleUpperCase('tr') })} />
          <TextInput label="Mesaj" value={d.text} multiline onChange={(text) => set({ text })} />
          <Segmented
            label="Yön"
            value={d.side}
            onChange={(side) => set({ side })}
            options={[
              { value: 'left', label: 'Sol' },
              { value: 'right', label: 'Sağ' },
            ]}
          />
          <Segmented label="Renk" value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
  }
}

const KIND_LABEL: Record<FlowNode['type'], string> = {
  card: 'Adım',
  lane: 'Kulvar',
  note: 'Not / uyarı',
  decision: 'Karar',
  terminal: 'Başla / bitir',
  text: 'Yazı',
  chip: 'Çip',
  bubble: 'Mesaj',
};

function SelectionActions() {
  const duplicate = useEditor((s) => s.duplicateSelection);
  const remove = useEditor((s) => s.deleteSelection);
  const hasNodes = useEditor((s) => s.nodes.some((n) => n.selected));
  return (
    <div className="fd-inspector-actions">
      {hasNodes && (
        <button type="button" className="fd-btn" onClick={duplicate}>
          <Copy size={15} /> Çoğalt
        </button>
      )}
      <button type="button" className="fd-btn is-danger" onClick={remove}>
        <Trash2 size={15} /> Sil
      </button>
    </div>
  );
}

export function Inspector() {
  const nodes = useEditor(useShallow((s) => s.nodes.filter((n) => n.selected)));
  const edges = useEditor(useShallow((s) => s.edges.filter((e) => e.selected)));
  const updateEdges = useEditor((s) => s.updateEdges);
  const edgeDraft = useEditor((s) => s.edgeDraft);
  const setEdgeDraft = useEditor((s) => s.setEdgeDraft);

  if (nodes.length === 1 && edges.length === 0) {
    const node = nodes[0];
    return (
      <div className="fd-inspector">
        <h2 className="fd-inspector-title">{KIND_LABEL[node.type]}</h2>
        <NodeFields key={node.id} node={node} />
        <SelectionActions />
      </div>
    );
  }

  if (nodes.length === 0 && edges.length > 0) {
    const value = { ...EDGE_DEFAULTS, ...edges[0].data };
    return (
      <div className="fd-inspector">
        <h2 className="fd-inspector-title">{edges.length > 1 ? `${edges.length} bağlantı` : 'Bağlantı'}</h2>
        <EdgeStyleFields
          value={value}
          withLabel={edges.length === 1}
          onChange={(patch) => updateEdges(edges.map((e) => e.id), patch)}
        />
        <SelectionActions />
      </div>
    );
  }

  if (nodes.length + edges.length > 1) {
    return (
      <div className="fd-inspector">
        <h2 className="fd-inspector-title">{nodes.length + edges.length} öğe seçili</h2>
        <p className="fd-inspector-hint">Birlikte taşıyabilir, çoğaltabilir ya da silebilirsin.</p>
        <SelectionActions />
      </div>
    );
  }

  return (
    <div className="fd-inspector">
      <h2 className="fd-inspector-title">Yeni bağlantı stili</h2>
      <p className="fd-inspector-hint">Bundan sonra çizeceğin oklar bu stille başlar.</p>
      <EdgeStyleFields value={edgeDraft} withLabel={false} onChange={setEdgeDraft} />
      <div className="fd-shortcuts">
        <h3>Kısayollar</h3>
        <dl>
          <dt>Sil</dt>
          <dd>Delete / ⌫</dd>
          <dt>Geri al / ileri</dt>
          <dd>⌘Z / ⇧⌘Z</dd>
          <dt>Çoğalt</dt>
          <dd>⌘D</dd>
          <dt>Kaydet</dt>
          <dd>⌘S</dd>
          <dt>Çoklu seçim</dt>
          <dd>⇧ + sürükle</dd>
        </dl>
      </div>
    </div>
  );
}
