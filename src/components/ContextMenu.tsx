import { useReactFlow, type XYPosition } from '@xyflow/react';
import {
  ArrowLeftRight,
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Maximize,
  PenLine,
  Scissors,
  SendToBack,
  Split,
  SquareDashedMousePointer,
  StickyNote,
  Trash2,
  Type,
  Zap,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NODE_SIZE } from '../flow/defaults';
import { editEdgeLabel } from '../flow/edges';
import { editText } from '../flow/nodes';
import type { NodeKind } from '../flow/types';
import { t } from '../i18n';
import { copySelection, cutSelection, pasteFromClipboard } from '../lib/clipboard';
import { useEditor } from '../store/editor';
import { useUi, type ContextMenuState } from '../store/ui';
import { MenuItem } from './Menu';

const snap = (v: number) => Math.round(v / 10) * 10;
const close = () => useUi.setState({ contextMenu: null });

/** Starts typing in a node that was just added, once it is on the canvas. */
function typeInto(id: string) {
  requestAnimationFrame(() => {
    const node = useEditor.getState().nodes.find((n) => n.id === id);
    if (node) editText(node);
  });
}

function Items({ menu }: { menu: ContextMenuState }) {
  const rf = useReactFlow();
  const editor = useEditor.getState();
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  const { target } = menu;

  if (target.kind === 'pane') {
    const addAt = (kind: NodeKind, data: Record<string, unknown>) => {
      const size = NODE_SIZE[kind] ?? {};
      const position = { x: snap(target.at.x - (size.width ?? 160) / 2), y: snap(target.at.y - (size.height ?? 60) / 2) };
      typeInto(editor.addNode(kind, data, position));
    };
    return (
      <>
        <MenuItem icon={<ClipboardPaste size={16} />} hint="⌘V" onSelect={run(() => void pasteFromClipboard(target.at))}>
          {t('Yapıştır', 'Paste')}
        </MenuItem>
        <div className="fd-menu-sep" />
        <MenuItem icon={<Zap size={16} />} onSelect={run(() => addAt('card', {}))}>
          {t('Adım ekle', 'Add step')}
        </MenuItem>
        <MenuItem icon={<Split size={16} />} onSelect={run(() => addAt('decision', {}))}>
          {t('Karar ekle', 'Add decision')}
        </MenuItem>
        <MenuItem icon={<StickyNote size={16} />} onSelect={run(() => addAt('note', {}))}>
          {t('Not ekle', 'Add note')}
        </MenuItem>
        <MenuItem icon={<Type size={16} />} onSelect={run(() => addAt('text', {}))}>
          {t('Yazı ekle', 'Add text')}
        </MenuItem>
        <div className="fd-menu-sep" />
        <MenuItem icon={<SquareDashedMousePointer size={16} />} hint="⌘A" onSelect={run(editor.selectAll)}>
          {t('Tümünü seç', 'Select all')}
        </MenuItem>
        <MenuItem icon={<Maximize size={16} />} hint="⇧1" onSelect={run(() => void rf.fitView({ padding: 0.15, maxZoom: 1, duration: 200 }))}>
          {t('Tümünü göster', 'Fit to screen')}
        </MenuItem>
      </>
    );
  }

  if (target.kind === 'edge') {
    const ids = editor.edges.filter((e) => e.selected).map((e) => e.id);
    return (
      <>
        {ids.length === 1 && (
          <MenuItem icon={<PenLine size={16} />} hint="⏎" onSelect={run(() => editEdgeLabel(target.id))}>
            {t('Etiketi düzenle', 'Edit label')}
          </MenuItem>
        )}
        <MenuItem icon={<ArrowLeftRight size={16} />} onSelect={run(() => editor.reverseEdges(ids))}>
          {t('Yönü ters çevir', 'Reverse direction')}
        </MenuItem>
        <div className="fd-menu-sep" />
        <MenuItem icon={<Trash2 size={16} />} hint="⌫" danger onSelect={run(editor.deleteSelection)}>
          {t('Sil', 'Delete')}
        </MenuItem>
      </>
    );
  }

  const picked = editor.nodes.filter((n) => n.selected);
  const single = picked.length === 1 ? picked[0] : null;
  const stackable = picked.some((n) => n.type !== 'lane');
  return (
    <>
      {single && (
        <MenuItem icon={<PenLine size={16} />} hint="⏎" onSelect={run(() => editText(single))}>
          {t('Metni düzenle', 'Edit text')}
        </MenuItem>
      )}
      <MenuItem icon={<Copy size={16} />} hint="⌘C" onSelect={run(() => void copySelection())}>
        {t('Kopyala', 'Copy')}
      </MenuItem>
      <MenuItem icon={<Scissors size={16} />} hint="⌘X" onSelect={run(() => void cutSelection())}>
        {t('Kes', 'Cut')}
      </MenuItem>
      <MenuItem icon={<CopyPlus size={16} />} hint="⌘D" onSelect={run(editor.duplicateSelection)}>
        {t('Çoğalt', 'Duplicate')}
      </MenuItem>
      {stackable && (
        <>
          <div className="fd-menu-sep" />
          <MenuItem icon={<BringToFront size={16} />} onSelect={run(() => editor.reorder('front'))}>
            {t('Öne getir', 'Bring to front')}
          </MenuItem>
          <MenuItem icon={<SendToBack size={16} />} onSelect={run(() => editor.reorder('back'))}>
            {t('Arkaya gönder', 'Send to back')}
          </MenuItem>
        </>
      )}
      <div className="fd-menu-sep" />
      <MenuItem icon={<Trash2 size={16} />} hint="⌫" danger onSelect={run(editor.deleteSelection)}>
        {t('Sil', 'Delete')}
      </MenuItem>
    </>
  );
}

/** Right-click menu for a node, a connection or the empty canvas; opened by the canvas, closed by any click outside. */
export function ContextMenu() {
  const menu = useUi((s) => s.contextMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<XYPosition | null>(null);

  // Measure first, then place the menu so it stays inside the window.
  useLayoutEffect(() => {
    if (!menu) {
      setPos(null);
      return;
    }
    const box = ref.current?.getBoundingClientRect();
    const w = box?.width ?? 220;
    const h = box?.height ?? 200;
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  if (!menu) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fd-menu-list fd-context"
      style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Items menu={menu} />
    </div>,
    document.body,
  );
}
