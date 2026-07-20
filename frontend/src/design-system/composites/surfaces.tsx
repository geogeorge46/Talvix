import { type ElementType, type ReactNode } from 'react';
import { Skeleton, StatusTag } from '../components';

export function Card({
  as: Tag = 'section',
  heading,
  description,
  actions,
  footer,
  variant = 'bordered',
  className = '',
  children,
  headingLevel = 3,
}: {
  as?: 'div' | 'section' | 'article';
  heading?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  variant?: 'plain' | 'bordered' | 'raised' | 'interactive';
  className?: string;
  children: ReactNode;
  headingLevel?: 2 | 3 | 4;
}) {
  const CardHeading = `h${headingLevel}` as ElementType;
  return (
    <Tag className={`tvx-card tvx-card--${variant} ${className}`}>
      <div className="tvx-card__header">
        <div>
          {heading && <CardHeading>{heading}</CardHeading>}
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      <div className="tvx-card__body">{children}</div>
      {footer && <footer>{footer}</footer>}
    </Tag>
  );
}
export function MetricCard({
  label,
  value,
  trend,
  trendTone = 'neutral',
  metadata,
  isLoading = false,
  icon,
}: {
  label: string;
  value: ReactNode;
  trend?: string;
  trendTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  metadata?: ReactNode;
  isLoading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card variant="bordered">
      <div className="tvx-metric">
        <span className="tvx-metric__label">{label}</span>
        {icon && <span aria-hidden="true">{icon}</span>}{' '}
        {isLoading ? (
          <Skeleton className="tvx-metric__skeleton" />
        ) : (
          <strong>{value}</strong>
        )}
        {trend && <StatusTag tone={trendTone}>{trend}</StatusTag>}
        {metadata && <small>{metadata}</small>}
      </div>
    </Card>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  metadata,
  primaryAction,
  secondaryActions,
  level = 1,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level}` as ElementType;
  return (
    <header className="tvx-page-header">
      <div>
        {eyebrow && <div className="tvx-eyebrow">{eyebrow}</div>}
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
        {metadata && <div>{metadata}</div>}
      </div>
      {(primaryAction || secondaryActions) && (
        <div className="tvx-page-header__actions">
          {secondaryActions}
          {primaryAction}
        </div>
      )}
    </header>
  );
}
export function Toolbar({
  label,
  start,
  end,
  as = 'div',
}: {
  label: string;
  start?: ReactNode;
  end?: ReactNode;
  as?: 'div' | 'section';
}) {
  const Tag = as;
  return (
    <Tag className="tvx-toolbar" role="toolbar" aria-label={label}>
      <div>{start}</div>
      <div>{end}</div>
    </Tag>
  );
}
