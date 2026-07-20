/* eslint-disable jsx-a11y/no-static-element-interactions -- Tooltip delegates keyboard focus to its native interactive child. */
import {
  forwardRef,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
} from 'react';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'regular' | 'compact';
  loading?: boolean | undefined;
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'regular',
      loading = false,
      loadingLabel = 'Loading',
      leadingIcon,
      trailingIcon,
      children,
      disabled,
      type = 'button',
      className = '',
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`tvx-button tvx-button--${variant} tvx-button--${size} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Spinner decorative />
            <span>{loadingLabel}</span>
          </>
        ) : (
          <>
            {leadingIcon && <span aria-hidden="true">{leadingIcon}</span>}
            <span>{children}</span>
            {trailingIcon && <span aria-hidden="true">{trailingIcon}</span>}
          </>
        )}
      </button>
    );
  },
);

export type IconButtonProps = Omit<
  ButtonProps,
  'children' | 'leadingIcon' | 'trailingIcon' | 'aria-label'
> & { 'aria-label': string; icon: ReactNode };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, loading, ...props }, ref) {
    return (
      <Button
        ref={ref}
        className="tvx-icon-button"
        loading={loading}
        loadingLabel={props['aria-label']}
        {...props}
      >
        {icon}
      </Button>
    );
  },
);

export type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: 'inline' | 'standalone' | 'subdued';
};
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { variant = 'inline', target, rel, children, className = '', ...props },
  ref,
) {
  const external = target === '_blank';
  return (
    <a
      ref={ref}
      target={target}
      rel={external ? (rel ?? 'noopener noreferrer') : rel}
      className={`tvx-link tvx-link--${variant} ${className}`}
      {...props}
    >
      {children}
      {external && (
        <>
          <span aria-hidden="true"> ↗</span>
          <span className="visually-hidden"> (opens in a new tab)</span>
        </>
      )}
    </a>
  );
});

export function Spinner({
  label = 'Loading',
  decorative = false,
}: {
  label?: string;
  decorative?: boolean;
}) {
  return (
    <span
      className="tvx-spinner"
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    />
  );
}

export function Tooltip({
  content,
  children,
  delay = 350,
}: {
  content: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  delay?: number;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const show = () => {
    timer.current = window.setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  if (!isValidElement(children))
    throw new Error('Tooltip requires one interactive element.');
  const describedBy =
    [children.props['aria-describedby'], open ? id : undefined]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <span
      className="tvx-tooltip"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === 'Escape') hide();
      }}
    >
      {cloneElement(
        children,
        describedBy ? { 'aria-describedby': describedBy } : {},
      )}
      {open && (
        <span id={id} role="tooltip" className="tvx-tooltip__bubble">
          {content}
        </span>
      )}
    </span>
  );
}
