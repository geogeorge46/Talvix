import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Award, FileText, Eye, Download, CheckCircle2, Clock, Sparkles, Users, Search, X } from 'lucide-react';
import {
  Link as RouterLink,
  NavLink as RouterNavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Button,
  DateField,
  Form,
  FormActions,
  FormSection,
  Progress,
  Select,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system/components';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  FilteredEmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  Toolbar,
} from '../../design-system/composites';
import { useAuth } from '../../auth/AuthProvider';
import {
  createUploadSession,
  getDocumentUrl,
  safeDownload,
  useApprovals,
  useApproval,
  useApplicationDocuments,
  useCandidateOffer,
  useCandidateOffers,
  useCandidateTimeline,
  useDocumentMutation,
  useDocument,
  useDocuments,
  useManagedOffer,
  useManagedOffers,
  useOfferDocuments,
  useOfferHistory,
  useOfferMutation,
  useTemplate,
  useTemplates,
  useVerification,
  useVerificationQueue,
  xhrUpload,
} from './api';
import { ApiError } from '../../api/client';
import { useApplications } from '../ats-workspace/api';
import { DocumentPreviewDialog } from './DocumentPreviewDialog';
import {
  activeCandidateActions,
  formatBytes,
  formatMoney,
  offerTone,
  type DocumentRecord,
  type Offer,
} from './model';
import './offers-documents.css';
const validId = (id?: string) => Boolean(id && /^[a-f\d]{24}$/i.test(id));
const errorText = (e: unknown) => {
  if (e instanceof ApiError) {
    const fields = Object.entries(e.fieldErrors);
    if (fields.length > 0) {
      return `${e.message}: ${fields.map(([k, v]) => `${k} (${v})`).join(', ')}`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
};
const date = (v?: string) =>
  v
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(v),
      )
    : 'Not provided';
function OfferRow({ offer, to }: { offer: Offer; to: string }) {
  const codeBadge = `#OFFER-${offer.id.slice(-6).toUpperCase()}`;
  const statusDotClass =
    offer.status === 'accepted'
      ? 'success'
      : ['pending-approval', 'draft'].includes(offer.status)
      ? 'warning'
      : offer.status === 'sent'
      ? 'info'
      : 'neutral';

  return (
    <tr className="job-table-row">
      <td className="job-entity-cell">
        <div className="job-entity-icon">
          <Award size={18} />
        </div>
        <div className="job-entity-info">
          <strong className="job-entity-title">
            <RouterLink to={to}>{offer.title}</RouterLink>
          </strong>
          <div className="job-entity-meta">
            <span>{offer.candidateName || 'Candidate'}</span>
            <span className="job-code-badge">{codeBadge}</span>
          </div>
        </div>
      </td>
      <td>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>
          {formatMoney(offer)}
        </span>
      </td>
      <td>
        <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          Rev {offer.revisionNumber ?? 1}
        </span>
      </td>
      <td>
        <span className={`job-status-pill job-status-pill--${statusDotClass}`}>
          <span className={`job-status-dot job-status-dot--${statusDotClass}`} />
          {offer.status.replaceAll('-', ' ')}
        </span>
      </td>
      <td>
        <RouterLink
          to={to}
          className="tvx-button tvx-button--secondary tvx-button--sm"
          style={{ height: '30px', borderRadius: '9999px', fontSize: '0.78125rem' }}
        >
          View Details
        </RouterLink>
      </td>
    </tr>
  );
}

function RevisionHistoryItem({ offer, currentOfferId }: { offer: Offer; currentOfferId: string }) {
  const isCurrent = offer.id === currentOfferId;
  const statusDotClass =
    offer.status === 'accepted'
      ? 'success'
      : ['pending-approval', 'draft'].includes(offer.status)
      ? 'warning'
      : offer.status === 'sent'
      ? 'info'
      : 'neutral';

  return (
    <div
      style={{
        padding: '14px',
        borderRadius: '12px',
        border: isCurrent ? '1.5px solid #10b981' : '1px solid #e2e8f0',
        background: isCurrent ? '#f0fdf4' : '#ffffff',
        marginBottom: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: isCurrent ? '0 2px 8px rgba(16, 185, 129, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '9999px',
            background: isCurrent ? '#dcfce7' : '#f1f5f9',
            color: isCurrent ? '#15803d' : '#475569',
          }}
        >
          {isCurrent ? 'Current revision' : `Revision ${offer.revisionNumber ?? 1}`}
        </span>
        <span className={`job-status-pill job-status-pill--${statusDotClass}`}>
          <span className={`job-status-dot job-status-dot--${statusDotClass}`} />
          {offer.status.replaceAll('-', ' ')}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ display: 'block', fontSize: '0.875rem', color: '#0f172a' }}>
            {offer.title || 'Offer'}
          </strong>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            {formatMoney(offer)} · Rev {offer.revisionNumber ?? 1}
          </span>
        </div>

        {isCurrent ? (
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#059669', background: '#dcfce7', padding: '4px 10px', borderRadius: '9999px' }}>
            Viewing
          </span>
        ) : (
          <RouterLink
            to={`/org/offers/${offer.id}`}
            className="tvx-button tvx-button--secondary tvx-button--sm"
            style={{ height: '30px', borderRadius: '9999px', fontSize: '0.75rem', textDecoration: 'none', padding: '0 12px', display: 'inline-flex', alignItems: 'center' }}
          >
            View Details
          </RouterLink>
        )}
      </div>
    </div>
  );
}

function PageControls({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav className="od-pagination" aria-label="Pagination">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
function OfferTerms({ offer }: { offer: Offer }) {
  return (
    <div className="od-terms">
      <dl>
        <div>
          <dt>Role</dt>
          <dd>{offer.title}</dd>
        </div>
        <div>
          <dt>Employment</dt>
          <dd>{offer.employmentType ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Work mode</dt>
          <dd>{offer.workMode ?? 'Not provided'}</dd>
        </div>
        <div>
          <dt>Joining date</dt>
          <dd>{date(offer.joiningDate)}</dd>
        </div>
        <div>
          <dt>Compensation</dt>
          <dd>{formatMoney(offer)}</dd>
        </div>
        <div>
          <dt>Valid until</dt>
          <dd>{date(offer.expiresAt)}</dd>
        </div>
      </dl>
      {offer.benefits.length > 0 && (
        <section>
          <h3>Benefits</h3>
          <ul>
            {offer.benefits.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {offer.terms.length > 0 && (
        <section>
          <h3>Terms</h3>
          <ul>
            {offer.terms.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {offer.clauses.length > 0 && (
        <section>
          <h3>Clauses</h3>
          {[...offer.clauses]
            .sort((a, b) => a.order - b.order)
            .map((x) => (
              <article key={`${x.order}-${x.title}`}>
                <h4>{x.title}</h4>
                <p>{x.content}</p>
              </article>
            ))}
        </section>
      )}
    </div>
  );
}
export function ManagedOffersPage() {
  const { recruiter } = useAuth(),
    [sp, setSp] = useSearchParams(),
    canView = Boolean(recruiter?.permissions.includes('offers.view')),
    q = useManagedOffers(
      `page=${sp.get('page') ?? '1'}&limit=20${sp.get('status') ? `&status=${sp.get('status')}` : ''}`,
      canView,
    );
  if (!canView)
    return (
      <PermissionState description="The offers.view permission is required." />
    );
  return (
    <main>
      <PageHeader
        eyebrow="Recruitment"
        title="Offers"
        description="Prepare, approve, send, and track candidate offers."
        primaryAction={
          recruiter?.permissions.includes('offers.manage') ? (
            <Button onClick={() => location.assign('/org/offers/new')}>
              Create offer
            </Button>
          ) : undefined
        }
        secondaryActions={
          <nav className="ats-nav-tabs-wrapper" aria-label="Offer sections">
            <div className="ats-nav-tabs">
              <RouterNavLink to="/org/offers" end className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}>
                Offers
              </RouterNavLink>
              <RouterNavLink to="/org/offers/templates" className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}>
                Templates
              </RouterNavLink>
              <RouterNavLink to="/org/offers/approvals" className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}>
                Approvals
              </RouterNavLink>
            </div>
          </nav>
        }
      />

      <div className="ats-metrics-grid">
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box"><FileText size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">All Time</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Total Offers</span>
            <span className="ats-metric-card__val">{q.data?.total ?? q.data?.items.length ?? 0}</span>
            <span className="ats-metric-card__sub">Created candidate offers</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#f59e0b' }}><Clock size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--warning">Action Needed</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Pending Approval</span>
            <span className="ats-metric-card__val">
              {q.data?.items.filter((o) => o.status === 'pending-approval').length ?? 0}
            </span>
            <span className="ats-metric-card__sub">Awaiting management signoff</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#0284c7' }}><Sparkles size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--info">Out for Signature</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Active & Sent</span>
            <span className="ats-metric-card__val">
              {q.data?.items.filter((o) => o.status === 'sent').length ?? 0}
            </span>
            <span className="ats-metric-card__sub">Delivered to candidates</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#10b981' }}><CheckCircle2 size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--success">Success</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Accepted & Hired</span>
            <span className="ats-metric-card__val">
              {q.data?.items.filter((o) => o.status === 'accepted').length ?? 0}
            </span>
            <span className="ats-metric-card__sub">Signed offer agreements</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#64748b' }}><Award size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">Inactive</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Expired / Declined</span>
            <span className="ats-metric-card__val">
              {q.data?.items.filter((o) => ['expired', 'rejected', 'withdrawn', 'superseded'].includes(o.status)).length ?? 0}
            </span>
            <span className="ats-metric-card__sub">Closed without hire</span>
          </div>
        </div>
      </div>

      <Toolbar
        label="Offer filters"
        start={
          <Select
            aria-label="Status"
            value={sp.get('status') ?? ''}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'pending-approval', label: 'Pending approval' },
              { value: 'sent', label: 'Sent' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'expired', label: 'Expired' },
            ]}
            onChange={(e) => {
              const n = new URLSearchParams(sp);
              if (e.target.value) n.set('status', e.target.value);
              else n.delete('status');
              n.set('page', '1');
              setSp(n);
            }}
          />
        }
      />
      {q.isLoading ? (
        <LoadingState label="Loading offers" />
      ) : q.isError ? (
        <ErrorState
          detail={errorText(q.error)}
          retry={() => void q.refetch()}
        />
      ) : q.data?.items.length ? (
        <div className="ats-table-card">
          <div className="job-table-wrapper">
            <table className="job-modern-table" aria-label="Managed offers table">
              <thead>
                <tr>
                  <th>OFFER TITLE & CANDIDATE</th>
                  <th>COMPENSATION</th>
                  <th>REVISION</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((o) => (
                  <OfferRow key={o.id} offer={o} to={`/org/offers/${o.id}`} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No offers found"
          description={
            sp.get('status')
              ? 'No offers match this status.'
              : 'Create a draft when a candidate is ready for an offer.'
          }
        />
      )}
      {q.data && (
        <PageControls
          page={q.data.page}
          pages={q.data.pages}
          onPage={(page) => {
            const n = new URLSearchParams(sp);
            n.set('page', String(page));
            setSp(n);
          }}
        />
      )}
      <Alert tone="neutral" title="Server filtering limitation">
        <p>
          Search and employment type are not offered here because the current
          API does not apply those filters.
        </p>
      </Alert>
    </main>
  );
}
const baseForm = {
  title: '',
  department: '',
  employmentType: 'full-time',
  workMode: 'onsite',
  joiningDate: '',
  currency: 'INR',
  period: 'yearly',
  base: '0',
  validityDays: '7',
};
export function OfferFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { offerId } = useParams(),
    [sp] = useSearchParams(),
    nav = useNavigate(),
    initialAppId = sp.get('applicationId') || '',
    [selectedAppId, setSelectedAppId] = useState(initialAppId),
    applicationsQuery = useApplications('limit=50', mode === 'create'),
    offerQ = useManagedOffer(
      offerId ?? '',
      mode === 'edit' && validId(offerId),
    ),
    mutation = useOfferMutation(),
    [form, setForm] = useState(baseForm),
    [seeded, setSeeded] = useState(false),
    [error, setError] = useState('');

  const appItems = (applicationsQuery.data?.items ?? []) as any[];
  const appOptions = [
    { value: '', label: '-- Select Candidate Application --' },
    ...(selectedAppId && !appItems.some((x) => x.id === selectedAppId)
      ? [{ value: selectedAppId, label: `Selected Application (${selectedAppId})` }]
      : []),
    ...appItems.map((x) => ({
      value: x.id,
      label: `${x.candidateName || 'Candidate'} — ${x.jobTitle || 'Job'} [Stage: ${x.status ?? 'submitted'}]`,
    })),
  ];

  if (mode === 'edit' && offerQ.data && !seeded) {
    const o = offerQ.data;
    setForm({
      title: o.title,
      department: o.department ?? '',
      employmentType: o.employmentType ?? 'full-time',
      workMode: o.workMode ?? 'onsite',
      joiningDate: o.joiningDate?.slice(0, 10) ?? '',
      currency: o.compensation?.currency ?? 'INR',
      period: o.compensation?.period ?? 'yearly',
      base: String(o.compensation?.base ?? 0),
      validityDays: '7',
    });
    setSeeded(true);
  }
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const targetAppId = selectedAppId || (
      e.currentTarget.elements.namedItem(
        'applicationId',
      ) as HTMLInputElement | null
    )?.value || '';

    if (mode === 'create' && (!targetAppId || !validId(targetAppId))) {
      setError('Please select a valid candidate application before creating an offer.');
      return;
    }
    if (!form.title.trim()) {
      setError('Offer title is required.');
      return;
    }
    if (!form.joiningDate) {
      setError('Joining date is required.');
      return;
    }
    const joiningDateObj = new Date(form.joiningDate);
    if (isNaN(joiningDateObj.getTime())) {
      setError('Please enter a valid joining date.');
      return;
    }

    try {
      const createBody = {
        title: form.title.trim(),
        department: form.department?.trim() || undefined,
        employmentType: form.employmentType || 'full-time',
        workMode: form.workMode || 'onsite',
        joiningDate: joiningDateObj.toISOString(),
        compensation: {
          currency: (form.currency || 'INR').toUpperCase(),
          period: form.period || 'yearly',
          base: Number(form.base) || 0,
          variable: 0,
          bonus: 0,
          joiningBonus: 0,
          allowances: [],
          deductions: [],
          confidential: true,
        },
        benefits: [],
        terms: [],
        clauses: [],
        validityDays: Number(form.validityDays) || 7,
        applicationId: targetAppId,
      };
      const body =
        mode === 'create'
          ? createBody
          : {
              title: form.title.trim(),
              department: form.department?.trim() || undefined,
              employmentType: form.employmentType || 'full-time',
              workMode: form.workMode || 'onsite',
              joiningDate: joiningDateObj.toISOString(),
            };
      const result = await mutation.mutateAsync({
        path: mode === 'create' ? '/offers' : `/offers/manage/${offerId}`,
        method: mode === 'create' ? 'POST' : 'PATCH',
        body,
      });
      const id =
        (result as { offer?: { id?: string; _id?: string } }).offer?.id ??
        (result as { offer?: { _id?: string } }).offer?._id ??
        offerId;
      nav(`/org/offers/${id}`);
    } catch (x) {
      setError(errorText(x));
    }
  };
  if (mode === 'edit' && offerQ.isLoading)
    return <LoadingState label="Loading offer draft" />;
  if (
    mode === 'edit' &&
    offerQ.data &&
    !['draft', 'rejected'].includes(offerQ.data.status)
  )
    return (
      <PermissionState
        title="Offer is read-only"
        description="Only draft or rejected offers can be edited."
      />
    );
  return (
    <main>
      <PageHeader
        title={mode === 'create' ? 'Create offer' : 'Edit offer draft'}
        description="Terms are saved as a draft. No signature is collected."
      />
      <Form onSubmit={submit} busy={mutation.isPending}>
        <FormSection legend="Candidate and role">
          {mode === 'create' && (
            <>
              {appOptions.length > 1 && (
                <Select
                  label="Candidate Application"
                  value={selectedAppId}
                  options={appOptions}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                />
              )}
              <TextField
                name="applicationId"
                label="Application ID (raw MongoDB ID)"
                required
                pattern="[a-fA-F0-9]{24}"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                hint="Auto-populated when selecting a candidate above or clicking 'Create Offer' from application/interview pages."
              />
            </>
          )}
          <TextField
            label="Offer title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <div className="od-form-grid">
            <Select
              label="Employment type"
              value={form.employmentType}
              options={[
                'full-time',
                'part-time',
                'contract',
                'internship',
                'freelance',
              ].map((x) => ({ value: x, label: x }))}
              onChange={(e) =>
                setForm({ ...form, employmentType: e.target.value })
              }
            />
            <Select
              label="Work mode"
              value={form.workMode}
              options={['onsite', 'remote', 'hybrid'].map((x) => ({
                value: x,
                label: x,
              }))}
              onChange={(e) => setForm({ ...form, workMode: e.target.value })}
            />
            <DateField
              label="Joining date"
              required
              value={form.joiningDate}
              onChange={(e) =>
                setForm({ ...form, joiningDate: e.target.value })
              }
            />
          </div>
        </FormSection>
        {mode === 'create' && (
          <FormSection legend="Compensation and validity">
            <div className="od-form-grid">
              <TextField
                label="Currency"
                required
                maxLength={3}
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value.toUpperCase() })
                }
              />
              <Select
                label="Period"
                value={form.period}
                options={['yearly', 'monthly', 'hourly', 'one-time'].map(
                  (x) => ({
                    value: x,
                    label: x,
                  }),
                )}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
              <TextField
                label="Base compensation"
                type="number"
                min="0"
                required
                value={form.base}
                onChange={(e) => setForm({ ...form, base: e.target.value })}
              />
              <TextField
                label="Validity (days)"
                type="number"
                min="1"
                max="90"
                required
                value={form.validityDays}
                onChange={(e) =>
                  setForm({ ...form, validityDays: e.target.value })
                }
              />
            </div>
          </FormSection>
        )}
        {error && (
          <Alert tone="danger" title="Offer could not be saved">
            <p>{error}</p>
          </Alert>
        )}
        <FormActions>
          <Button type="submit" loading={mutation.isPending}>
            Save draft
          </Button>
        </FormActions>
      </Form>
    </main>
  );
}
function OfferAction({
  label,
  path,
  body,
  destructive = false,
}: {
  label: string;
  path: string;
  body?: unknown;
  destructive?: boolean;
}) {
  const m = useOfferMutation();
  return (
    <ConfirmDialog
      title={`${label} offer?`}
      description="This action changes the offer workflow and may notify other people."
      confirmLabel={label}
      variant={destructive ? 'destructive' : 'default'}
      onConfirm={() => m.mutateAsync({ path, body })}
      trigger={
        <Button
          variant={destructive ? 'danger' : 'secondary'}
          disabled={m.isPending}
        >
          {label}
        </Button>
      }
    />
  );
}
export function ManagedOfferDetailPage() {
  const { offerId = '' } = useParams(),
    { recruiter } = useAuth(),
    q = useManagedOffer(offerId, validId(offerId)),
    history = useOfferHistory(offerId, validId(offerId)),
    canViewDocs = Boolean(recruiter?.permissions.includes('documents.view')),
    canManageDocs = Boolean(
      recruiter?.permissions.includes('documents.manage') &&
      recruiter.permissions.includes('offers.manage'),
    ),
    docs = useOfferDocuments(offerId, true, canViewDocs);
  if (!validId(offerId))
    return <ErrorState detail="Invalid offer identifier." />;
  if (q.isLoading) return <LoadingState label="Loading offer" />;
  if (q.isError || !q.data)
    return (
      <ErrorState detail={errorText(q.error)} retry={() => void q.refetch()} />
    );
  const o = q.data,
    manage = Boolean(recruiter?.permissions.includes('offers.manage')),
    send = Boolean(recruiter?.permissions.includes('offers.send')),
    approve = Boolean(recruiter?.permissions.includes('offers.approve'));
  return (
    <main>
      <PageHeader
        title={o.title}
        eyebrow={`Offer ${o.offerNumber ?? ''}`}
        description={`${o.candidateName} · Revision ${o.revisionNumber ?? 1}`}
        metadata={
          <StatusTag tone={offerTone(o.status)}>
            {o.status.replaceAll('-', ' ')}
          </StatusTag>
        }
        secondaryActions={
          <>
            {approve && o.status === 'pending-approval' && (
              <RouterLink
                className="tvx-button tvx-button--primary tvx-button--regular"
                to={`/org/offers/approvals/${offerId}`}
              >
                Review & Approve
              </RouterLink>
            )}
            {manage && ['draft', 'rejected'].includes(o.status) && (
              <RouterLink
                className="tvx-button tvx-button--secondary tvx-button--regular"
                to={`/org/offers/${offerId}/edit`}
              >
                Edit
              </RouterLink>
            )}
            {manage && ['draft', 'rejected'].includes(o.status) && (
              <OfferAction
                label="Submit for approval"
                path={`/offers/manage/${offerId}/request-approval`}
              />
            )}{' '}
            {send && o.status === 'approved' && (
              <OfferAction
                label="Send"
                path={`/offers/manage/${offerId}/send`}
              />
            )}{' '}
            {manage &&
              [
                'approved',
                'sent',
                'viewed',
                'negotiation-requested',
                'revised',
              ].includes(o.status) && (
                <OfferAction
                  label="Withdraw"
                  path={`/offers/manage/${offerId}/withdraw`}
                  body={{ reason: 'Withdrawn by recruiter' }}
                  destructive
                />
              )}
            {manage && ['draft', 'rejected'].includes(o.status) && (
              <OfferAction
                label="Cancel"
                path={`/offers/manage/${offerId}/cancel`}
                body={{ reason: 'Cancelled by recruiter' }}
                destructive
              />
            )}
            {manage &&
              ![
                'draft',
                'pending-approval',
                'approved',
                'sent',
                'viewed',
                'negotiation-requested',
                'revised',
                'accepted',
              ].includes(o.status) && (
                <OfferAction
                  label="Archive"
                  path={`/offers/manage/${offerId}/archive`}
                  destructive
                />
              )}
            {manage && o.status === 'accepted' && (
              <OfferAction
                label="Confirm hire"
                path={`/offers/manage/${offerId}/confirm-hire`}
              />
            )}
            {manage && o.status === 'negotiation-requested' && (
              <>
                <RouterLink
                  className="tvx-button tvx-button--primary tvx-button--regular"
                  to={`/org/offers/${offerId}/revise`}
                >
                  📄 Create Revision & Increase Salary ↗
                </RouterLink>
                <OfferAction
                  label="Reaffirm terms"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'reaffirmed' }}
                />
                <OfferAction
                  label="Reject negotiation"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'rejected' }}
                />
                <OfferAction
                  label="Withdraw after negotiation"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'withdrawn' }}
                  destructive
                />
              </>
            )}
          </>
        }
      />
      {o.negotiation && (
        <Alert
          tone="warning"
          title="Candidate Negotiation Request"
          style={{ marginBottom: '16px' }}
        >
          {o.negotiation.message && (
            <p style={{ marginTop: '4px', fontWeight: 500 }}>
              💬 Candidate Note: &ldquo;{o.negotiation.message}&rdquo;
            </p>
          )}
          {o.negotiation.requestedChanges && Object.keys(o.negotiation.requestedChanges).length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.9rem' }}>
              <strong>Requested Changes:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {Object.entries(o.negotiation.requestedChanges).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</strong>: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Alert>
      )}
      <div className="od-split">
        <Card heading="Offer terms">
          <OfferTerms offer={o} />
        </Card>
        <Card
          heading="Revision history"
          description="Attachments remain on the exact revision where they were uploaded."
        >
          {history.data?.map((x) => (
            <RevisionHistoryItem key={x.id} offer={x} currentOfferId={o.id} />
          ))}
          {!history.data?.length && <p style={{ fontSize: '0.875rem', color: '#64748b' }}>This is the only revision.</p>}
          {manage &&
            [
              'rejected',
              'approved',
              'sent',
              'viewed',
              'negotiation-requested',
              'declined',
            ].includes(o.status) && (
              <RouterLink
                to={`/org/offers/${offerId}/revise`}
                className="btn-pill-dark"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justify: 'center',
                  gap: '6px',
                  width: '100%',
                  marginTop: '12px',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  padding: '10px 16px'
                }}
              >
                Create a revision
              </RouterLink>
            )}
        </Card>
      </div>
      {canViewDocs ? (
        <DocumentPanel
          offerId={offerId}
          recruiter
          documents={docs.data ?? []}
          loading={docs.isLoading}
          canManage={canManageDocs}
        />
      ) : (
        <PermissionState
          title="Attachments unavailable"
          description="The documents.view permission is required to list or download offer attachments."
        />
      )}
    </main>
  );
}
export function ApprovalQueuePage() {
  const q = useApprovals();
  return (
    <main>
      <PageHeader
        title="Offer approvals"
        description="Review offers awaiting an approval decision."
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.length ? (
        <Card>
          {q.data
            .filter((o) => o.status === 'pending-approval')
            .map((o) => (
              <OfferRow
                key={o.id}
                offer={o}
                to={`/org/offers/approvals/${o.id}`}
              />
            ))}
        </Card>
      ) : (
        <EmptyState
          title="Approval queue is clear"
          description="There are no offers awaiting your decision."
        />
      )}
      <Alert tone="neutral" title="Queue limitation">
        <p>The current approval API does not support pagination.</p>
      </Alert>
    </main>
  );
}
export function ApprovalDetailPage() {
  const { offerId = '' } = useParams(),
    navigate = useNavigate(),
    q = useApproval(offerId),
    m = useOfferMutation(),
    [reason, setReason] = useState('');
  if (q.isLoading) return <LoadingState />;
  if (!q.data) return <ErrorState detail={errorText(q.error)} />;
  if (q.data.status !== 'pending-approval')
    return (
      <PermissionState
        title="Approval unavailable"
        description="Only offers currently pending approval can be decided."
      />
    );
  return (
    <main>
      <PageHeader
        title="Offer approval"
        description={`${q.data.candidateName} · ${q.data.title}`}
      />
      <Card>
        <OfferTerms offer={q.data} />
        <Alert tone="info" title="Private review">
          <p>
            Approval comments stay inside the recruiter approval workflow and
            are never shown in candidate views.
          </p>
        </Alert>
        <TextArea
          label="Rejection reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormActions>
          <ConfirmDialog
            title="Approve offer?"
            description="The offer becomes eligible to send."
            confirmLabel="Approve"
            onConfirm={async () => {
              await m.mutateAsync({
                path: `/offers/approvals/${offerId}/approve`,
                body: {},
              });
              navigate(`/org/offers/${offerId}`);
            }}
            trigger={<Button>Approve</Button>}
          />
          <ConfirmDialog
            title="Reject offer?"
            description="The draft returns for changes."
            confirmLabel="Reject"
            variant="destructive"
            onConfirm={async () => {
              await m.mutateAsync({
                path: `/offers/approvals/${offerId}/reject`,
                body: { reason },
              });
              navigate(`/org/offers/${offerId}`);
            }}
            trigger={
              <Button variant="danger" disabled={reason.trim().length < 1}>
                Reject
              </Button>
            }
          />
        </FormActions>
      </Card>
    </main>
  );
}
export function TemplatesPage() {
  const q = useTemplates();
  return (
    <main>
      <PageHeader
        title="Offer templates"
        description="Reusable starting points for offer drafts."
        primaryAction={
          <RouterLink
            className="tvx-button tvx-button--primary tvx-button--regular"
            to="/org/offers/templates/new"
          >
            Create template
          </RouterLink>
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.length ? (
        <Card>
          <div className="od-list">
            {q.data.map((t) => (
              <article className="od-record" key={t.id}>
                <div>
                  <strong>
                    <RouterLink to={`/org/offers/templates/${t.id}`}>
                      {t.name}
                    </RouterLink>
                  </strong>
                  <span>{t.description ?? 'No description'}</span>
                </div>
                <StatusTag>{t.isReusable ? 'Reusable' : 'Inactive'}</StatusTag>
              </article>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          title="No offer templates"
          description="Create a template to standardize draft terms."
        />
      )}
      <Alert tone="neutral" title="Template list limit">
        <p>The backend returns at most 50 templates in this view.</p>
      </Alert>
    </main>
  );
}
export function TemplateFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { templateId = '' } = useParams(),
    q = useTemplate(templateId),
    m = useOfferMutation(),
    nav = useNavigate(),
    [name, setName] = useState(''),
    [description, setDescription] = useState(''),
    [seeded, setSeeded] = useState(false),
    [error, setError] = useState('');
  if (mode === 'edit' && q.data && !seeded) {
    setName(q.data.name);
    setDescription(q.data.description ?? '');
    setSeeded(true);
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body =
        mode === 'edit'
          ? { name, description: description || undefined }
          : {
              name,
              description: description || undefined,
              defaultBenefits: [],
              defaultTerms: [],
              defaultClauses: [],
              defaultValidityDays: 7,
              approvalRequired: true,
              requiredApproverRoles: [],
              allowCreatorApproval: false,
              isReusable: true,
            };
      await m.mutateAsync({
        path:
          mode === 'create'
            ? '/offers/templates'
            : `/offers/templates/${templateId}`,
        method: mode === 'create' ? 'POST' : 'PATCH',
        body,
      });
      nav('/org/offers/templates');
    } catch (x) {
      setError(errorText(x));
    }
  };
  return (
    <main>
      <PageHeader
        title={
          mode === 'create' ? 'Create offer template' : 'Edit offer template'
        }
        description="Set the reusable identity and approval defaults."
      />
      <Form onSubmit={submit} busy={m.isPending}>
        <FormSection legend="Template details">
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </FormSection>
        {error && (
          <Alert tone="danger" title="Template could not be saved">
            <p>{error}</p>
          </Alert>
        )}
        <FormActions>
          <Button type="submit" loading={m.isPending}>
            Save template
          </Button>
        </FormActions>
      </Form>
    </main>
  );
}
export function OfferRevisionPage() {
  const { offerId = '' } = useParams(),
    q = useManagedOffer(offerId, validId(offerId)),
    m = useOfferMutation(),
    nav = useNavigate(),
    [reason, setReason] = useState(''),
    [form, setForm] = useState({
      title: '',
      department: '',
      employmentType: 'full-time',
      workMode: 'onsite',
      joiningDate: '',
      currency: 'INR',
      period: 'yearly',
      base: '',
    }),
    [seeded, setSeeded] = useState(false),
    [error, setError] = useState('');
  if (q.isLoading) return <LoadingState />;
  if (
    !q.data ||
    ![
      'rejected',
      'approved',
      'sent',
      'viewed',
      'negotiation-requested',
      'declined',
    ].includes(q.data.status)
  )
    return (
      <PermissionState
        title="Revision unavailable"
        description="Only an eligible current offer can be revised."
      />
    );
  if (q.data && !seeded) {
    const o = q.data;
    setForm({
      title: o.title ?? '',
      department: o.department ?? '',
      employmentType: o.employmentType ?? 'full-time',
      workMode: o.workMode ?? 'onsite',
      joiningDate: o.joiningDate ? o.joiningDate.slice(0, 10) : '',
      currency: o.compensation?.currency ?? 'INR',
      period: o.compensation?.period ?? 'yearly',
      base: String(o.compensation?.base ?? 0),
    });
    setSeeded(true);
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!reason.trim()) {
      setError('Revision reason is required.');
      return;
    }
    try {
      const joiningDateObj = form.joiningDate ? new Date(form.joiningDate) : undefined;
      const body: Record<string, any> = {
        reason: reason.trim(),
        ...(form.title.trim() ? { title: form.title.trim() } : {}),
        ...(form.department.trim() ? { department: form.department.trim() } : {}),
        ...(form.employmentType ? { employmentType: form.employmentType } : {}),
        ...(form.workMode ? { workMode: form.workMode } : {}),
        ...(joiningDateObj && !isNaN(joiningDateObj.getTime())
          ? { joiningDate: joiningDateObj.toISOString() }
          : {}),
        compensation: {
          currency: (form.currency || 'INR').toUpperCase(),
          period: form.period || 'yearly',
          base: Number(form.base) || 0,
          variable: 0,
          joiningBonus: 0,
          allowances: [],
        },
      };
      const v = (await m.mutateAsync({
        path: `/offers/manage/${offerId}/revise`,
        method: 'POST',
        body,
      })) as { offer?: { id?: string; _id?: string } };
      nav(`/org/offers/${v.offer?.id ?? v.offer?._id ?? offerId}`);
    } catch (x) {
      setError(errorText(x));
    }
  };
  return (
    <main>
      <PageHeader
        title="Create offer revision"
        description="The existing revision becomes superseded. Update salary, compensation, or role terms below."
      />
      <Form onSubmit={submit} busy={m.isPending}>
        <FormSection legend="Revision justification">
          <TextArea
            label="Revision reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="Describe why this offer is being revised (e.g., salary increase following candidate negotiation)."
          />
        </FormSection>

        <FormSection legend="Compensation & Salary Improvement">
          <div className="od-form-grid">
            <TextField
              label="Base compensation / Salary"
              type="number"
              min="0"
              required
              value={form.base}
              onChange={(e) => setForm({ ...form, base: e.target.value })}
              hint="Increase base salary per candidate negotiation."
            />
            <TextField
              label="Currency"
              required
              maxLength={3}
              value={form.currency}
              onChange={(e) =>
                setForm({ ...form, currency: e.target.value.toUpperCase() })
              }
            />
            <Select
              label="Pay period"
              value={form.period}
              options={['yearly', 'monthly', 'hourly', 'one-time'].map(
                (x) => ({
                  value: x,
                  label: x,
                }),
              )}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>
        </FormSection>

        <FormSection legend="Role & Working Terms">
          <TextField
            label="Offer title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <TextField
            label="Department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          />
          <div className="od-form-grid">
            <Select
              label="Employment type"
              value={form.employmentType}
              options={[
                'full-time',
                'part-time',
                'contract',
                'internship',
                'freelance',
              ].map((x) => ({ value: x, label: x }))}
              onChange={(e) =>
                setForm({ ...form, employmentType: e.target.value })
              }
            />
            <Select
              label="Work mode"
              value={form.workMode}
              options={['onsite', 'remote', 'hybrid'].map((x) => ({
                value: x,
                label: x,
              }))}
              onChange={(e) => setForm({ ...form, workMode: e.target.value })}
            />
            <DateField
              label="Joining date"
              value={form.joiningDate}
              onChange={(e) =>
                setForm({ ...form, joiningDate: e.target.value })
              }
            />
          </div>
        </FormSection>

        {error && (
          <Alert tone="danger">
            <p>{error}</p>
          </Alert>
        )}
        <FormActions>
          <ConfirmDialog
            title="Create revision?"
            description="The current offer revision will be superseded and updated terms will be submitted."
            confirmLabel="Create revision"
            onConfirm={() => {
              const form = document.querySelector('form');
              form?.requestSubmit();
            }}
            trigger={
              <Button disabled={reason.trim().length < 1}>
                Create revision & update salary
              </Button>
            }
          />
        </FormActions>
      </Form>
    </main>
  );
}
export function TemplateDetailPage() {
  const { templateId = '' } = useParams(),
    q = useTemplate(templateId),
    m = useOfferMutation();
  if (q.isLoading) return <LoadingState />;
  if (!q.data) return <ErrorState detail={errorText(q.error)} />;
  return (
    <main>
      <PageHeader
        title={q.data.name}
        description={q.data.description ?? 'Offer template'}
        secondaryActions={
          <>
            <RouterLink
              className="tvx-button tvx-button--secondary tvx-button--regular"
              to={`/org/offers/templates/${templateId}/edit`}
            >
              Edit
            </RouterLink>
            <ConfirmDialog
              title="Clone template?"
              description="A new independent template will be created."
              confirmLabel="Clone"
              onConfirm={() =>
                m.mutateAsync({
                  path: `/offers/templates/${templateId}/clone`,
                  method: 'POST',
                })
              }
              trigger={
                <Button variant="secondary" disabled={m.isPending}>
                  Clone
                </Button>
              }
            />
            <ConfirmDialog
              title="Deactivate template?"
              description="The template will no longer be available for new offers. Used templates remain part of offer history."
              confirmLabel="Deactivate"
              variant="destructive"
              onConfirm={() =>
                m.mutateAsync({
                  path: `/offers/templates/${templateId}`,
                  method: 'DELETE',
                })
              }
              trigger={<Button variant="danger">Deactivate</Button>}
            />
          </>
        }
      />
      <Card>
        <dl className="od-dl">
          <div>
            <dt>Default title</dt>
            <dd>{q.data.defaultTitle ?? 'Not set'}</dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>{q.data.approvalRequired ? 'Required' : 'Not required'}</dd>
          </div>
          <div>
            <dt>Usage</dt>
            <dd>{q.data.usageCount ?? 0} offers</dd>
          </div>
        </dl>
        <p>
          Templates that have been used are immutable on the server. Clone one
          to make a new version.
        </p>
      </Card>
    </main>
  );
}
export function CandidateOffersPage() {
  const q = useCandidateOffers();
  return (
    <div className="candidate-page candidate-domain-container">
      <div className="candidate-hero-banner-mindease">
        <div className="banner-left-content">
          <div className="banner-icon-badge theme-yellow">
            <Award size={22} />
          </div>
          <div className="banner-text-details">
            <h1 className="banner-title">My Offers</h1>
            <p className="banner-subtext">Review offer terms and respond before they expire.</p>
          </div>
        </div>
      </div>
      {q.isLoading ? (
        <LoadingState label="Loading offers" />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.length ? (
        <Card>
          {q.data.map((o) => (
            <OfferRow key={o.id} offer={o} to={`/candidate/offers/${o.id}`} />
          ))}
        </Card>
      ) : (
        <EmptyState
          title="No offers yet"
          description="Offers sent to you will appear here."
        />
      )}
    </div>
  );
}
export function CandidateOfferDetailPage() {
  const { offerId = '' } = useParams(),
    q = useCandidateOffer(offerId),
    timeline = useCandidateTimeline(offerId),
    docs = useOfferDocuments(offerId, false),
    m = useOfferMutation(),
    viewMutation = useOfferMutation(),
    viewedRef = useRef(false),
    [message, setMessage] = useState(''),
    [decline, setDecline] = useState(''),
    [declineCategory, setDeclineCategory] = useState('compensation'),
    [acceptComments, setAcceptComments] = useState(''),
    [responseAction, setResponseAction] = useState<'accept' | 'decline' | 'negotiate'>('accept');
  useEffect(() => {
    if (q.data?.status === 'sent' && !viewedRef.current) {
      viewedRef.current = true;
      viewMutation.mutate({ path: `/offers/me/${offerId}/view` });
    }
  }, [offerId, q.data?.status, viewMutation]);
  if (!validId(offerId))
    return <ErrorState detail="Invalid offer identifier." />;
  if (q.isLoading) return <LoadingState />;
  if (!q.data) return <ErrorState detail={errorText(q.error)} />;
  const o = q.data,
    active = activeCandidateActions(o.status);
  return (
    <main>
      <PageHeader
        title={o.title}
        description={`Revision ${o.revisionNumber ?? 1}`}
        metadata={
          <StatusTag tone={offerTone(o.status)}>
            {o.status.replaceAll('-', ' ')}
          </StatusTag>
        }
      />
      {['expired', 'withdrawn', 'superseded'].includes(o.status) && (
        <Alert tone="warning" title={`This offer is ${o.status}`}>
          <p>This revision can no longer be accepted or declined.</p>
        </Alert>
      )}
      {m.isError && (
        <Alert tone="danger" title="Action failed" style={{ marginBottom: '16px' }}>
          <p>{errorText(m.error)}</p>
        </Alert>
      )}
      {m.isSuccess && (
        <Alert tone="success" title="Response recorded" style={{ marginBottom: '16px' }}>
          <p>Your offer response has been successfully saved and communicated to the employer.</p>
        </Alert>
      )}
      <div className="od-split">
        <Card heading="Offer terms">
          <OfferTerms offer={o} />
          <p className="od-note">
            Accepting confirms your response in Talvix. This is not an
            electronic signature.
          </p>
          {active && (
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', fontWeight: 600 }}>Respond to Job Offer</h3>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <Button
                  variant={responseAction === 'accept' ? 'primary' : 'quiet'}
                  onClick={() => setResponseAction('accept')}
                >
                  Accept Offer
                </Button>
                <Button
                  variant={responseAction === 'decline' ? 'danger' : 'quiet'}
                  onClick={() => setResponseAction('decline')}
                >
                  Decline Offer
                </Button>
                <Button
                  variant={responseAction === 'negotiate' ? 'secondary' : 'quiet'}
                  onClick={() => setResponseAction('negotiate')}
                >
                  Request Changes / Negotiate
                </Button>
              </div>

              {responseAction === 'accept' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ margin: '0 0 12px 0', color: '#166534', fontWeight: 500 }}>
                    Confirm your acceptance of this offer.
                  </p>
                  <TextArea
                    label="Optional acceptance note / comments"
                    hint="Share any message or preferred start date notes with the recruiter."
                    value={acceptComments}
                    onChange={(e) => setAcceptComments(e.target.value)}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <ConfirmDialog
                      title="Accept this offer?"
                      description="Your acceptance is final for this revision. This is not an electronic signature."
                      confirmLabel="Confirm & Accept Offer"
                      onConfirm={() =>
                        m.mutateAsync({
                          path: `/offers/me/${offerId}/accept`,
                          body: { comments: acceptComments },
                        })
                      }
                      trigger={<Button disabled={m.isPending}>Confirm Acceptance</Button>}
                    />
                  </div>
                </div>
              )}

              {responseAction === 'decline' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ margin: '0 0 12px 0', color: '#991b1b', fontWeight: 500 }}>
                    Please select a reason for declining this offer.
                  </p>
                  <Select
                    label="Primary reason for declining"
                    value={declineCategory}
                    options={[
                      { value: 'compensation', label: 'Compensation & Benefits' },
                      { value: 'joining-date', label: 'Start Date Conflict' },
                      { value: 'role', label: 'Role & Responsibilities' },
                      { value: 'location', label: 'Location / Relocation' },
                      { value: 'work-mode', label: 'Work Mode (Remote / Onsite)' },
                      { value: 'accepted-other-offer', label: 'Accepted Another Offer' },
                      { value: 'personal', label: 'Personal Circumstances' },
                      { value: 'other', label: 'Other Reason' },
                    ]}
                    onChange={(e) => setDeclineCategory(e.target.value)}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <TextArea
                      label="Additional details / explanation"
                      hint={declineCategory === 'other' ? 'Please provide a brief reason.' : 'Optional explanation for the recruiter.'}
                      value={decline}
                      onChange={(e) => setDecline(e.target.value)}
                    />
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <ConfirmDialog
                      title="Decline this offer?"
                      description="Your response will mark the offer as declined and notify the recruiter."
                      confirmLabel="Confirm Decline"
                      variant="destructive"
                      onConfirm={() =>
                        m.mutateAsync({
                          path: `/offers/me/${offerId}/decline`,
                          body: { category: declineCategory, reason: decline },
                        })
                      }
                      trigger={
                        <Button
                          variant="danger"
                          disabled={m.isPending || (declineCategory === 'other' && !decline.trim())}
                        >
                          Confirm Decline
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}

              {responseAction === 'negotiate' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
                  <p style={{ margin: '0 0 12px 0', color: '#1e40af', fontWeight: 500 }}>
                    Submit a request for terms negotiation to the recruiter.
                  </p>
                  <TextArea
                    label="Negotiation request & desired changes"
                    hint="Describe the specific compensation, start date, or terms you would like reconsidered."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div style={{ marginTop: '12px' }}>
                    <ConfirmDialog
                      title="Submit negotiation request?"
                      description="This sends your proposed changes to the recruiter and pauses decision timeout."
                      confirmLabel="Send Request"
                      onConfirm={() =>
                        m.mutateAsync({
                          path: `/offers/me/${offerId}/negotiate`,
                          body: { message, requestedChanges: { comments: message } },
                        })
                      }
                      trigger={
                        <Button
                          variant="secondary"
                          disabled={m.isPending || !message.trim()}
                        >
                          Send Negotiation Request
                        </Button>
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card heading="Offer timeline">
          <ol className="od-timeline">
            {timeline.data?.map((x, i) => (
              <li key={`${x.changedAt}-${i}`}>
                <StatusTag tone={offerTone(x.status)}>
                  {x.status.replaceAll('-', ' ')}
                </StatusTag>
                <time>{date(x.changedAt)}</time>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <DocumentPanel
        offerId={offerId}
        recruiter={false}
        documents={docs.data ?? []}
        loading={docs.isLoading}
      />
    </main>
  );
}
function DocumentRow({
  doc,
  onDownload,
  onView,
  actions,
  detailTo,
}: {
  doc: DocumentRecord;
  onDownload: () => void;
  onView?: () => void;
  actions?: React.ReactNode;
  detailTo?: string;
}) {
  const [downloadError, setDownloadError] = useState(''),
    [downloading, setDownloading] = useState(false);
  const downloadable = doc.status === 'active' && doc.scanStatus === 'clean';
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await onDownload();
    } catch (e) {
      setDownloadError(errorText(e));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <article className="od-record">
      <div>
        <strong>
          {detailTo ? (
            <RouterLink to={detailTo}>{doc.displayName}</RouterLink>
          ) : (
            doc.displayName
          )}
        </strong>
        <span>
          {doc.category.replaceAll('-', ' ')} · {formatBytes(doc.sizeBytes)}
        </span>
        <span>
          {doc.verification.reason && `Reason: ${doc.verification.reason}`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <StatusTag
          tone={
            doc.verification.status === 'verified'
              ? 'success'
              : doc.verification.status === 'rejected'
                ? 'danger'
                : 'warning'
          }
        >
          {doc.verification.status.replaceAll('-', ' ')}
        </StatusTag>
        {onView && (
          <Button
            variant="secondary"
            disabled={!downloadable}
            onClick={onView}
            leadingIcon={<Eye size={14} />}
          >
            View
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={!downloadable}
          loading={downloading}
          onClick={() => void download()}
          leadingIcon={<Download size={14} />}
        >
          {!downloadable
            ? 'Download unavailable'
            : downloadError
              ? 'Retry download'
              : 'Download'}
        </Button>
        {actions}
      </div>
      {downloadError && (
        <Alert tone="danger" title="Download failed">
          <p>{downloadError}</p>
        </Alert>
      )}
    </article>
  );
}
export function UploadControl({
  entityType,
  entityId,
  replaceId,
  path,
  onDone,
  category = 'other',
  access,
}: {
  entityType: string;
  entityId?: string | undefined;
  replaceId?: string | undefined;
  path: string;
  onDone: () => void;
  category?: string;
  access?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [state, setState] = useState<'idle' | 'preparing' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [selectedAccess, setSelectedAccess] = useState(access ?? 'company-private');

  const computedAccept =
    category === 'resume'
      ? '.pdf,.doc,.docx'
      : ['profile-photo', 'company-logo'].includes(category)
        ? '.jpg,.jpeg,.png,.webp'
        : '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp';

  const busy = state === 'preparing' || state === 'uploading';

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (state === 'error' || state === 'success') {
      setState('idle');
      setError('');
    }
  };

  const run = async () => {
    if (!selectedFile) {
      setError('Please select a file first.');
      setState('error');
      return;
    }
    if (selectedFile.size === 0) {
      setError('The selected file is empty.');
      setState('error');
      return;
    }
    setState('preparing');
    setError('');
    try {
      const session = await createUploadSession({
        category,
        entityType,
        entityId,
        purpose: 'Supporting document',
      });
      if (selectedFile.size > session.maximumBytes)
        throw new Error(`File too large. Max ${formatBytes(session.maximumBytes)}.`);

      setState('uploading');
      const isProfileUpload = path.includes('/me/');
      const integratedOffer = path.includes('/manage/offers/');
      await xhrUpload(
        path,
        {
          uploadSessionId: session.id,
          purpose: 'Supporting document',
          displayName: selectedFile.name,
          ...(integratedOffer ? { access: selectedAccess } : {}),
          ...(!integratedOffer && !isProfileUpload ? { category } : {}),
        },
        selectedFile,
        setProgress,
      );
      setState('success');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onDone();
    } catch (x) {
      setError(errorText(x));
      setState('error');
    }
  };

  return (
    <div className="od-upload">
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
          Select attachment (PDF, Word, TXT, JPG, PNG, WebP)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept={computedAccept}
          disabled={busy}
          onChange={handleFileChange}
          style={{ display: 'block', marginBottom: '6px' }}
        />
        {selectedFile && (
          <p style={{ color: '#059669', fontSize: '13px', margin: '2px 0 0 0', fontWeight: 500 }}>
            ✓ {selectedFile.name} ({formatBytes(selectedFile.size)})
          </p>
        )}
      </div>

      {path.includes('/manage/offers/') && !replaceId && (
        <Select
          label="Candidate access"
          value={selectedAccess}
          options={[
            { value: 'company-private', label: 'Company private' },
            { value: 'candidate-visible', label: 'Candidate visible' },
          ]}
          onChange={(e) => setSelectedAccess(e.target.value)}
        />
      )}

      {state === 'uploading' && <Progress value={progress} label="Upload progress" />}
      {state === 'preparing' && <p role="status">Preparing upload…</p>}
      {state === 'success' && (
        <Alert tone="success" title="Upload complete">
          <p>Document uploaded and is being processed.</p>
        </Alert>
      )}
      {state === 'error' && (
        <Alert tone="danger" title="Upload failed">
          <p>{error}</p>
        </Alert>
      )}

      <Button onClick={() => void run()} loading={busy} disabled={busy || !selectedFile}>
        {replaceId ? 'Replace' : 'Upload'}
      </Button>
    </div>
  );
}
function DocumentPanel({
  offerId,
  recruiter,
  documents,
  loading,
  canManage = false,
}: {
  offerId: string;
  recruiter: boolean;
  documents: DocumentRecord[];
  loading: boolean;
  canManage?: boolean;
}) {
  return (
    <Card
      heading="Offer attachments"
      description={
        recruiter
          ? 'Attachments are bound to this exact revision. Candidate-visible access is selected at upload time and cannot be changed later.'
          : 'Only attachments marked candidate-visible are shown.'
      }
    >
      {loading ? (
        <LoadingState />
      ) : documents.length ? (
        documents.map((d) => (
          <DocumentRow
            key={d.id}
            doc={d}
            detailTo={`/candidate/documents/${d.id}`}
            onDownload={() =>
              void safeDownload(
                `/documents/${recruiter ? 'manage/' : ''}offers/${offerId}/${d.id}/download`,
              )
            }
            actions={
              recruiter && canManage ? (
                <UploadControl
                  entityType="offer"
                  entityId={offerId}
                  category="offer-document"
                  access={d.access}
                  replaceId={d.id}
                  path={`/documents/manage/offers/${offerId}/${d.id}/replace`}
                  onDone={() => location.reload()}
                />
              ) : undefined
            }
          />
        ))
      ) : (
        <p>No attachments are available.</p>
      )}
      {recruiter && canManage && (
        <UploadControl
          entityType="offer"
          entityId={offerId}
          category="offer-document"
          path={`/documents/manage/offers/${offerId}`}
          onDone={() => location.reload()}
        />
      )}
      <p className="od-note">
        Attachment deletion and visibility changes are not supported by the
        current API.
      </p>
    </Card>
  );
}
export function CandidateDocumentsPage() {
  const [sp, setSp] = useSearchParams(),
    q = useDocuments(
      `page=${sp.get('page') ?? '1'}&limit=20${sp.get('status') ? `&status=${sp.get('status')}` : ''}`,
    ),
    m = useDocumentMutation();
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    url?: string;
    mimeType?: string;
    downloadPath?: string;
    category?: string;
  } | null>(null);
  return (
    <div className="candidate-page candidate-documents-compact candidate-domain-container">
      <div className="candidate-hero-banner-mindease">
        <div className="banner-left-content">
          <div className="banner-icon-badge theme-green">
            <FileText size={22} />
          </div>
          <div className="banner-text-details">
            <h1 className="banner-title">My Documents</h1>
            <p className="banner-subtext">Manage files you own and see verification results.</p>
          </div>
        </div>
      </div>
      <Toolbar
        label="Document filters"
        start={
          <Select
            aria-label="Document status"
            value={sp.get('status') ?? ''}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'replaced', label: 'Replaced' },
            ]}
            onChange={(e) => {
              const n = new URLSearchParams(sp);
              if (e.target.value) n.set('status', e.target.value);
              else n.delete('status');
              n.set('page', '1');
              setSp(n);
            }}
          />
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.items.length ? (
        <Card>
          {q.data.items.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              onDownload={() =>
                void safeDownload(`/documents/${d.id}/download`)
              }
              onView={async () => {
                try {
                  const url = await getDocumentUrl(
                    `/documents/${d.id}/download?inline=true`,
                  );
                  setPreviewDoc({
                    title: d.displayName,
                    url,
                    mimeType: d.mimeType,
                    downloadPath: `/documents/${d.id}/download`,
                    category: d.category,
                  });
                } catch {
                  void safeDownload(`/documents/${d.id}/download`);
                }
              }}
              actions={
                <>
                  {['active', 'archived'].includes(d.status) &&
                    d.entityType === 'user' && (
                      <ConfirmDialog
                        title="Delete document?"
                        description="This removes the document from your active files."
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() =>
                          m.mutateAsync({
                            path: `/documents/${d.id}`,
                            method: 'DELETE',
                            body: { reason: 'Deleted by owner' },
                          })
                        }
                        trigger={<Button variant="danger">Delete</Button>}
                      />
                    )}{' '}
                  {d.status === 'active' && d.entityType === 'user' && (
                    <UploadControl
                      entityType={d.entityType ?? 'user'}
                      entityId={d.entityId}
                      category={d.category}
                      replaceId={d.id}
                      path={`/documents/${d.id}/replace`}
                      onDone={() => void q.refetch()}
                    />
                  )}
                </>
              }
            />
          ))}
        </Card>
      ) : sp.get('status') ? (
        <FilteredEmptyState
          title="No matching documents"
          description="No documents match the selected status."
          onClear={() => setSp(new URLSearchParams())}
        />
      ) : (
        <EmptyState
          title="No documents"
          description="Upload a personal document to keep it in your secure workspace."
        />
      )}
      {q.data && (
        <PageControls
          page={q.data.page}
          pages={q.data.pages}
          onPage={(page) => {
            const n = new URLSearchParams(sp);
            n.set('page', String(page));
            setSp(n);
          }}
        />
      )}
      <Card heading="Upload a personal document">
        <UploadControl
          entityType="user"
          path="/documents/upload"
          onDone={() => void q.refetch()}
        />
      </Card>
      <Alert tone="info" title="Workflow documents">
        <p>
          Application and offer documents follow their workflow rules. Some
          cannot be deleted from this manager.
        </p>
      </Alert>
      <DocumentPreviewDialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        title={previewDoc?.title || ''}
        url={previewDoc?.url}
        mimeType={previewDoc?.mimeType}
        downloadPath={previewDoc?.downloadPath}
        category={previewDoc?.category}
      />
    </div>
  );
}
export function CandidateDocumentDetailPage() {
  const { documentId = '' } = useParams(),
    q = useDocument(documentId),
    m = useDocumentMutation(),
    [name, setName] = useState(''),
    [reason, setReason] = useState('Status changed by owner');
  if (q.isLoading) return <LoadingState />;
  if (!q.data) return <ErrorState detail={errorText(q.error)} />;
  const d = q.data;
  return (
    <main>
      <PageHeader
        title={d.displayName}
        description={`${d.category} · ${formatBytes(d.sizeBytes)}`}
        metadata={<StatusTag>{d.status}</StatusTag>}
      />
      <Card>
        <dl className="od-dl">
          <div>
            <dt>Verification</dt>
            <dd>{d.verification.status}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>
              {d.version}
              {d.isCurrent ? ' · Current' : ''}
            </dd>
          </div>
        </dl>
        <TextField
          label="Display name"
          value={name}
          placeholder={d.displayName}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={!name.trim()}
          onClick={() =>
            m.mutate({
              path: `/documents/${d.id}`,
              body: { displayName: name },
            })
          }
        >
          Update name
        </Button>
        <TextArea
          label="Reason for status change"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormActions align="start">
          {d.status === 'active' && (
            <ConfirmDialog
              title="Archive document?"
              description="The document moves out of your active list but remains retained."
              confirmLabel="Archive"
              onConfirm={() =>
                m.mutateAsync({
                  path: `/documents/${d.id}/archive`,
                  body: { reason },
                })
              }
              trigger={<Button variant="secondary">Archive</Button>}
            />
          )}{' '}
          {d.status === 'archived' && (
            <ConfirmDialog
              title="Restore document?"
              description="The document returns to your active list."
              confirmLabel="Restore"
              onConfirm={() =>
                m.mutateAsync({
                  path: `/documents/${d.id}/restore`,
                  body: { reason },
                })
              }
              trigger={<Button>Restore</Button>}
            />
          )}
          {['active', 'archived'].includes(d.status) &&
            d.entityType === 'user' && (
              <ConfirmDialog
                title="Delete document?"
                description="This removes the personal document according to retention policy."
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={() =>
                  m.mutateAsync({
                    path: `/documents/${d.id}`,
                    method: 'DELETE',
                    body: { reason },
                  })
                }
                trigger={<Button variant="danger">Delete</Button>}
              />
            )}
        </FormActions>
      </Card>
    </main>
  );
}
export function CandidateApplicationDocumentsPage() {
  const { applicationId = '' } = useParams(),
    q = useApplicationDocuments(applicationId);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    url?: string;
    mimeType?: string;
    downloadPath?: string;
    category?: string;
  } | null>(null);
  return (
    <main>
      <PageHeader
        title="Application documents"
        description="Files attached to this application follow its workflow permissions."
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.length ? (
        <Card>
          {q.data.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              onDownload={() => safeDownload(`/documents/${d.id}/download`)}
              onView={async () => {
                try {
                  const url = await getDocumentUrl(
                    `/documents/${d.id}/download?inline=true`,
                  );
                  setPreviewDoc({
                    title: d.displayName,
                    url,
                    mimeType: d.mimeType,
                    downloadPath: `/documents/${d.id}/download`,
                    category: d.category,
                  });
                } catch {
                  void safeDownload(`/documents/${d.id}/download`);
                }
              }}
              actions={
                <UploadControl
                  entityType="application"
                  entityId={applicationId}
                  category={d.category}
                  replaceId={d.id}
                  path={`/documents/applications/${applicationId}/${d.id}/replace`}
                  onDone={() => void q.refetch()}
                />
              }
            />
          ))}
        </Card>
      ) : (
        <EmptyState
          title="No application documents"
          description="No files are attached to this application."
        />
      )}
      <Card heading="Add application document">
        <UploadControl
          entityType="application"
          entityId={applicationId}
          category="application-document"
          path={`/documents/applications/${applicationId}`}
          onDone={() => void q.refetch()}
        />
      </Card>
      <Alert tone="neutral" title="Workflow retention">
        <p>
          Application documents cannot be deleted here. Replacement remains
          available only while the application is writable.
        </p>
      </Alert>
      <DocumentPreviewDialog
        open={Boolean(previewDoc)}
        onOpenChange={(open) => {
          if (!open) setPreviewDoc(null);
        }}
        title={previewDoc?.title || ''}
        url={previewDoc?.url}
        mimeType={previewDoc?.mimeType}
        downloadPath={previewDoc?.downloadPath}
        category={previewDoc?.category}
      />
    </main>
  );
}
export function RecruiterDocumentsPage() {
  const { recruiter } = useAuth(),
    can = Boolean(recruiter?.permissions.includes('documents.verify')),
    [sp, setSp] = useSearchParams(),
    q = useVerificationQueue(
      `page=${sp.get('page') ?? '1'}&limit=20${sp.get('status') ? `&status=${sp.get('status')}` : ''}`,
      can,
    );
  if (!can)
    return (
      <PermissionState description="The documents.verify permission is required." />
    );
  return (
    <main>
      <PageHeader
        title="Document verification"
        description="Review candidate application documents. This is not a company-wide document repository."
      />
      <Toolbar
        label="Verification filters"
        start={
          <Select
            aria-label="Verification status"
            value={sp.get('status') ?? ''}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'verified', label: 'Verified' },
              { value: 'rejected', label: 'Rejected' },
            ]}
            onChange={(e) => {
              const n = new URLSearchParams(sp);
              if (e.target.value) n.set('status', e.target.value);
              else n.delete('status');
              setSp(n);
            }}
          />
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState detail={errorText(q.error)} />
      ) : q.data?.items.length ? (
        <Card>
          {q.data.items.map((d) => (
            <DocumentRow
              key={d.id}
              doc={d}
              onDownload={() =>
                void safeDownload(
                  `/documents/manage/applications/${d.entityId}/${d.id}/download`,
                )
              }
              actions={
                <RouterLink to={`/org/documents/verification/${d.id}`}>
                  Review
                </RouterLink>
              }
            />
          ))}
        </Card>
      ) : (
        <EmptyState
          title="Verification queue is clear"
          description="No application documents match this status."
        />
      )}
      {q.data && (
        <PageControls
          page={q.data.page}
          pages={q.data.pages}
          onPage={(page) => {
            const n = new URLSearchParams(sp);
            n.set('page', String(page));
            setSp(n);
          }}
        />
      )}
      <Alert tone="neutral" title="Replacement requests unavailable">
        <p>
          The backend supports approve and reject only. A safe rejection reason
          can tell the candidate to replace a document while their application
          remains writable.
        </p>
      </Alert>
    </main>
  );
}
export function VerificationDetailPage() {
  const { documentId = '' } = useParams(),
    { recruiter } = useAuth(),
    q = useVerification(documentId),
    m = useDocumentMutation(),
    [reason, setReason] = useState('');
  if (q.isLoading) return <LoadingState />;
  if (!q.data) return <ErrorState detail={errorText(q.error)} />;
  const d = q.data;
  const pending = d.verification.status === 'pending',
    canDownload = Boolean(recruiter?.permissions.includes('documents.view'));
  return (
    <main>
      <PageHeader
        title={d.displayName}
        description={`${d.category} · ${formatBytes(d.sizeBytes)}`}
        metadata={<StatusTag>{d.verification.status}</StatusTag>}
      />
      <Card>
        <dl className="od-dl">
          <div>
            <dt>Original file</dt>
            <dd>{d.originalFileName}</dd>
          </div>
          <div>
            <dt>Scan status</dt>
            <dd>{d.scanStatus}</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>{date(d.createdAt)}</dd>
          </div>
        </dl>
        <Button
          variant="secondary"
          disabled={
            !canDownload || d.status !== 'active' || d.scanStatus !== 'clean'
          }
          onClick={() =>
            void safeDownload(
              `/documents/manage/applications/${d.entityId}/${d.id}/download`,
            )
          }
        >
          {canDownload ? 'Secure download' : 'Download requires documents.view'}
        </Button>
        <TextArea
          label="Candidate-safe rejection reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <FormActions>
          <ConfirmDialog
            title="Verify document?"
            description="This marks the candidate document as verified."
            confirmLabel="Verify"
            onConfirm={() =>
              m.mutateAsync({
                path: `/documents/manage/verification/${documentId}/approve`,
                body: {},
              })
            }
            trigger={<Button disabled={!pending}>Verify</Button>}
          />
          <ConfirmDialog
            title="Reject document?"
            description="The candidate will see the rejection reason. Private reviewer notes are not shown or collected here."
            confirmLabel="Reject"
            variant="destructive"
            onConfirm={() =>
              m.mutateAsync({
                path: `/documents/manage/verification/${documentId}/reject`,
                body: { reason },
              })
            }
            trigger={
              <Button
                variant="danger"
                disabled={!pending || reason.trim().length < 3}
              >
                Reject
              </Button>
            }
          />
        </FormActions>
      </Card>
    </main>
  );
}
