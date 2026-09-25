import { useReactFlow } from '@xyflow/react';
import { Maximize, Plus, Redo2, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../i18n';
import { useEditor } from '../store/editor';
import { useUi } from '../store/ui';
import { Inspector } from './Inspector';
import { Palette } from './Palette';

function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <section className="fd-sheet" aria-label={title}>
      <div className="fd-sheet-head">
        <h2>{title}</h2>
        <button type="button" className="fd-icon-btn" aria-label={t('Kapat', 'Close')} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="fd-sheet-body">{children}</div>
    </section>
  );
}

export function MobileBar() {
  const rf = useReactFlow();
  const paletteSheet = useUi((s) => s.paletteSheet);
  const inspectorSheet = useUi((s) => s.inspectorSheet);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const hasSelection = useEditor((s) => s.nodes.some((n) => n.selected) || s.edges.some((e) => e.selected));
  const remove = useEditor((s) => s.deleteSelection);

  const close = () => useUi.setState({ paletteSheet: false, inspectorSheet: false });

  return (
    <>
      <Sheet open={paletteSheet} title={t('Ekle', 'Add')} onClose={close}>
        <Palette onAdded={close} />
      </Sheet>
      <Sheet open={inspectorSheet && hasSelection} title={t('Düzenle', 'Edit')} onClose={close}>
        <Inspector />
      </Sheet>
      <nav className="fd-mobilebar" aria-label={t('Araçlar', 'Tools')}>
        <button
          type="button"
          className="fd-btn is-primary"
          onClick={() => useUi.setState({ paletteSheet: !paletteSheet, inspectorSheet: false })}
        >
          <Plus size={18} /> {t('Ekle', 'Add')}
        </button>
        <button type="button" className="fd-icon-btn" aria-label={t('Geri al', 'Undo')} onClick={undo} disabled={!canUndo}>
          <Undo2 size={19} />
        </button>
        <button type="button" className="fd-icon-btn" aria-label={t('İleri al', 'Redo')} onClick={redo} disabled={!canRedo}>
          <Redo2 size={19} />
        </button>
        <button
          type="button"
          className="fd-icon-btn"
          aria-label={t('Seçileni düzenle', 'Edit selection')}
          disabled={!hasSelection}
          onClick={() => useUi.setState({ inspectorSheet: true, paletteSheet: false })}
        >
          <SlidersHorizontal size={19} />
        </button>
        <button
          type="button"
          className="fd-icon-btn"
          aria-label={t('Seçileni sil', 'Delete selection')}
          disabled={!hasSelection}
          onClick={remove}
        >
          <Trash2 size={19} />
        </button>
        <button
          type="button"
          className="fd-icon-btn"
          aria-label={t('Tümünü göster', 'Fit to screen')}
          onClick={() => void rf.fitView({ padding: 0.15, duration: 250 })}
        >
          <Maximize size={19} />
        </button>
      </nav>
    </>
  );
}
