import type { DragEvent } from 'react';
import { getIcon } from '../flow/icons';
import { DND_MIME, PALETTE, type PaletteItem } from '../flow/palette';
import { useAddNode } from './useAddNode';

export function Palette({ onAdded }: { onAdded?: () => void }) {
  const add = useAddNode();

  const onDragStart = (event: DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData(DND_MIME, item.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="fd-palette">
      {PALETTE.map((group) => (
        <section key={group.title} className="fd-palette-group" aria-label={group.title}>
          <h3>{group.title}</h3>
          <div className="fd-palette-items">
            {group.items.map((item) => {
              const Icon = getIcon(item.icon);
              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  className={`fd-palette-item kind-${item.kind} id-${item.id}`}
                  onDragStart={(e) => onDragStart(e, item)}
                  onClick={() => {
                    add(item);
                    onAdded?.();
                  }}
                  title="Tuvale sürükle ya da tıkla"
                >
                  <span className="fd-palette-icon">{Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="fd-palette-tip">
        Kutuların kenarındaki noktalardan sürükleyerek bağla. Çizgiye tıklayıp stilini değiştir.
      </p>
    </div>
  );
}
