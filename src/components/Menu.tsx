import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

type Props = {
  label: ReactNode;
  ariaLabel?: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
};

export function Menu({ label, ariaLabel, buttonClassName = 'fd-btn', align = 'left', children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="fd-menu" ref={root}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open && (
        <div id={id} role="menu" className={`fd-menu-list align-${align}`}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onSelect,
  hint,
  danger,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button type="button" role="menuitem" className={`fd-menu-item${danger ? ' is-danger' : ''}`} onClick={onSelect}>
      {icon}
      <span>{children}</span>
      {hint && <kbd>{hint}</kbd>}
    </button>
  );
}
