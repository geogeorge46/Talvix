import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Link as RouterLink,
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
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : 'Something went wrong.';
const date = (v?: string) =>
  v
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(v),
      )
    : 'Not provided';
function OfferRow({ offer, to }: { offer: Offer; to: string }) {
  return (
    <article className="od-record">
      <div>
        <strong>
          <RouterLink to={to}>{offer.title}</RouterLink>
        </strong>
        <span>
          {offer.candidateName} · Revision {offer.revisionNumber ?? 1}
        </span>
      </div>
      <div>
        <StatusTag tone={offerTone(offer.status)}>
          {offer.status.replaceAll('-', ' ')}
        </StatusTag>
        <span>{formatMoney(offer)}</span>
      </div>
    </article>
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
          <>
            <RouterLink
              className="tvx-button tvx-button--secondary tvx-button--regular"
              to="/org/offers/templates"
            >
              Templates
            </RouterLink>
            <RouterLink
              className="tvx-button tvx-button--secondary tvx-button--regular"
              to="/org/offers/approvals"
            >
              Approvals
            </RouterLink>
          </>
        }
      />
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
        <Card>
          <div className="od-list">
            {q.data.items.map((o) => (
              <OfferRow key={o.id} offer={o} to={`/org/offers/${o.id}`} />
            ))}
          </div>
        </Card>
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
    nav = useNavigate(),
    offerQ = useManagedOffer(
      offerId ?? '',
      mode === 'edit' && validId(offerId),
    ),
    mutation = useOfferMutation(),
    [form, setForm] = useState(baseForm),
    [seeded, setSeeded] = useState(false),
    [error, setError] = useState('');
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
    try {
      const createBody = {
        title: form.title,
        department: form.department || undefined,
        employmentType: form.employmentType,
        workMode: form.workMode,
        joiningDate: form.joiningDate,
        compensation: {
          currency: form.currency,
          period: form.period,
          base: Number(form.base),
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
        validityDays: Number(form.validityDays),
        applicationId: (
          e.currentTarget.elements.namedItem(
            'applicationId',
          ) as HTMLInputElement | null
        )?.value,
      };
      const body =
        mode === 'create'
          ? createBody
          : {
              title: form.title,
              department: form.department || undefined,
              employmentType: form.employmentType,
              workMode: form.workMode,
              joiningDate: form.joiningDate,
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
            <TextField
              name="applicationId"
              label="Application ID"
              required
              pattern="[a-fA-F0-9]{24}"
            />
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
    send = Boolean(recruiter?.permissions.includes('offers.send'));
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
                <OfferAction
                  label="Request revision"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'revision-required' }}
                />
                <OfferAction
                  label="Reject negotiation"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'rejected' }}
                />
                <OfferAction
                  label="Reaffirm terms"
                  path={`/offers/manage/${offerId}/negotiation/resolve`}
                  body={{ resolution: 'reaffirmed' }}
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
      <div className="od-split">
        <Card heading="Offer terms">
          <OfferTerms offer={o} />
        </Card>
        <Card
          heading="Revision history"
          description="Attachments remain on the exact revision where they were uploaded."
        >
          {history.data?.map((x) => (
            <div key={x.id}>
              <StatusTag tone={x.id === o.id ? 'success' : 'neutral'}>
                {x.id === o.id ? 'Current revision' : 'Previous revision'}
              </StatusTag>
              <OfferRow offer={x} to={`/org/offers/${x.id}`} />
            </div>
          ))}
          {!history.data?.length && <p>This is the only revision.</p>}
          {manage &&
            [
              'rejected',
              'approved',
              'sent',
              'viewed',
              'negotiation-requested',
              'declined',
            ].includes(o.status) && (
              <RouterLink to={`/org/offers/${offerId}/revise`}>
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
            onConfirm={() =>
              m.mutateAsync({
                path: `/offers/approvals/${offerId}/approve`,
                body: {},
              })
            }
            trigger={<Button>Approve</Button>}
          />
          <ConfirmDialog
            title="Reject offer?"
            description="The draft returns for changes."
            confirmLabel="Reject"
            variant="destructive"
            onConfirm={() =>
              m.mutateAsync({
                path: `/offers/approvals/${offerId}/reject`,
                body: { reason },
              })
            }
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
    [title, setTitle] = useState(''),
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
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = { reason, ...(title.trim() ? { title } : {}) };
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
        description="The existing revision becomes superseded. Attachments are not copied to the new revision."
      />
      <Form onSubmit={submit} busy={m.isPending}>
        <TextArea
          label="Revision reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <TextField
          label="Updated title"
          aria-label="Updated title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {error && (
          <Alert tone="danger">
            <p>{error}</p>
          </Alert>
        )}
        <FormActions>
          <ConfirmDialog
            title="Create revision?"
            description="The current offer revision will be superseded."
            confirmLabel="Create revision"
            onConfirm={() => {
              const form = document.querySelector('form');
              form?.requestSubmit();
            }}
            trigger={
              <Button disabled={reason.trim().length < 1}>
                Create revision
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
    <main>
      <PageHeader
        title="My offers"
        description="Review offer terms and respond before they expire."
      />
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
      <Alert tone="neutral" title="List limitation">
        <p>The candidate offer API currently returns one unpaginated list.</p>
      </Alert>
    </main>
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
    [decline, setDecline] = useState('');
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
      <div className="od-split">
        <Card heading="Offer terms">
          <OfferTerms offer={o} />
          <p className="od-note">
            Accepting confirms your response in Talvix. This is not an
            electronic signature.
          </p>
          {active && (
            <FormActions align="start">
              <ConfirmDialog
                title="Accept this offer?"
                description="Your acceptance is final for this revision. This is not an electronic signature."
                confirmLabel="Accept offer"
                onConfirm={() =>
                  m.mutateAsync({
                    path: `/offers/me/${offerId}/accept`,
                    body: {},
                  })
                }
                trigger={<Button>Accept</Button>}
              />
              <ConfirmDialog
                title="Decline this offer?"
                description="Your response is consequential and cannot be undone here."
                confirmLabel="Decline offer"
                variant="destructive"
                onConfirm={() =>
                  m.mutateAsync({
                    path: `/offers/me/${offerId}/decline`,
                    body: { category: 'other', reason: decline },
                  })
                }
                trigger={
                  <Button variant="danger" disabled={decline.trim().length < 1}>
                    Decline
                  </Button>
                }
              />
            </FormActions>
          )}
          {active && (
            <>
              <TextArea
                label="Reason for declining"
                value={decline}
                onChange={(e) => setDecline(e.target.value)}
              />
              <TextArea
                label="Negotiation request"
                hint="Describe the changes you would like the recruiter to consider."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <ConfirmDialog
                title="Request negotiation?"
                description="This sends your request to the recruiter and pauses the current decision."
                confirmLabel="Send request"
                onConfirm={() =>
                  m.mutateAsync({
                    path: `/offers/me/${offerId}/negotiate`,
                    body: { message, requestedChanges: { comments: message } },
                  })
                }
                trigger={
                  <Button variant="secondary" disabled={!message.trim()}>
                    Request changes
                  </Button>
                }
              />
            </>
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
  actions,
  detailTo,
}: {
  doc: DocumentRecord;
  onDownload: () => void;
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
      <div>
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
        <Button
          variant="secondary"
          disabled={!downloadable}
          loading={downloading}
          onClick={() => void download()}
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
  const input = useRef<HTMLInputElement>(null),
    [state, setState] = useState<
      'idle' | 'preparing' | 'uploading' | 'success' | 'error'
    >('idle'),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(''),
    [selectedAccess, setSelectedAccess] = useState(access ?? 'company-private'),
    [constraints, setConstraints] = useState<{
      maximumBytes: number;
      allowedMimeTypes: string[];
    } | null>(null);
  const run = async () => {
    const file = input.current?.files?.[0];
    if (!file) return;
    setState('preparing');
    setError('');
    try {
      const session = await createUploadSession({
        category,
        entityType,
        entityId,
        purpose: 'Supporting document',
      });
      setConstraints(session);
      if (!session.allowedMimeTypes.includes(file.type))
        throw new Error(
          `Unsupported file type. Accepted: ${session.allowedMimeTypes.join(', ')}`,
        );
      if (file.size > session.maximumBytes)
        throw new Error(
          `File is too large. Maximum size is ${formatBytes(session.maximumBytes)}.`,
        );
      setState('uploading');
      const isProfileUpload = path.includes('/me/');
      const integratedOffer = path.includes('/manage/offers/');
      await xhrUpload(
        path,
        {
          uploadSessionId: session.id,
          purpose: 'Supporting document',
          displayName: file.name,
          ...(integratedOffer ? { access: selectedAccess } : {}),
          ...(!integratedOffer && !isProfileUpload ? { category } : {}),
        },
        file,
        setProgress,
      );
      setState('success');
      onDone();
    } catch (x) {
      setError(errorText(x));
      setState('error');
    }
  };
  return (
    <div className="od-upload">
      <label className="tvx-form-field">
        <span>{replaceId ? 'Replacement file' : 'Choose document'}</span>
        <input
          ref={input}
          className="tvx-input"
          type="file"
          accept={constraints?.allowedMimeTypes.join(',')}
        />
      </label>
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
      {constraints && (
        <p>
          Accepted: {constraints.allowedMimeTypes.join(', ')} · Maximum{' '}
          {formatBytes(constraints.maximumBytes)}
        </p>
      )}
      {state === 'uploading' && (
        <Progress value={progress} label="Upload progress" />
      )}
      {state === 'preparing' && (
        <p role="status">Checking upload constraints…</p>
      )}
      {state === 'success' && (
        <Alert tone="success" title="Upload complete">
          <p>
            The document is processing and will be available according to its
            scan state.
          </p>
        </Alert>
      )}
      {state === 'error' && (
        <Alert tone="danger" title="Upload failed">
          <p>{error}</p>
        </Alert>
      )}
      <Button
        onClick={() => void run()}
        loading={state === 'preparing' || state === 'uploading'}
      >
        {state === 'error'
          ? 'Retry with a new upload session'
          : replaceId
            ? 'Replace'
            : 'Upload'}
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
  return (
    <main>
      <PageHeader
        title="My documents"
        description="Manage files you own and see verification results."
      />
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
    </main>
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
