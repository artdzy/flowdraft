import { ArrowLeftRight, ArrowRight, Copy, Minus, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { EDGE_DEFAULTS, EDGE_COLOR } from '../flow/defaults';
import type { EdgeColor, FlowEdgeData, FlowNode, NoteKind, SimpleTone, TextVariant, Tone } from '../flow/types';
import { locale, t } from '../i18n';
import { useEditor } from '../store/editor';
import { IconPicker, Segmented, Swatches, Switch, TextInput } from './fields';

const SIMPLE_TONES: { value: SimpleTone; label: string }[] = [
  { value: 'default', label: t('Normal', 'Normal') },
  { value: 'accent', label: t('Vurgu', 'Accent') },
  { value: 'muted', label: t('Soluk', 'Muted') },
];

const CARD_TONES: { value: Tone; label: string; title: string }[] = [
  { value: 'default', label: t('Normal', 'Normal'), title: t('Normal', 'Normal') },
  { value: 'accent', label: t('Vurgu', 'Accent'), title: t('Kırmızı vurgu', 'Red accent') },
  { value: 'gate', label: t('Kapı', 'Gate'), title: t('İnsan onayı: beyaz çerçeve', 'Human approval: white border') },
  { value: 'muted', label: t('Soluk', 'Muted'), title: t('Soluk', 'Muted') },
];

const COLORS: { value: EdgeColor; title: string }[] = [
  { value: 'light', title: t('Açık gri', 'Light gray') },
  { value: 'accent', title: t('Kırmızı', 'Red') },
  { value: 'muted', title: t('Koyu gri', 'Dark gray') },
  { value: 'blue', title: t('Mavi', 'Blue') },
  { value: 'green', title: t('Yeşil', 'Green') },
  { value: 'amber', title: t('Turuncu', 'Orange') },
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
        label={t('Çizgi', 'Line')}
        value={value.line}
        onChange={(line) => onChange({ line })}
        options={[
          { value: 'solid', label: <LinePreview line="solid" />, title: t('Düz çizgi', 'Solid line') },
          { value: 'dashed', label: <LinePreview line="dashed" />, title: t('Kesikli çizgi', 'Dashed line') },
          { value: 'dotted', label: <LinePreview line="dotted" />, title: t('Noktalı çizgi', 'Dotted line') },
        ]}
      />
      <Swatches
        label={t('Renk', 'Color')}
        value={value.color}
        onChange={(color) => onChange({ color })}
        options={COLORS.map((c) => ({ ...c, color: EDGE_COLOR[c.value] }))}
      />
      <Segmented
        label={t('Yol', 'Path')}
        value={value.path}
        onChange={(path) => onChange({ path })}
        options={[
          { value: 'smooth', label: t('Köşeli', 'Stepped') },
          { value: 'bezier', label: t('Eğri', 'Curved') },
          { value: 'straight', label: t('Düz', 'Straight') },
        ]}
      />
      <Segmented
        label={t('Ok', 'Arrow')}
        value={value.arrow}
        onChange={(arrow) => onChange({ arrow })}
        options={[
          { value: 'end', label: <ArrowRight size={15} />, title: t('Sonda ok', 'Arrow at end') },
          { value: 'both', label: <ArrowLeftRight size={15} />, title: t('İki uçta ok', 'Arrows at both ends') },
          { value: 'none', label: <Minus size={15} />, title: t('Oksuz', 'No arrow') },
        ]}
      />
      <Switch label={t('Akış animasyonu', 'Flow animation')} checked={value.animated} onChange={(animated) => onChange({ animated })} />
      {withLabel && (
        <TextInput label={t('Etiket', 'Label')} value={value.label} placeholder={t('ör. evet, tetik', 'e.g. yes, trigger')} onChange={(label) => onChange({ label })} />
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
          <TextInput label={t('Başlık', 'Title')} value={d.title} onChange={(title) => set({ title })} />
          <TextInput label={t('Alt yazı', 'Subtitle')} value={d.subtitle} onChange={(subtitle) => set({ subtitle })} />
          <TextInput label={t('Etiket', 'Tag')} value={d.tag} placeholder={t('ör. BOT, SEN, API', 'e.g. BOT, YOU, API')} onChange={(tag) => set({ tag: tag.toLocaleUpperCase(locale) })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label={t('Görünüm', 'Style')} value={d.tone} options={CARD_TONES} onChange={(tone) => set({ tone })} />
          <Switch label={t('Başlığı vurgula', 'Highlight title')} checked={d.highlight} onChange={(highlight) => set({ highlight })} />
        </>
      );
    }
    case 'lane': {
      const d = node.data;
      return (
        <>
          <TextInput label={t('Kulvar adı', 'Lane name')} value={d.label} onChange={(label) => set({ label: label.toLocaleUpperCase(locale) })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label={t('Renk', 'Color')} value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
          <Switch label={t('Kesikli çerçeve (otomatik bölge)', 'Dashed border (automation zone)')} checked={d.dashed} onChange={(dashed) => set({ dashed })} />
        </>
      );
    }
    case 'note': {
      const d = node.data;
      return (
        <>
          <Segmented<NoteKind>
            label={t('Tür', 'Type')}
            value={d.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'note', label: t('Not', 'Note') },
              { value: 'info', label: t('Bilgi', 'Info') },
              { value: 'warning', label: t('Uyarı', 'Warning') },
              { value: 'danger', label: t('Hata', 'Error') },
              { value: 'success', label: t('Tamam', 'OK') },
            ]}
          />
          <TextInput label={t('Başlık', 'Title')} value={d.title} onChange={(title) => set({ title })} />
          <TextInput label={t('Metin', 'Text')} value={d.text} multiline onChange={(text) => set({ text })} />
        </>
      );
    }
    case 'decision':
    case 'terminal': {
      const d = node.data;
      return (
        <>
          <TextInput label={node.type === 'decision' ? t('Soru', 'Question') : t('Metin', 'Text')} value={d.title} onChange={(title) => set({ title })} />
          <Segmented label={t('Renk', 'Color')} value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'text': {
      const d = node.data;
      return (
        <>
          <TextInput label={t('Metin', 'Text')} value={d.text} multiline onChange={(text) => set({ text })} />
          <Segmented<TextVariant>
            label={t('Stil', 'Style')}
            value={d.variant}
            onChange={(variant) => set({ variant })}
            options={[
              { value: 'heading', label: t('Başlık', 'Heading') },
              { value: 'label', label: t('Etiket', 'Label') },
              { value: 'body', label: t('Metin', 'Body') },
            ]}
          />
          <Segmented label={t('Renk', 'Color')} value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'chip': {
      const d = node.data;
      return (
        <>
          <TextInput label={t('Metin', 'Text')} value={d.text} onChange={(text) => set({ text })} />
          <IconPicker value={d.icon} onChange={(icon) => set({ icon })} />
          <Segmented label={t('Renk', 'Color')} value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
    case 'bubble': {
      const d = node.data;
      return (
        <>
          <TextInput label={t('Konuşan', 'Speaker')} value={d.speaker} onChange={(speaker) => set({ speaker: speaker.toLocaleUpperCase(locale) })} />
          <TextInput label={t('Mesaj', 'Message')} value={d.text} multiline onChange={(text) => set({ text })} />
          <Segmented
            label={t('Yön', 'Side')}
            value={d.side}
            onChange={(side) => set({ side })}
            options={[
              { value: 'left', label: t('Sol', 'Left') },
              { value: 'right', label: t('Sağ', 'Right') },
            ]}
          />
          <Segmented label={t('Renk', 'Color')} value={d.tone} options={SIMPLE_TONES} onChange={(tone) => set({ tone })} />
        </>
      );
    }
  }
}

const KIND_LABEL: Record<FlowNode['type'], string> = {
  card: t('Adım', 'Step'),
  lane: t('Kulvar', 'Lane'),
  note: t('Not / uyarı', 'Note / alert'),
  decision: t('Karar', 'Decision'),
  terminal: t('Başla / bitir', 'Start / end'),
  text: t('Yazı', 'Text'),
  chip: t('Çip', 'Chip'),
  bubble: t('Mesaj', 'Message'),
};

function SelectionActions() {
  const duplicate = useEditor((s) => s.duplicateSelection);
  const remove = useEditor((s) => s.deleteSelection);
  const hasNodes = useEditor((s) => s.nodes.some((n) => n.selected));
  return (
    <div className="fd-inspector-actions">
      {hasNodes && (
        <button type="button" className="fd-btn" onClick={duplicate}>
          <Copy size={15} /> {t('Çoğalt', 'Duplicate')}
        </button>
      )}
      <button type="button" className="fd-btn is-danger" onClick={remove}>
        <Trash2 size={15} /> {t('Sil', 'Delete')}
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
        <h2 className="fd-inspector-title">{edges.length > 1 ? t(`${edges.length} bağlantı`, `${edges.length} connections`) : t('Bağlantı', 'Connection')}</h2>
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
        <h2 className="fd-inspector-title">{t(`${nodes.length + edges.length} öğe seçili`, `${nodes.length + edges.length} items selected`)}</h2>
        <p className="fd-inspector-hint">{t('Birlikte taşıyabilir, çoğaltabilir ya da silebilirsin.', 'You can move, duplicate or delete them together.')}</p>
        <SelectionActions />
      </div>
    );
  }

  return (
    <div className="fd-inspector">
      <h2 className="fd-inspector-title">{t('Yeni bağlantı stili', 'New connection style')}</h2>
      <p className="fd-inspector-hint">{t('Bundan sonra çizeceğin oklar bu stille başlar.', 'Arrows you draw from now on start with this style.')}</p>
      <EdgeStyleFields value={edgeDraft} withLabel={false} onChange={setEdgeDraft} />
      <div className="fd-shortcuts">
        <h3>{t('Kısayollar', 'Shortcuts')}</h3>
        <dl>
          <dt>{t('Sil', 'Delete')}</dt>
          <dd>Delete / ⌫</dd>
          <dt>{t('Geri al / ileri', 'Undo / redo')}</dt>
          <dd>⌘Z / ⇧⌘Z</dd>
          <dt>{t('Çoğalt', 'Duplicate')}</dt>
          <dd>⌘D</dd>
          <dt>{t('Kaydet', 'Save')}</dt>
          <dd>⌘S</dd>
          <dt>{t('Çoklu seçim', 'Multi-select')}</dt>
          <dd>{t('⇧ + sürükle', '⇧ + drag')}</dd>
        </dl>
      </div>
    </div>
  );
}
