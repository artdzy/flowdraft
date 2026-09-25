import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';

const supportsClosedBy = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  className?: string;
  children: ReactNode;
};

/** Native modal <dialog>: top layer, focus trap, Esc/back gesture and light dismiss. */
export function Modal({ open, onClose, title, titleId, className, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onCloseRef.current();
    // Fallback light dismiss for browsers without <dialog closedby> (Safari).
    const handleClick = (event: MouseEvent) => {
      if (supportsClosedBy || event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = r.top <= event.clientY && event.clientY <= r.bottom && r.left <= event.clientX && event.clientX <= r.right;
      if (!inside) dialog.close();
    };
    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('click', handleClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleClick);
    };
  }, []);

  return (
    <dialog ref={ref} className={`fd-modal ${className ?? ''}`} aria-labelledby={titleId} {...{ closedby: 'any' }}>
      <div className="fd-modal-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="fd-icon-btn" onClick={() => ref.current?.close()} aria-label={t('Kapat', 'Close')}>
          <X size={18} />
        </button>
      </div>
      {open && <div className="fd-modal-body">{children}</div>}
    </dialog>
  );
}
