import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type FormHTMLAttributes,
} from 'react';
import { Button } from './actions';

export function Form({
  busy = false,
  children,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { busy?: boolean }) {
  return (
    <form
      {...props}
      noValidate={props.noValidate ?? true}
      aria-busy={busy || undefined}
    >
      {children}
    </form>
  );
}

export const FieldHint = ({
  id,
  children,
}: {
  id?: string | undefined;
  children: ReactNode;
}) => (
  <span id={id} className="tvx-field-hint">
    {children}
  </span>
);
export const FieldError = ({
  id,
  children,
}: {
  id?: string | undefined;
  children: ReactNode;
}) => (
  <span id={id} className="tvx-field-error">
    {children}
  </span>
);
export function FormField({
  id,
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  id?: string | undefined;
  label: string;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  children: (control: {
    id: string;
    describedBy?: string | undefined;
    invalid: boolean;
  }) => ReactNode;
}) {
  const uid = useId();
  const cid = id ?? `field-${uid}`;
  const hid = hint ? `${cid}-hint` : undefined;
  const eid = error ? `${cid}-error` : undefined;
  return (
    <div className="tvx-form-field">
      <label htmlFor={cid}>
        {label}
        {required && <span> (required)</span>}
        {optional && <span className="tvx-optional"> (optional)</span>}
      </label>
      {children({
        id: cid,
        describedBy: [hid, eid].filter(Boolean).join(' ') || undefined,
        invalid: Boolean(error),
      })}
      {hint && <FieldHint id={hid}>{hint}</FieldHint>}
      {error && <FieldError id={eid}>{error}</FieldError>}
    </div>
  );
}

interface FieldBase {
  label?: string | undefined;
  hint?: ReactNode | undefined;
  error?: ReactNode | undefined;
  loading?: boolean | undefined;
}
export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> &
  FieldBase;
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, hint, error, id, required, loading, disabled, ...props },
    ref,
  ) {
    const control = (
      <FormField
        id={id}
        label={label ?? props['aria-label'] ?? 'Text field'}
        required={required}
        hint={hint}
        error={error}
      >
        {(c) => (
          <input
            ref={ref}
            className="tvx-input"
            {...props}
            id={c.id}
            required={required}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            aria-invalid={c.invalid || undefined}
            aria-describedby={c.describedBy}
          />
        )}
      </FormField>
    );
    return control;
  },
);
export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldBase;
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, hint, error, id, required, ...props }, ref) {
    return (
      <FormField
        id={id}
        label={label ?? props['aria-label'] ?? 'Text area'}
        required={required}
        hint={hint}
        error={error}
      >
        {(c) => (
          <textarea
            ref={ref}
            className="tvx-input tvx-textarea"
            {...props}
            id={c.id}
            required={required}
            aria-invalid={c.invalid || undefined}
            aria-describedby={c.describedBy}
          />
        )}
      </FormField>
    );
  },
);

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  label: string;
  description?: string | undefined;
  error?: string;
  indeterminate?: boolean;
  readOnly?: boolean | undefined;
};
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      label,
      description,
      error,
      indeterminate,
      readOnly,
      onChange,
      id,
      ...props
    },
    ref,
  ) {
    const uid = useId();
    const cid = id ?? `check-${uid}`;
    const own = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
      if (own.current) own.current.indeterminate = Boolean(indeterminate);
    }, [indeterminate]);
    return (
      <label className="tvx-choice">
        <input
          {...props}
          id={cid}
          type="checkbox"
          ref={(node) => {
            own.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          aria-invalid={Boolean(error) || undefined}
          disabled={props.disabled || readOnly}
          aria-readonly={readOnly || undefined}
          onChange={onChange}
        />
        <span>
          <strong>{label}</strong>
          {description && <small>{description}</small>}
          {error && <FieldError>{error}</FieldError>}
        </span>
      </label>
    );
  },
);

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
export function RadioGroup({
  legend,
  name,
  options,
  value,
  onChange,
  disabled,
  readOnly,
  error,
}: {
  legend: string;
  name: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
}) {
  return (
    <fieldset
      className="tvx-radio"
      disabled={disabled || readOnly}
      aria-invalid={Boolean(error) || undefined}
    >
      <legend>{legend}</legend>
      {options.map((o) => (
        <label className="tvx-choice" key={o.value}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange?.(o.value)}
          />
          <span>
            <strong>{o.label}</strong>
            {o.description && <small>{o.description}</small>}
          </span>
        </label>
      ))}
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}
export function Switch({
  label,
  description,
  readOnly,
  ...props
}: CheckboxProps) {
  return (
    <Checkbox
      {...props}
      readOnly={readOnly}
      label={label}
      description={description}
      role="switch"
      className="tvx-switch"
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldBase & {
    options: SelectOption[];
    placeholder?: string;
    readOnly?: boolean;
  };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      label,
      options,
      placeholder = 'Choose an option',
      error,
      hint,
      id,
      readOnly,
      onChange,
      loading,
      ...props
    },
    ref,
  ) {
    return (
      <FormField
        id={id}
        label={label ?? props['aria-label'] ?? 'Select'}
        hint={hint}
        error={error}
      >
        {(c) => (
          <select
            ref={ref}
            className="tvx-input"
            {...props}
            id={c.id}
            disabled={props.disabled || loading || readOnly}
            aria-busy={loading || undefined}
            aria-readonly={readOnly || undefined}
            aria-invalid={c.invalid || undefined}
            aria-describedby={c.describedBy}
            onChange={onChange}
          >
            <option value="">
              {loading ? 'Loading options…' : placeholder}
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))}
          </select>
        )}
      </FormField>
    );
  },
);

export function SearchField({
  label = 'Search',
  loading = false,
  onSearch,
  ...props
}: Omit<TextFieldProps, 'type' | 'label'> & {
  label?: string;
  onSearch?: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form
      className="tvx-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch?.(ref.current?.value ?? '');
      }}
    >
      <TextField
        ref={ref}
        type="search"
        label={label}
        loading={loading}
        {...props}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.currentTarget.value = '';
            e.currentTarget.dispatchEvent(
              new Event('input', { bubbles: true }),
            );
          }
          props.onKeyDown?.(e);
        }}
      />
      <Button
        type="submit"
        variant="secondary"
        disabled={props.disabled || loading}
      >
        Search
      </Button>
      <Button
        type="button"
        variant="quiet"
        disabled={props.disabled || loading}
        onClick={() => {
          if (ref.current) {
            ref.current.value = '';
            ref.current.focus();
            ref.current.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }}
      >
        Clear
      </Button>
    </form>
  );
}
export const DateField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, 'type'>
>(function DateField(props, ref) {
  return <TextField ref={ref} type="date" {...props} />;
});
export const TimeField = forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, 'type'>
>(function TimeField(props, ref) {
  return <TextField ref={ref} type="time" {...props} />;
});

export function FormSection({
  legend,
  heading,
  description,
  children,
  disabled = false,
}: {
  legend?: string;
  heading?: string;
  description?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (legend)
    return (
      <fieldset className="tvx-form-section" disabled={disabled}>
        <legend>{legend}</legend>
        {description && <p>{description}</p>}
        {children}
      </fieldset>
    );
  return (
    <section className="tvx-form-section">
      {heading && <h2>{heading}</h2>}
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}
export const FormActions = ({
  align = 'end',
  children,
}: {
  align?: 'start' | 'end' | 'between';
  children: ReactNode;
}) => (
  <div className={`tvx-form-actions tvx-form-actions--${align}`}>
    {children}
  </div>
);
export interface ErrorSummaryItem {
  fieldId: string;
  message: string;
}
export const ErrorSummary = forwardRef<
  HTMLDivElement,
  { title?: string; errors: ErrorSummaryItem[] }
>(function ErrorSummary(
  { title = 'Check the highlighted fields', errors },
  ref,
) {
  if (!errors.length) return null;
  return (
    <div ref={ref} className="tvx-error-summary" role="alert" tabIndex={-1}>
      <h2>{title}</h2>
      <ul>
        {errors.map((e) => (
          <li key={e.fieldId}>
            <a
              href={`#${e.fieldId}`}
              onClick={() =>
                window.setTimeout(
                  () => document.getElementById(e.fieldId)?.focus(),
                  0,
                )
              }
            >
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});
