import { ChevronDown, Search } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { getIcon, ICON_OPTIONS } from '../flow/icons';

export function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="fd-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      {(id) =>
        multiline ? (
          <textarea id={id} value={value} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="fd-field" role="group" aria-label={label}>
      <span className="fd-field-label">{label}</span>
      <div className="fd-segmented">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-pressed={value === o.value}
            className={value === o.value ? 'is-on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="fd-switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="fd-switch-track" aria-hidden />
      <span>{label}</span>
    </label>
  );
}

export function Swatches<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; color: string; title: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="fd-field" role="group" aria-label={label}>
      <span className="fd-field-label">{label}</span>
      <div className="fd-swatches">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.title}
            aria-label={o.title}
            aria-pressed={value === o.value}
            className={value === o.value ? 'is-on' : ''}
            style={{ background: o.color }}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>
    </div>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const Current = getIcon(value);
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    return q ? ICON_OPTIONS.filter((o) => o.keywords.includes(q)) : ICON_OPTIONS;
  }, [query]);

  return (
    <div className="fd-field">
      <span className="fd-field-label">İkon</span>
      <button type="button" className="fd-icon-select" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {Current ? <Current size={16} /> : <span className="fd-muted">Yok</span>}
        <span>{value || 'İkon yok'}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="fd-icon-panel">
          <div className="fd-icon-search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              placeholder="İkon ara (ör. onay, kargo)"
              aria-label="İkon ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="fd-icon-grid">
            <button
              type="button"
              className={!value ? 'is-on' : ''}
              title="İkon yok"
              aria-label="İkon yok"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <span className="fd-muted">—</span>
            </button>
            {results.map(({ name }) => {
              const Icon = getIcon(name)!;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  className={value === name ? 'is-on' : ''}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  <Icon size={17} strokeWidth={1.75} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
