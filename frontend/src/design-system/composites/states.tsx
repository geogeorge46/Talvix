import { type ReactNode } from 'react';
import { Alert, Button, Spinner } from '../components';
import { Card } from './surfaces';

interface StateProps {
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  visual?: ReactNode;
}
export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  visual,
}: StateProps) {
  return (
    <Card>
      <div className="tvx-state">
        {visual && <div aria-hidden>{visual}</div>}
        <h2>{title}</h2>
        <p>{description}</p>
        <div>
          {action}
          {secondaryAction}
        </div>
      </div>
    </Card>
  );
}
export function FilteredEmptyState({
  onClear,
  ...props
}: Omit<StateProps, 'action'> & { onClear: () => void }) {
  return (
    <EmptyState
      {...props}
      action={<Button onClick={onClear}>Clear filters</Button>}
    />
  );
}
export function ErrorState({
  title = 'Something went wrong',
  detail,
  retry,
  retryLoading = false,
  referenceId,
  variant = 'section',
}: {
  title?: string;
  detail: string;
  retry?: () => void;
  retryLoading?: boolean;
  referenceId?: string;
  variant?: 'inline' | 'section' | 'page';
}) {
  const safe = referenceId?.replace(/[^a-zA-Z0-9-_]/g, '');
  return (
    <div className={`tvx-state tvx-state--${variant}`}>
      <Alert tone="danger" title={title} urgent={variant === 'inline'}>
        <p>{detail}</p>
        {safe && (
          <p>
            Reference: <code>{safe}</code>
          </p>
        )}
        {retry && (
          <Button variant="secondary" onClick={retry} loading={retryLoading}>
            Try again
          </Button>
        )}
      </Alert>
    </div>
  );
}
export function LoadingState({
  label = 'Loading',
  lines = 3,
}: {
  label?: string;
  lines?: number;
}) {
  return (
    <section className="tvx-state" aria-busy="true" aria-label={label}>
      <Spinner label={label} />
      <span>{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <span className="tvx-state__line" aria-hidden key={i} />
      ))}
    </section>
  );
}
function SystemState({
  title,
  description,
  action,
  tone = 'info',
}: StateProps & { tone?: 'info' | 'warning' | 'danger' }) {
  return (
    <Card>
      <Alert tone={tone} title={title}>
        <p>{description}</p>
        {action && <div>{action}</div>}
      </Alert>
    </Card>
  );
}
export const PermissionState = (p: Partial<StateProps>) => (
  <SystemState
    title={p.title ?? 'Access unavailable'}
    description={
      p.description ?? 'You do not have permission to view this content.'
    }
    action={p.action}
  />
);
export const SessionExpiredState = ({
  onReauthenticate,
  description = 'Your session ended. Sign in again to continue.',
}: {
  onReauthenticate: () => void;
  description?: string;
}) => (
  <SystemState
    title="Session expired"
    description={description}
    action={<Button onClick={onReauthenticate}>Sign in again</Button>}
  />
);
export const PendingApprovalState = (p: Partial<StateProps>) => (
  <SystemState
    title={p.title ?? 'Approval pending'}
    description={
      p.description ??
      'Access will be available after the current review is complete.'
    }
    action={p.action}
    tone="warning"
  />
);
export const SuspendedState = (p: Partial<StateProps>) => (
  <SystemState
    title={p.title ?? 'Access suspended'}
    description={
      p.description ??
      'This workspace is temporarily unavailable. Contact your administrator for details.'
    }
    action={p.action}
    tone="danger"
  />
);
export const UnverifiedCompanyState = (p: Partial<StateProps>) => (
  <SystemState
    title={p.title ?? 'Verification required'}
    description={
      p.description ??
      'This workspace must be verified before these controls are available.'
    }
    action={p.action}
    tone="warning"
  />
);
