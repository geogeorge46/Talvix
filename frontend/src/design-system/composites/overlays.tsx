import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useState, type ReactNode } from 'react';
import { Button, IconButton } from '../components';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  label?: string;
  busy?: boolean;
  closeOnOutside?: boolean;
  className?: string;
}
export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  label,
  busy = false,
  closeOnOutside = true,
  className = '',
}: DialogProps) {
  return (
    <DialogPrimitive.Root
      {...(open === undefined ? {} : { open })}
      {...(defaultOpen === undefined ? {} : { defaultOpen })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {trigger && (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="tvx-overlay" />
        <DialogPrimitive.Content
          className={`tvx-dialog ${className}`}
          aria-label={label}
          aria-busy={busy || undefined}
          onPointerDownOutside={(e) => {
            if (!closeOnOutside || busy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <header>
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description>
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton
                icon="×"
                aria-label="Close dialog"
                variant="quiet"
                disabled={busy}
              />
            </DialogPrimitive.Close>
          </header>
          <div className="tvx-dialog__body">{children}</div>
          {footer && <footer>{footer}</footer>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [pending, setPending] = useState(false);
  const [internal, setInternal] = useState(false);
  const controlled = open !== undefined;
  const change = onOpenChange ?? setInternal;
  const run = async () => {
    setPending(true);
    try {
      await onConfirm();
      change(false);
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open={controlled ? open : internal}
      onOpenChange={change}
      trigger={trigger}
      title={title}
      description={description}
      busy={pending}
      footer={
        <div className="tvx-dialog__actions">
          <DialogPrimitive.Close asChild>
            <Button variant="secondary" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogPrimitive.Close>
          <Button
            variant={variant === 'destructive' ? 'danger' : 'primary'}
            loading={pending}
            loadingLabel="Confirming"
            onClick={() => void run()}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <span />
    </Dialog>
  );
}
export function Drawer({
  side = 'end',
  ...props
}: DialogProps & { side?: 'start' | 'end' | 'bottom' }) {
  return <Dialog {...props} className={`tvx-drawer tvx-drawer--${side}`} />;
}
