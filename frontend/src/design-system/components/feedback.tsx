import {
  useEffect,
  useId,
  useState,
  type HTMLAttributes,
  type ImgHTMLAttributes,
  type ReactNode,
} from 'react';
import { IconButton } from './actions';

export function Badge({
  variant = 'neutral',
  children,
}: {
  variant?: 'neutral' | 'accent';
  children: ReactNode;
}) {
  return <span className={`tvx-badge tvx-badge--${variant}`}>{children}</span>;
}
export function StatusTag({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'ai';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`tvx-status tvx-status--${tone}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
export function Avatar({
  name,
  src,
  alt,
  size = 'md',
  variant = 'person',
  ...props
}: {
  name: string;
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'person' | 'company';
} & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>) {
  const [broken, setBroken] = useState(false);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?';
  const label = alt === undefined ? undefined : alt;
  return (
    <span
      className={`tvx-avatar tvx-avatar--${size} tvx-avatar--${variant}`}
      role={!src || broken ? 'img' : undefined}
      aria-label={!src || broken ? (label ?? name) : undefined}
    >
      {src && !broken ? (
        <img
          {...props}
          src={src}
          alt={label ?? ''}
          onError={() => setBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
export function Progress({
  value,
  max = 100,
  label = 'Progress',
  valueText,
}: {
  value?: number;
  max?: number;
  label?: string;
  valueText?: string;
}) {
  if (value === undefined)
    return (
      <span
        className="tvx-progress tvx-progress--indeterminate"
        role="progressbar"
        aria-label={label}
      />
    );
  return (
    <span className="tvx-progress-wrap">
      <progress
        className="tvx-progress"
        value={value}
        max={max}
        aria-label={label}
      />
      <span>{valueText ?? `${Math.round((value / max) * 100)}%`}</span>
    </span>
  );
}
export function Skeleton({
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`tvx-skeleton ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
export function Divider({
  orientation = 'horizontal',
  decorative = false,
}: {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}) {
  return (
    <hr
      className={`tvx-divider tvx-divider--${orientation}`}
      role={decorative ? 'presentation' : 'separator'}
      aria-orientation={orientation}
    />
  );
}
export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  dismissible = false,
  urgent = false,
  onDismiss,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
  urgent?: boolean;
  onDismiss?: () => void;
}) {
  return (
    <section
      className={`tvx-alert tvx-alert--${tone}`}
      role={urgent ? 'alert' : 'status'}
    >
      <div>
        {title && <h3>{title}</h3>}
        <div>{children}</div>
        {actions && <div className="tvx-alert__actions">{actions}</div>}
      </div>
      {dismissible && (
        <IconButton
          icon="×"
          aria-label="Dismiss alert"
          variant="quiet"
          onClick={onDismiss}
        />
      )}
    </section>
  );
}

export interface ComboboxOption {
  value: string;
  label: string;
}
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose an option',
  loading = false,
  disabled = false,
  error,
  hint,
  readOnly = false,
}: {
  label: string;
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  readOnly?: boolean;
}) {
  const uid = useId();
  const inputId = `combo-${uid}`;
  const listId = `combo-list-${uid}`;
  const [query, setQuery] = useState(
    options.find((o) => o.value === value)?.label ?? '',
  );
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );
  const choose = (o: ComboboxOption) => {
    if (readOnly) return;
    setQuery(o.label);
    onChange?.(o.value);
    setOpen(false);
  };
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  // Synchronize the editable label when a controlled selection changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(options.find((o) => o.value === value)?.label ?? '');
  }, [options, value]);
  return (
    <div className="tvx-form-field tvx-combobox">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className="tvx-input"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && filtered[active] ? `${listId}-${active}` : undefined
        }
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(' ') || undefined
        }
        aria-readonly={readOnly || undefined}
        value={query}
        placeholder={placeholder}
        disabled={disabled || readOnly}
        aria-busy={loading || undefined}
        onFocus={() => {
          setQuery('');
          setOpen(true);
          setActive(-1);
        }}
        onClick={() => {
          if (!open) {
            setQuery('');
            setOpen(true);
            setActive(-1);
          }
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 0)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            setActive((i) =>
              i < 0 ? Math.max(filtered.length - 1, 0) : Math.max(i - 1, 0),
            );
          } else if (e.key === 'Home') {
            e.preventDefault();
            setActive(0);
          } else if (e.key === 'End') {
            e.preventDefault();
            setActive(Math.max(filtered.length - 1, 0));
          } else if (e.key === 'Enter' && open && filtered[active]) {
            e.preventDefault();
            choose(filtered[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          } else if (e.key === 'Tab') {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="tvx-combobox__list">
          {loading ? (
            <li>Loading options…</li>
          ) : filtered.length ? (
            filtered.map((o, i) => (
              <li
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={i === active ? 'is-active' : ''}
                key={o.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
              >
                {o.label}
              </li>
            ))
          ) : (
            <li>No options found</li>
          )}
        </ul>
      )}
      {hint && (
        <span id={hintId} className="tvx-field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="tvx-field-error">
          {error}
        </span>
      )}
      <span className="visually-hidden" aria-live="polite">
        {loading
          ? 'Loading options'
          : open
            ? `${filtered.length} options available`
            : ''}
      </span>
    </div>
  );
}
