/* eslint-disable react-refresh/only-export-components -- URL canonicalization is exported beside its route components for contract tests. */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  DateField,
  DescriptionList,
  Dialog,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  LoadingState,
  PageHeader,
  Pagination,
  PermissionState,
  Progress,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  useApplication,
  useApplications,
  useCandidate,
  useCandidates,
  useMoveApplication,
  usePipeline,
} from './api';
import {
  applicationStatuses,
  formatDate,
  labelStatus,
  rejectionCategories,
  transitions,
  type ApplicationDetail,
  type ApplicationRow,
  type ApplicationStatus,
  type CandidateDetail,
  type CandidateRow,
  type EvidenceItem,
} from './model';
import './ats-workspace.css';

const statusTone = (s: string) =>
  s === 'hired' || s === 'offer-accepted'
    ? 'success'
    : s === 'rejected' || s === 'offer-declined'
      ? 'danger'
      : s.includes('pending')
        ? 'warning'
        : 'neutral';
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : 'The requested data could not be loaded.';
const applicationSorts = [
  'newest',
  'oldest',
  'match-high',
  'match-low',
  'rating-high',
  'rating-low',
  'candidate-name',
] as const;
const candidateSorts = [
  'newest',
  'oldest',
  'completion-desc',
  'completion-asc',
] as const;
const objectId = /^[a-f\d]{24}$/i;
export function canonicalizeParams(
  source: URLSearchParams,
  type: 'applications' | 'candidates',
) {
  const p = new URLSearchParams(source);
  const page = Number(p.get('page'));
  if (!Number.isInteger(page) || page < 1) p.set('page', '1');
  const sorts = type === 'applications' ? applicationSorts : candidateSorts;
  if (!sorts.includes((p.get('sort') || 'newest') as never))
    p.set('sort', 'newest');
  if (type === 'applications') {
    if (!['list', 'board'].includes(p.get('view') || 'list'))
      p.set('view', 'list');
    if (
      p.has('stage') &&
      !applicationStatuses.includes(p.get('stage') as ApplicationStatus)
    )
      p.delete('stage');
    for (const [key, min, max] of [
      ['minMatch', 0, 100],
      ['rating', 1, 5],
    ] as const) {
      const n = Number(p.get(key));
      if (p.has(key) && (!Number.isFinite(n) || n < min || n > max))
        p.delete(key);
    }
    for (const key of ['jobId', 'assignedRecruiter'])
      if (p.has(key) && !objectId.test(p.get(key) || '')) p.delete(key);
    for (const key of ['from', 'to'])
      if (p.has(key) && Number.isNaN(Date.parse(p.get(key) || '')))
        p.delete(key);
    if (
      p.has('from') &&
      p.has('to') &&
      Date.parse(p.get('to') || '') < Date.parse(p.get('from') || '')
    )
      p.delete('to');
  } else {
    if (
      p.has('availability') &&
      !['immediately', 'notice-period', 'unavailable'].includes(
        p.get('availability') || '',
      )
    )
      p.delete('availability');
    if (
      p.has('jobType') &&
      ![
        'internship',
        'full-time',
        'part-time',
        'contract',
        'freelance',
      ].includes(p.get('jobType') || '')
    )
      p.delete('jobType');
    const n = Number(p.get('experience'));
    if (p.has('experience') && (!Number.isFinite(n) || n < 0))
      p.delete('experience');
  }
  return p;
}
const toQuery = (p: URLSearchParams, type: 'applications' | 'candidates') => {
  const out = new URLSearchParams();
  out.set('page', p.get('page') || '1');
  out.set('limit', '10');
  const map =
    type === 'applications'
      ? {
          q: 'search',
          stage: 'status',
          skills: 'skills',
          minMatch: 'minimumMatchScore',
          rating: 'minimumRating',
          tags: 'tags',
          jobId: 'jobId',
          assignedRecruiter: 'assignedRecruiter',
          from: 'submittedFrom',
          to: 'submittedTo',
          sort: 'sort',
        }
      : {
          q: 'search',
          skills: 'skills',
          location: 'location',
          role: 'preferredRole',
          jobType: 'jobType',
          availability: 'availability',
          experience: 'minimumExperience',
          sort: 'sort',
        };
  Object.entries(map).forEach(([u, a]) => {
    const v = p.get(u);
    if (v) out.set(a, v);
  });
  if (!out.has('sort')) out.set('sort', 'newest');
  return out.toString();
};
function setParam(
  params: URLSearchParams,
  set: (p: URLSearchParams) => void,
  key: string,
  value: string,
) {
  const n = new URLSearchParams(params);
  if (value) n.set(key, value);
  else n.delete(key);
  if (key !== 'page') n.set('page', '1');
  set(n);
}
function AtsHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      secondaryActions={
        <nav aria-label="ATS sections" className="ats-tabs">
          <RouterLink to="/org/applications">Applications</RouterLink>
          <RouterLink to="/org/candidates">Candidates</RouterLink>
        </nav>
      }
    />
  );
}
function Filters({
  kind,
  params,
  setParams,
}: {
  kind: 'applications' | 'candidates';
  params: URLSearchParams;
  setParams: (p: URLSearchParams) => void;
}) {
  const filtered = [...params.keys()].some(
    (k) => !['page', 'view', 'sort'].includes(k),
  );
  return (
    <Toolbar
      label={`${kind} filters`}
      start={
        <div className="ats-filters">
          <TextField
            label="Search"
            value={params.get('q') || ''}
            onChange={(e) => setParam(params, setParams, 'q', e.target.value)}
            placeholder={
              kind === 'applications'
                ? 'Candidate or application'
                : 'Name, skill or headline'
            }
          />
          {kind === 'applications' ? (
            <>
              <Select
                label="Stage"
                value={params.get('stage') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'stage', e.target.value)
                }
                options={applicationStatuses.map((s) => ({
                  value: s,
                  label: labelStatus(s),
                }))}
              />
              <TextField
                label="Skills"
                value={params.get('skills') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'skills', e.target.value)
                }
                placeholder="React, TypeScript"
              />
              <TextField
                label="Minimum match"
                type="number"
                min="0"
                max="100"
                value={params.get('minMatch') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'minMatch', e.target.value)
                }
              />
              <TextField
                label="Minimum rating"
                type="number"
                min="1"
                max="5"
                value={params.get('rating') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'rating', e.target.value)
                }
              />
              <TextField
                label="Tags"
                value={params.get('tags') || ''}
                placeholder="priority, portfolio"
                onChange={(e) =>
                  setParam(params, setParams, 'tags', e.target.value)
                }
              />
              <DateField
                label="Submitted from"
                value={params.get('from') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'from', e.target.value)
                }
              />
              <DateField
                label="Submitted to"
                value={params.get('to') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'to', e.target.value)
                }
              />
            </>
          ) : (
            <>
              <TextField
                label="Skills"
                value={params.get('skills') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'skills', e.target.value)
                }
              />
              <TextField
                label="Location"
                value={params.get('location') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'location', e.target.value)
                }
              />
              <Select
                label="Availability"
                value={params.get('availability') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'availability', e.target.value)
                }
                options={['immediately', 'notice-period', 'unavailable'].map(
                  (x) => ({ value: x, label: labelStatus(x) }),
                )}
              />
              <TextField
                label="Preferred role"
                value={params.get('role') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'role', e.target.value)
                }
              />
              <Select
                label="Job type"
                value={params.get('jobType') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'jobType', e.target.value)
                }
                options={[
                  'internship',
                  'full-time',
                  'part-time',
                  'contract',
                  'freelance',
                ].map((x) => ({ value: x, label: labelStatus(x) }))}
              />
              <TextField
                label="Minimum experience"
                type="number"
                min="0"
                value={params.get('experience') || ''}
                onChange={(e) =>
                  setParam(params, setParams, 'experience', e.target.value)
                }
              />
            </>
          )}
          <Select
            label="Sort"
            value={params.get('sort') || 'newest'}
            onChange={(e) =>
              setParam(params, setParams, 'sort', e.target.value)
            }
            options={(kind === 'applications'
              ? [
                  'newest',
                  'oldest',
                  'match-high',
                  'match-low',
                  'rating-high',
                  'rating-low',
                  'candidate-name',
                ]
              : ['newest', 'oldest', 'completion-desc', 'completion-asc']
            ).map((x) => ({ value: x, label: labelStatus(x) }))}
          />
          {filtered && (
            <Button
              variant="quiet"
              onClick={() =>
                setParams(
                  new URLSearchParams(
                    kind === 'applications'
                      ? { view: params.get('view') || 'list' }
                      : {},
                  ),
                )
              }
            >
              Clear filters
            </Button>
          )}
        </div>
      }
    />
  );
}
function MoveDialog({
  row,
  open,
  onOpenChange,
  onAnnounce,
}: {
  row: ApplicationRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAnnounce: (v: string) => void;
}) {
  const choices = row.status === 'unknown' ? [] : transitions[row.status];
  const [destination, setDestination] = useState<ApplicationStatus | ''>('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('other');
  const [notice, setNotice] = useState('');
  const move = useMoveApplication(row.id);
  const submit = async () => {
    if (!destination) return;
    if (destination === 'rejected' && !reason.trim()) {
      setNotice('A rejection reason is required.');
      return;
    }
    try {
      await move.mutateAsync({
        status: destination,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(destination === 'rejected' ? { rejectionCategory: category } : {}),
      });
      onOpenChange(false);
      onAnnounce(
        `${row.candidateName} moved from ${labelStatus(row.status)} to ${labelStatus(destination)}.`,
      );
      setDestination('');
      setReason('');
      setNotice('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const intended = destination;
        setNotice('');
        setDestination('');
        setReason('');
        onOpenChange(false);
        onAnnounce(
          `Move to ${labelStatus(intended)} was not completed because this application changed. Refreshed data is available; reopen Move to stage and explicitly confirm a currently valid action.`,
        );
      } else setNotice(errorMessage(e));
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Move to stage"
      description={`Confirm a stage change for ${row.candidateName}.`}
      busy={move.isPending}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={move.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            loading={move.isPending}
            disabled={!destination}
          >
            Confirm movement
          </Button>
        </>
      }
    >
      <div className="ats-dialog-fields">
        <p>
          <strong>Current stage:</strong> {labelStatus(row.status)}
        </p>
        {choices.length ? (
          <Select
            label="Destination"
            value={destination}
            onChange={(e) =>
              setDestination(e.target.value as ApplicationStatus)
            }
            options={choices.map((s) => ({ value: s, label: labelStatus(s) }))}
          />
        ) : (
          <Alert title="No movement available" tone="info">
            This application is at a terminal or unknown stage.
          </Alert>
        )}
        {destination === 'rejected' && (
          <>
            <TextArea
              label="Rejection reason"
              required
              value={reason}
              error={notice && !reason.trim() ? notice : undefined}
              onChange={(e) => setReason(e.target.value)}
            />
            <Select
              label="Rejection category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={rejectionCategories.map((x) => ({
                value: x,
                label: labelStatus(x),
              }))}
            />
          </>
        )}
        {notice && !(destination === 'rejected' && !reason.trim()) && (
          <Alert title="Movement not completed" tone="warning">
            {notice}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}
function Actions({
  row,
  canManage,
  onAnnounce,
}: {
  row: ApplicationRow;
  canManage: boolean;
  onAnnounce: (s: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ats-actions">
      <RouterLink
        className="tvx-button tvx-button--secondary tvx-button--compact"
        to={`/org/applications/${row.id}`}
      >
        View application
      </RouterLink>
      {row.profileId && (
        <RouterLink
          className="tvx-button tvx-button--quiet tvx-button--compact"
          to={`/org/candidates/${row.profileId}`}
        >
          View profile
        </RouterLink>
      )}
      {canManage &&
        row.status !== 'unknown' &&
        transitions[row.status].length > 0 && (
          <Button size="compact" onClick={() => setOpen(true)}>
            Move to stage
          </Button>
        )}
      <MoveDialog
        row={row}
        open={open}
        onOpenChange={setOpen}
        onAnnounce={onAnnounce}
      />
    </div>
  );
}
function Match({ row }: { row: ApplicationRow }) {
  return (
    <span
      className="ats-match"
      aria-label={`${row.matchScore} percent deterministic skill match`}
    >
      <strong>{row.matchScore}</strong>
      <small>Skill match</small>
    </span>
  );
}
function ApplicationCard({
  row,
  actions,
}: {
  row: ApplicationRow;
  actions: ReactNode;
}) {
  return (
    <article className="ats-record">
      <div>
        <strong>{row.candidateName}</strong>
        <span>{row.jobTitle}</span>
      </div>
      <Match row={row} />
      <div className="ats-skills">
        {row.skills.slice(0, 3).map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
      <StatusTag tone={statusTone(row.status)}>
        {labelStatus(row.status)}
      </StatusTag>
      <small>Submitted {formatDate(row.submittedAt)}</small>
      {actions}
    </article>
  );
}
export function ApplicationsPage() {
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('applications.view'));
  const canManage = Boolean(
    recruiter?.permissions.includes('applications.manage'),
  );
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const next = canonicalizeParams(params, 'applications');
    if (next.toString() !== params.toString())
      setParams(next, { replace: true });
  }, [params, setParams]);
  const view = params.get('view') === 'board' ? 'board' : 'list';
  const query = useApplications(toQuery(params, 'applications'), canView);
  const pipeline = usePipeline(params.get('jobId') || undefined, canView);
  const [announcement, setAnnouncement] = useState('');
  const rows = query.data?.items ?? [];
  const actions = (r: ApplicationRow) => (
    <Actions row={r} canManage={canManage} onAnnounce={setAnnouncement} />
  );
  const empty = [...params.keys()].some(
    (k) => !['page', 'view', 'sort'].includes(k),
  ) ? (
    <FilteredEmptyState
      title="No matching applications"
      description="Try clearing or adjusting the current filters."
      onClear={() => setParams(new URLSearchParams({ view }))}
    />
  ) : (
    <EmptyState
      title="No applications yet"
      description="Applications will appear here after candidates submit."
    />
  );
  if (!canView)
    return (
      <PermissionState description="The applications.view permission is required for this workspace." />
    );
  return (
    <div className="ats-page">
      <AtsHeader
        title="Applications"
        description="Review submitted evidence and move candidates through the hiring pipeline."
      />
      <div
        className={announcement ? 'ats-notice' : 'visually-hidden'}
        aria-live="polite"
      >
        {announcement}
      </div>
      <Filters kind="applications" params={params} setParams={setParams} />
      <p className="ats-results" aria-live="polite">
        Showing {rows.length} of {query.data?.page.total ?? 0} applications on
        page {query.data?.page.page ?? 1}.
      </p>
      {pipeline.isError && (
        <Alert tone="warning" title="Pipeline totals unavailable">
          <p>
            Application results remain available, but all-time company/job
            totals could not be loaded.
          </p>
          <Button variant="secondary" onClick={() => void pipeline.refetch()}>
            Retry totals
          </Button>
        </Alert>
      )}
      <div className="ats-view-toggle" aria-label="View">
        <Button
          variant={view === 'list' ? 'primary' : 'secondary'}
          onClick={() => setParam(params, setParams, 'view', 'list')}
        >
          Pipeline list
        </Button>
        <Button
          variant={view === 'board' ? 'primary' : 'secondary'}
          onClick={() => setParam(params, setParams, 'view', 'board')}
        >
          Pipeline board
        </Button>
      </div>
      {query.isError ? (
        <ErrorState
          detail={errorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : view === 'board' ? (
        <PipelineBoard
          rows={rows}
          loading={query.isLoading}
          counts={pipeline.data?.pipeline ?? {}}
          actions={actions}
          empty={empty}
          {...(query.data?.page
            ? {
                page: query.data.page,
                setPage: (p: number) =>
                  setParam(params, setParams, 'page', String(p)),
              }
            : {})}
        />
      ) : (
        <PipelineList
          rows={rows}
          loading={query.isLoading}
          {...(query.data?.page ? { page: query.data.page } : {})}
          setPage={(p) => setParam(params, setParams, 'page', String(p))}
          actions={actions}
          empty={empty}
        />
      )}
    </div>
  );
}
function PipelineList({
  rows,
  loading,
  page,
  setPage,
  actions,
  empty,
}: {
  rows: ApplicationRow[];
  loading: boolean;
  page?: { page: number; pages: number };
  setPage: (p: number) => void;
  actions: (r: ApplicationRow) => ReactNode;
  empty: ReactNode;
}) {
  return (
    <DataTable
      caption="Applications in the current result page"
      rows={rows}
      rowKey={(r) => r.id}
      isLoading={loading}
      empty={empty}
      columns={[
        {
          id: 'candidate',
          header: 'Candidate',
          render: (r) => (
            <>
              <strong>{r.candidateName}</strong>
              <small>{r.jobTitle}</small>
            </>
          ),
        },
        { id: 'match', header: 'Match', render: (r) => <Match row={r} /> },
        {
          id: 'skills',
          header: 'Skills',
          render: (r) => (
            <span className="ats-skills">
              {r.skills.slice(0, 3).map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </span>
          ),
        },
        {
          id: 'stage',
          header: 'Stage',
          render: (r) => (
            <StatusTag tone={statusTone(r.status)}>
              {labelStatus(r.status)}
            </StatusTag>
          ),
        },
        {
          id: 'submitted',
          header: 'Submitted',
          render: (r) => formatDate(r.submittedAt),
        },
      ]}
      rowActions={actions}
      renderNarrow={(r) => <ApplicationCard row={r} actions={null} />}
      {...(page
        ? {
            pagination: {
              page: page.page,
              totalPages: page.pages,
              onPageChange: setPage,
              ariaLabel: 'Application pages',
            },
          }
        : {})}
    />
  );
}
function PipelineBoard({
  rows,
  loading,
  counts,
  actions,
  empty,
  page,
  setPage,
}: {
  rows: ApplicationRow[];
  loading: boolean;
  counts: Record<string, number>;
  actions: (r: ApplicationRow) => ReactNode;
  empty: ReactNode;
  page?: { page: number; pages: number };
  setPage?: (page: number) => void;
}) {
  if (loading) return <LoadingState label="Loading pipeline" />;
  if (!rows.length) return <>{empty}</>;
  const stages = applicationStatuses.filter(
    (s) => rows.some((r) => r.status === s) || (counts[s] ?? 0) > 0,
  );
  return (
    <section aria-label="Pipeline board" className="ats-board-mode">
      <div className="ats-board-note">
        <p>
          Cards show the current result page. Column totals are company-wide, or
          job-wide when a job filter is active; other filters do not affect
          them.
        </p>
        <div className="ats-board">
          {stages.map((s) => (
            <section
              className="ats-column"
              key={s}
              aria-labelledby={`stage-${s}`}
            >
              <header>
                <h2 id={`stage-${s}`}>{labelStatus(s)}</h2>
                <Badge>
                  {counts[s] ?? rows.filter((r) => r.status === s).length} total
                </Badge>
              </header>
              {rows
                .filter((r) => r.status === s)
                .map((r) => (
                  <ApplicationCard key={r.id} row={r} actions={actions(r)} />
                ))}
            </section>
          ))}
        </div>
        {page && setPage && (
          <Pagination
            page={page.page}
            totalPages={page.pages}
            onPageChange={setPage}
            ariaLabel="Application board pages"
          />
        )}
      </div>
      <div className="ats-board-fallback">
        <PipelineList
          rows={rows}
          loading={false}
          {...(page ? { page } : {})}
          setPage={setPage ?? (() => undefined)}
          actions={actions}
          empty={empty}
        />
      </div>
    </section>
  );
}

function EvidenceRail({ detail }: { detail: ApplicationDetail }) {
  const submission = {
    to: 'submitted',
    date: detail.submittedAt,
    from: undefined,
    reason: undefined,
  };
  const history =
    detail.history[0]?.to === 'submitted'
      ? detail.history
      : [submission, ...detail.history];
  return (
    <aside className="ats-evidence-rail" aria-labelledby="evidence-history">
      <h2 id="evidence-history">Evidence trail</h2>
      <ol>
        {history.map((h, i) => (
          <li key={`${h.to}-${h.date ?? i}`}>
            <strong>{labelStatus(h.to)}</strong>
            <span>
              {h.from ? `From ${labelStatus(h.from)}` : 'Application submitted'}
            </span>
            <time>{formatDate(h.date)}</time>
            {h.reason && <p>{h.reason}</p>}
          </li>
        ))}
      </ol>
    </aside>
  );
}
const EvidenceSection = ({
  title,
  items,
}: {
  title: string;
  items: EvidenceItem[];
}) =>
  items.length ? (
    <Card heading={title} headingLevel={2}>
      {items.map((i, n) => (
        <article className="ats-evidence" key={`${i.title}-${n}`}>
          <strong>{i.title}</strong>
          {i.subtitle && <span>{i.subtitle}</span>}
          {i.meta && <small>{i.meta}</small>}
          {i.detail && <p>{i.detail}</p>}
        </article>
      ))}
    </Card>
  ) : null;
export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('applications.view'));
  const q = useApplication(applicationId, Boolean(applicationId) && canView);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  if (!canView)
    return (
      <PermissionState description="The applications.view permission is required for this application." />
    );
  if (q.isLoading) return <LoadingState label="Loading application" />;
  if (q.isError)
    return (
      <ErrorState
        title={
          (q.error as ApiError).status === 404
            ? 'Application unavailable'
            : 'Could not load application'
        }
        detail={
          (q.error as ApiError).status === 404
            ? 'This application was not found or is outside your organization.'
            : errorMessage(q.error)
        }
        retry={() => void q.refetch()}
      />
    );
  const a = q.data;
  if (!a) return null;
  return (
    <div className="ats-page">
      <PageHeader
        title={a.candidateName}
        eyebrow={a.number}
        description={`Application for ${a.jobTitle}`}
        metadata={
          <StatusTag tone={statusTone(a.status)}>
            {labelStatus(a.status)}
          </StatusTag>
        }
        primaryAction={
          recruiter?.permissions.includes('applications.manage') &&
          a.status !== 'unknown' &&
          transitions[a.status].length ? (
            <Button onClick={() => setOpen(true)}>Move to stage</Button>
          ) : undefined
        }
      />
      <div
        aria-live="polite"
        className={notice ? 'ats-notice' : 'visually-hidden'}
      >
        {notice}
      </div>
      <MoveDialog
        row={a}
        open={open}
        onOpenChange={setOpen}
        onAnnounce={setNotice}
      />
      <div className="ats-detail-grid">
        <div className="ats-detail-primary">
          <Card heading="Submitted application" headingLevel={2}>
            <DescriptionList
              variant="horizontal"
              items={[
                { term: 'Candidate', description: a.candidateName },
                { term: 'Job snapshot', description: a.jobTitle },
                { term: 'Application', description: a.number },
                { term: 'Source', description: labelStatus(a.source) },
                { term: 'Submitted', description: formatDate(a.submittedAt) },
                {
                  term: 'Deterministic skill match',
                  description: `${a.matchScore}%`,
                },
                {
                  term: 'Recruiter rating',
                  description: a.rating ? `${a.rating} of 5` : 'Not rated',
                },
                { term: 'Tags', description: a.tags.join(', ') || 'None' },
              ]}
            />
            {a.coverLetter && (
              <section>
                <h3>Cover letter</h3>
                <p className="ats-preserve">{a.coverLetter}</p>
              </section>
            )}
            {a.answers.length > 0 && (
              <section>
                <h3>Application answers</h3>
                {a.answers.map((x, i) => (
                  <div className="ats-answer" key={i}>
                    <strong>{x.question}</strong>
                    <p>{x.answer}</p>
                  </div>
                ))}
              </section>
            )}
            {a.resume && (
              <section>
                <h3>Resume evidence</h3>
                <p>
                  {a.resume.fileName} · uploaded{' '}
                  {formatDate(a.resume.uploadedAt)}. Download is unavailable in
                  this workspace.
                </p>
              </section>
            )}
          </Card>
          <Card
            heading="Skill match evidence"
            headingLevel={2}
            description="Calculated deterministically from the submitted profile and job snapshot; this is not an AI score."
          >
            <Progress
              value={a.matchScore}
              label={`${a.matchScore}% skill match`}
            />
            <p>
              <strong>Matched:</strong>{' '}
              {a.matchedSkills.join(', ') || 'None recorded'}
            </p>
            <p>
              <strong>Missing required:</strong>{' '}
              {a.missingSkills.join(', ') || 'None recorded'}
            </p>
          </Card>
          <EvidenceSection title="Experience" items={a.experience} />
          <EvidenceSection title="Education" items={a.education} />
          <EvidenceSection title="Projects" items={a.projects} />
          <EvidenceSection title="Certifications" items={a.certifications} />
        </div>
        <EvidenceRail detail={a} />
      </div>
    </div>
  );
}

function CandidateCard({ candidate }: { candidate: CandidateRow }) {
  return (
    <article className="ats-record">
      <div>
        <strong>{candidate.name}</strong>
        <span>{candidate.headline}</span>
      </div>
      <span>{candidate.location}</span>
      <div className="ats-skills">
        {candidate.skills.slice(0, 4).map((s) => (
          <Badge key={s}>{s}</Badge>
        ))}
      </div>
      <Progress
        value={candidate.completion}
        label={`${candidate.completion}% profile complete`}
      />
      <RouterLink
        className="tvx-button tvx-button--secondary"
        to={`/org/candidates/${candidate.id}`}
      >
        View profile
      </RouterLink>
    </article>
  );
}
export function CandidatesPage() {
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('applications.view'));
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const next = canonicalizeParams(params, 'candidates');
    if (next.toString() !== params.toString())
      setParams(next, { replace: true });
  }, [params, setParams]);
  const q = useCandidates(toQuery(params, 'candidates'), canView);
  const rows = q.data?.items ?? [];
  const filtered = [...params.keys()].some(
    (k) => !['page', 'sort'].includes(k),
  );
  if (!canView)
    return (
      <PermissionState description="The applications.view permission is required for candidate search." />
    );
  return (
    <div className="ats-page">
      <AtsHeader
        title="Candidates"
        description="Search recruiter-visible profiles without exposing private contact or compensation data."
      />
      <Filters kind="candidates" params={params} setParams={setParams} />
      <p className="ats-results" aria-live="polite">
        Showing {rows.length} of {q.data?.page.total ?? 0} candidates on page{' '}
        {q.data?.page.page ?? 1}.
      </p>
      {q.isError ? (
        <ErrorState
          detail={errorMessage(q.error)}
          retry={() => void q.refetch()}
        />
      ) : (
        <DataTable
          caption="Recruiter-visible candidates"
          rows={rows}
          rowKey={(r) => r.id}
          isLoading={q.isLoading}
          empty={
            filtered ? (
              <FilteredEmptyState
                title="No matching candidates"
                description="Try clearing the current filters."
                onClear={() => setParams(new URLSearchParams())}
              />
            ) : (
              <EmptyState
                title="No visible candidates"
                description="Public and recruiter-visible profiles will appear here."
              />
            )
          }
          columns={[
            {
              id: 'candidate',
              header: 'Candidate',
              render: (r) => (
                <>
                  <strong>{r.name}</strong>
                  <small>{r.headline}</small>
                </>
              ),
            },
            { id: 'location', header: 'Location', accessor: (r) => r.location },
            {
              id: 'skills',
              header: 'Skills',
              render: (r) => (
                <span className="ats-skills">
                  {r.skills.slice(0, 4).map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </span>
              ),
            },
            {
              id: 'availability',
              header: 'Availability',
              render: (r) => (
                <StatusTag>{labelStatus(r.availability)}</StatusTag>
              ),
            },
            {
              id: 'completion',
              header: 'Profile',
              render: (r) => (
                <Progress
                  value={r.completion}
                  label={`${r.completion}% complete`}
                />
              ),
            },
          ]}
          renderNarrow={(r) => <CandidateCard candidate={r} />}
          rowActions={(r) => (
            <RouterLink
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`/org/candidates/${r.id}`}
            >
              View profile
            </RouterLink>
          )}
          {...(q.data
            ? {
                pagination: {
                  page: q.data.page.page,
                  totalPages: q.data.page.pages,
                  onPageChange: (p: number) =>
                    setParam(params, setParams, 'page', String(p)),
                  ariaLabel: 'Candidate pages',
                },
              }
            : {})}
        />
      )}
    </div>
  );
}
function CandidateSections({ c }: { c: CandidateDetail }) {
  return (
    <>
      <EvidenceSection title="Experience" items={c.experience} />
      <EvidenceSection title="Education" items={c.education} />
      <EvidenceSection title="Projects" items={c.projects} />
      <EvidenceSection title="Certifications" items={c.certifications} />
    </>
  );
}
export function CandidateDetailPage() {
  const { candidateId = '' } = useParams();
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('applications.view'));
  const q = useCandidate(candidateId, Boolean(candidateId) && canView);
  const navigate = useNavigate();
  if (!canView)
    return (
      <PermissionState description="The applications.view permission is required for candidate profiles." />
    );
  if (q.isLoading) return <LoadingState label="Loading candidate profile" />;
  if (q.isError)
    return (
      <ErrorState
        title={
          (q.error as ApiError).status === 404
            ? 'Profile unavailable'
            : 'Could not load profile'
        }
        detail={
          (q.error as ApiError).status === 404
            ? 'This profile is private, unavailable, or no longer visible to recruiters.'
            : errorMessage(q.error)
        }
        retry={() => void q.refetch()}
      />
    );
  const c = q.data;
  if (!c) return null;
  return (
    <div className="ats-page">
      <PageHeader
        title={c.name}
        eyebrow="Recruiter-visible profile"
        description={c.headline}
        secondaryActions={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back to candidates
          </Button>
        }
      />
      <div className="ats-detail-grid">
        <div className="ats-detail-primary">
          <Card heading="Candidate evidence" headingLevel={2}>
            <p>{c.bio || 'No profile summary provided.'}</p>
            <DescriptionList
              items={[
                { term: 'Location', description: c.location },
                {
                  term: 'Availability',
                  description: labelStatus(c.availability),
                },
                {
                  term: 'Notice period',
                  description:
                    c.noticeDays === undefined
                      ? 'Not provided'
                      : `${c.noticeDays} days`,
                },
                {
                  term: 'Preferred roles',
                  description: c.preferredRoles.join(', ') || 'Not provided',
                },
                {
                  term: 'Preferred job types',
                  description:
                    c.jobTypes.map(labelStatus).join(', ') || 'Not provided',
                },
                {
                  term: 'Preferred locations',
                  description:
                    c.preferredLocations.join(', ') || 'Not provided',
                },
              ]}
            />
          </Card>
          <Card heading="Skills" headingLevel={2}>
            {c.skillDetails.length ? (
              <ul className="ats-skill-list">
                {c.skillDetails.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong>
                    <span>
                      {labelStatus(s.proficiency)} · {s.years} years
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No skills listed.</p>
            )}
          </Card>
          <CandidateSections c={c} />
        </div>
        <aside>
          <Card heading="Profile completeness" headingLevel={2}>
            <Progress
              value={c.completion}
              label={`${c.completion}% profile complete`}
            />
            <p>
              This view intentionally excludes contact details, salary
              expectations, resumes and social accounts.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
