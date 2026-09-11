/* eslint-disable react-refresh/only-export-components -- URL canonicalization is exported beside its route components for contract tests. */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Link as RouterLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { Check, X, ExternalLink, Download, FileText, Globe } from 'lucide-react';
import { safeDownload } from '../offers-documents/api';
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
  useBulkApplications,
  useApplicationTimeline,
  useApplicationComments,
  useAddApplicationComment,
  useDeleteApplicationComment,
  useAddApplicationNote,
  useUpdateApplicationNote,
  useDeleteApplicationNote,
  useCandidateComparison,
  CommentItem,
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
import { useAssignments } from '../assessments/api';
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
function ShortlistCandidateDialog({
  row,
  open,
  onOpenChange,
  onAnnounce,
}: {
  row: { id: string; candidateName: string; status: ApplicationStatus | 'unknown' };
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAnnounce: (v: string) => void;
}) {
  const move = useMoveApplication(row.id);
  const [notice, setNotice] = useState('');
  const submit = async () => {
    try {
      await move.mutateAsync({
        status: 'shortlisted',
      });
      onOpenChange(false);
      onAnnounce(`Candidate shortlisted successfully.`);
      setNotice('');
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Shortlist Candidate?"
      description="This candidate will move to the Shortlisted stage."
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
          >
            Confirm Shortlist
          </Button>
        </>
      }
    >
      {notice && (
        <Alert title="Movement not completed" tone="warning">
          {notice}
        </Alert>
      )}
    </Dialog>
  );
}

function RejectCandidateDialog({
  row,
  open,
  onOpenChange,
  onAnnounce,
}: {
  row: { id: string; candidateName: string; status: ApplicationStatus | 'unknown' };
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAnnounce: (v: string) => void;
}) {
  const move = useMoveApplication(row.id);
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('skills-mismatch');
  const [notice, setNotice] = useState('');
  const submit = async () => {
    if (!reason.trim()) {
      setNotice('A rejection reason is required.');
      return;
    }
    try {
      await move.mutateAsync({
        status: 'rejected',
        reason: reason.trim(),
        rejectionCategory: category,
      });
      onOpenChange(false);
      onAnnounce(`${row.candidateName} rejected successfully.`);
      setReason('');
      setNotice('');
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reject Candidate"
      description={`Are you sure you want to reject ${row.candidateName}?`}
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
            variant="danger"
            onClick={() => void submit()}
            loading={move.isPending}
            disabled={!reason.trim()}
          >
            Reject Candidate
          </Button>
        </>
      }
    >
      <div className="ats-dialog-fields">
        <Select
          label="Reason Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={rejectionCategories.map((x) => ({
            value: x,
            label: labelStatus(x),
          }))}
        />
        <TextArea
          label="Rejection Reason Details"
          required
          value={reason}
          placeholder="Enter details explaining the rejection decision..."
          error={notice && !reason.trim() ? notice : undefined}
          onChange={(e) => setReason(e.target.value)}
        />
        {notice && !(!reason.trim()) && (
          <Alert title="Rejection not completed" tone="warning">
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
  isSelected = false,
  onSelectToggle,
  onDragStart,
}: {
  row: ApplicationRow;
  actions: ReactNode;
  isSelected?: boolean;
  onSelectToggle?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  return (
    <article
      className={`ats-record ${isSelected ? 'selected' : ''}`}
      draggable
      onDragStart={onDragStart}
      style={{ cursor: 'grab' }}
    >
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        {onSelectToggle && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelectToggle}
            className="ats-card-checkbox"
            style={{ marginTop: '4px' }}
            aria-label={`Select ${row.candidateName}`}
          />
        )}
        <div style={{ flex: 1 }}>
          <strong>{row.candidateName}</strong>
          <span>{row.jobTitle}</span>
        </div>
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
        {params.get('jobId') && (
          <RouterLink
            className="tvx-button tvx-button--secondary ml-auto"
            to={`/org/applications/compare?jobId=${params.get('jobId')}`}
          >
            Compare Candidates
          </RouterLink>
        )}
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);

  const [bulkAction, setBulkAction] = useState<'move' | 'reject' | 'assign' | 'tag' | 'archive' | null>(null);
  const [bulkStage, setBulkStage] = useState<string>('');
  const [bulkReason, setBulkReason] = useState<string>('');
  const [bulkCategory, setBulkCategory] = useState<string>('other');
  const [bulkTags, setBulkTags] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const bulkMutation = useBulkApplications();

  if (loading) return <LoadingState label="Loading pipeline" />;
  if (!rows.length) return <>{empty}</>;

  const stages = applicationStatuses.filter(
    (s) => rows.some((r) => r.status === s) || (counts[s] ?? 0) > 0,
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDragStart = (e: React.DragEvent, appId: string, status: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ appId, status }));
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggedOverStage(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { appId, status } = JSON.parse(dataStr);
      if (status === targetStatus) return;

      const idsToMove = selectedIds.includes(appId) ? selectedIds : [appId];

      if (targetStatus === 'rejected') {
        setSelectedIds(idsToMove);
        setBulkAction('reject');
        return;
      }

      await bulkMutation.mutateAsync({
        applicationIds: idsToMove,
        action: 'move-stage',
        payload: { status: targetStatus }
      });

      setSelectedIds([]);
    } catch (err) {
      console.error(err);
    }
  };

  const executeBulkAction = async () => {
    setNotice('');
    try {
      if (bulkAction === 'move') {
        if (!bulkStage) return;
        await bulkMutation.mutateAsync({
          applicationIds: selectedIds,
          action: 'move-stage',
          payload: { status: bulkStage }
        });
      } else if (bulkAction === 'reject') {
        if (!bulkReason.trim()) {
          setNotice('A rejection reason is required.');
          return;
        }
        await bulkMutation.mutateAsync({
          applicationIds: selectedIds,
          action: 'reject',
          payload: { reason: bulkReason, rejectionCategory: bulkCategory }
        });
      } else if (bulkAction === 'archive') {
        await bulkMutation.mutateAsync({
          applicationIds: selectedIds,
          action: 'archive'
        });
      } else if (bulkAction === 'tag') {
        const tagsList = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
        await bulkMutation.mutateAsync({
          applicationIds: selectedIds,
          action: 'add-tags',
          payload: { tags: tagsList }
        });
      }

      setSelectedIds([]);
      setBulkAction(null);
      setBulkStage('');
      setBulkReason('');
      setBulkCategory('other');
      setBulkTags('');
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <section aria-label="Pipeline board" className="ats-board-mode" style={{ position: 'relative' }}>
      <div className="ats-board-note">
        <p>
          Cards show the current result page. Column totals are company-wide, or
          job-wide when a job filter is active; other filters do not affect
          them.
        </p>
        <div className="ats-board">
          {stages.map((s) => (
            <section
              className={`ats-column ${draggedOverStage === s ? 'drag-over' : ''}`}
              key={s}
              aria-labelledby={`stage-${s}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedOverStage !== s) setDraggedOverStage(s);
              }}
              onDragLeave={() => setDraggedOverStage(null)}
              onDrop={(e) => handleDrop(e, s)}
            >
              <header>
                <h2 id={`stage-${s}`}>{labelStatus(s)}</h2>
                <Badge>
                  {counts[s] ?? rows.filter((r) => r.status === s).length} total
                </Badge>
              </header>

              {draggedOverStage === s && (
                <div className="ats-drop-indicator" aria-hidden="true" />
              )}

              {rows
                .filter((r) => r.status === s)
                .map((r) => (
                  <ApplicationCard
                    key={r.id}
                    row={r}
                    actions={actions(r)}
                    isSelected={selectedIds.includes(r.id)}
                    onSelectToggle={() => toggleSelect(r.id)}
                    onDragStart={(e) => handleDragStart(e, r.id, r.status)}
                  />
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

      {selectedIds.length > 0 && (
        <div className="ats-bulk-bar" style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 24px',
          background: 'var(--color-surface, #fff)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--color-border-subtle, rgba(0, 0, 0, 0.1))',
          borderRadius: '30px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          zIndex: 1000,
          transition: 'all 0.3s ease-in-out'
        }}>
          <span style={{ fontWeight: 600 }}>{selectedIds.length} selected</span>
          <Button size="compact" onClick={() => setBulkAction('move')}>Move Stage</Button>
          <Button size="compact" onClick={() => setBulkAction('reject')}>Reject</Button>
          <Button size="compact" onClick={() => setBulkAction('tag')}>Tag</Button>
          <Button size="compact" onClick={() => setBulkAction('archive')}>Archive</Button>
          <Button size="compact" variant="secondary" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      )}

      {bulkAction && (
        <Dialog
          open={!!bulkAction}
          onOpenChange={(v) => { if (!v) setBulkAction(null); }}
          title={`Bulk Action: ${bulkAction}`}
          description={`Apply ${bulkAction} operation to ${selectedIds.length} candidate(s).`}
          busy={bulkMutation.isPending}
          footer={
            <>
              <Button variant="secondary" onClick={() => setBulkAction(null)}>Cancel</Button>
              <Button onClick={executeBulkAction}>Confirm</Button>
            </>
          }
        >
          {notice && <Alert tone="danger">{notice}</Alert>}

          {bulkAction === 'move' && (
            <Select
              label="Select Target Stage"
              value={bulkStage}
              onChange={(e) => setBulkStage(e.target.value)}
              options={applicationStatuses.map(st => ({ value: st, label: labelStatus(st) }))}
              placeholder="-- Choose Stage --"
            />
          )}

          {bulkAction === 'reject' && (
            <div className="ats-dialog-fields">
              <Select
                label="Rejection Category"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                options={[
                  { value: 'other', label: 'Other' },
                  { value: 'skills-mismatch', label: 'Skills Mismatch' },
                  { value: 'salary-expectation', label: 'Salary Expectation' },
                  { value: 'culture-fit', label: 'Culture Fit' }
                ]}
              />
              <TextArea
                label="Rejection Reason"
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Provide details about the rejection..."
              />
            </div>
          )}

          {bulkAction === 'tag' && (
            <TextField
              label="Tags (comma-separated)"
              value={bulkTags}
              onChange={(e) => setBulkTags(e.target.value)}
              placeholder="e.g. backend, remote, fast-track"
            />
          )}

          {bulkAction === 'archive' && (
            <p>Are you sure you want to archive the selected candidates?</p>
          )}
        </Dialog>
      )}

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
const isSafeUrl = (url?: string) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

const GithubIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export function ApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('applications.view'));
  const q = useApplication(applicationId, Boolean(applicationId) && canView);
  const assignmentsQuery = useAssignments(`applicationId=${applicationId}&limit=10`, canView && Boolean(applicationId));
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const moveDirect = useMoveApplication(applicationId);
  const assignments = (assignmentsQuery.data?.items ?? []) as any[];
  const activeAssignment = assignments[0];
  const handleMoveToReview = async () => {
    try {
      await moveDirect.mutateAsync({ status: 'under-review' });
      setNotice(`Moved to Under Review successfully.`);
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
  const handleDecision = async (status: string, reason = '') => {
    try {
      await moveDirect.mutateAsync({ status: status as any, reason });
      setNotice(`Application moved to ${labelStatus(status)} successfully.`);
      await q.refetch();
      await assignmentsQuery.refetch();
    } catch (e) {
      setNotice(errorMessage(e));
    }
  };
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
          a.status !== 'unknown' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              {a.status === 'submitted' && (
                <>
                  <Button variant="primary" onClick={() => void handleMoveToReview()} loading={moveDirect.isPending}>
                    Move to Review
                  </Button>
                  <Button variant="secondary" onClick={() => setShortlistOpen(true)}>
                    Shortlist
                  </Button>
                  <Button variant="danger" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {a.status === 'under-review' && (
                <>
                  <Button variant="primary" onClick={() => setShortlistOpen(true)}>
                    Shortlist
                  </Button>
                  <Button variant="danger" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {a.status === 'shortlisted' && (
                <>
                  <RouterLink
                    className="tvx-button tvx-button--primary"
                    to={`/org/assessments/assignments/new?applicationId=${applicationId}`}
                  >
                    Assign Assessment
                  </RouterLink>
                  <Button variant="danger" onClick={() => setRejectOpen(true)}>
                    Reject
                  </Button>
                </>
              )}
              {!['submitted', 'under-review', 'shortlisted'].includes(a.status) && transitions[a.status]?.length > 0 && (
                <Button onClick={() => setOpen(true)}>Move to stage</Button>
              )}
            </div>
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
      <ShortlistCandidateDialog
        row={a}
        open={shortlistOpen}
        onOpenChange={setShortlistOpen}
        onAnnounce={setNotice}
      />
      <RejectCandidateDialog
        row={a}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onAnnounce={setNotice}
      />
      <div className="ats-detail-grid">
        <div className="ats-detail-primary">
          {/* Candidate Evaluation Summary Card */}
          <Card heading="Candidate Evaluation Summary" headingLevel={2}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', padding: '8px 0' }}>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Skill Match</small>
                <strong style={{ fontSize: '1.5rem', display: 'block', margin: '4px 0' }}>{a.matchScore}%</strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {a.skillMatchBreakdown.filter(s => s.required && s.score >= 30).length} / {a.skillMatchBreakdown.filter(s => s.required).length} required matched
                </span>
              </div>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Experience</small>
                <strong style={{ fontSize: '1.5rem', display: 'block', margin: '4px 0' }}>{a.experience.length}</strong>
                <span style={{ fontSize: '0.85rem' }}>{a.experience.filter(e => e.employmentType === 'internship').length} internships</span>
              </div>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Education</small>
                <strong style={{ fontSize: '1.5rem', display: 'block', margin: '4px 0' }}>{a.education.length ? a.education[0]?.degree : 'None'}</strong>
                <span style={{ fontSize: '0.85rem' }}>{a.education.length ? a.education[0]?.institution : 'No records'}</span>
              </div>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Projects & Certs</small>
                <strong style={{ fontSize: '1.5rem', display: 'block', margin: '4px 0' }}>{a.projects.length} / {a.certifications.length}</strong>
                <span style={{ fontSize: '0.85rem' }}>Projects / Certifications</span>
              </div>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Resume</small>
                <strong style={{ fontSize: '1.5rem', display: 'block', margin: '4px 0' }}>{a.resume ? 'Available' : 'None'}</strong>
                <span style={{ fontSize: '0.85rem' }}>{a.resume?.fileName ? 'Uploaded snapshot' : 'No upload'}</span>
              </div>
              <div>
                <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Online Presence</small>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                  <span style={{ color: a.socialLinks?.github ? 'var(--color-success-strong)' : 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>GitHub {a.socialLinks?.github ? '✓' : '×'}</span>
                  <span style={{ color: a.socialLinks?.linkedin ? 'var(--color-success-strong)' : 'var(--color-text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>LinkedIn {a.socialLinks?.linkedin ? '✓' : '×'}</span>
                </div>
              </div>
            </div>
          </Card>

          {activeAssignment && (
            <Card heading="Assessment & Evaluation" headingLevel={2}>
              <div className="space-y-4">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', padding: '8px 0' }}>
                  <div>
                    <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Assessment Title</small>
                    <strong style={{ fontSize: '1.2rem', display: 'block', margin: '4px 0' }}>{activeAssignment.title}</strong>
                  </div>
                  <div>
                    <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Status</small>
                    <strong style={{ fontSize: '1.2rem', display: 'block', margin: '4px 0' }}>
                      <StatusTag>
                        {activeAssignment.status}
                      </StatusTag>
                    </strong>
                  </div>
                  {activeAssignment.bestAttempt && (
                    <>
                      <div>
                        <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Overall Score</small>
                        <strong style={{ fontSize: '1.2rem', display: 'block', margin: '4px 0' }}>
                          {activeAssignment.bestPercentage}%
                        </strong>
                      </div>
                      <div>
                        <small style={{ color: 'var(--color-text-muted)', display: 'block' }}>Result</small>
                        <strong style={{ fontSize: '1.2rem', display: 'block', margin: '4px 0' }}>
                          {activeAssignment.passed ? 'Passed' : 'Failed'}
                        </strong>
                      </div>
                    </>
                  )}
                </div>

                {activeAssignment.bestAttempt && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-sm space-y-2 mt-2">
                    <h4 className="font-semibold">Attempt Score Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                      <div><strong>MCQ Score:</strong> {activeAssignment.bestAttempt.evaluation?.objectiveScore ?? 0} marks</div>
                      <div><strong>Coding Score:</strong> {activeAssignment.bestAttempt.evaluation?.codingScore ?? 0} marks</div>
                      <div><strong>Subjective Score:</strong> {activeAssignment.bestAttempt.evaluation?.subjectiveScore ?? 0} marks</div>
                      <div><strong>Total Score:</strong> {activeAssignment.bestAttempt.evaluation?.totalScore ?? 0} / {activeAssignment.totalMarks ?? 100} marks</div>
                    </div>
                    <div className="pt-2 flex gap-4">
                      <RouterLink
                        className="tvx-button tvx-button--secondary text-xs"
                        to={`/org/assessments/assignments/${activeAssignment.id}`}
                      >
                        View Assignment Dashboard
                      </RouterLink>
                      <RouterLink
                        className="tvx-button tvx-button--primary text-xs"
                        to={`/org/assessments/reviews/${activeAssignment.bestAttempt._id}`}
                      >
                        View Detailed Answer Review
                      </RouterLink>
                    </div>
                  </div>
                )}

                {/* Recruiter Post-Assessment Decisions */}
                {recruiter?.permissions.includes('applications.manage') && a.status === 'assessment-completed' && (
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                    <h4 className="font-semibold text-sm">Post-Assessment Candidate Triaging</h4>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="primary"
                        onClick={() => handleDecision('interview-scheduled', 'Post-assessment: Move to interview')}
                        loading={moveDirect.isPending}
                      >
                        Move to Interview
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleDecision('shortlisted', 'Post-assessment: Keep candidate shortlisted')}
                        loading={moveDirect.isPending}
                      >
                        Keep Under Review
                      </Button>
                      <RouterLink
                        className="tvx-button tvx-button--secondary"
                        to={`/org/assessments/assignments/new?applicationId=${applicationId}`}
                      >
                        Assign Another Assessment
                      </RouterLink>
                      <Button
                        variant="danger"
                        onClick={() => setRejectOpen(true)}
                        loading={moveDirect.isPending}
                      >
                        Reject Candidate
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Submitted Application Metadata and Answers */}
          <Card heading="Submitted Application" headingLevel={2}>
            <DescriptionList
              variant="horizontal"
              items={[
                { term: 'Candidate', description: a.candidateName },
                { term: 'Job snapshot', description: a.jobTitle },
                { term: 'Application', description: a.number },
                { term: 'Source', description: labelStatus(a.source) },
                { term: 'Submitted', description: formatDate(a.submittedAt) },
                { term: 'Deterministic skill match', description: `${a.matchScore}%` },
                {
                  term: 'Recruiter rating',
                  description: a.rating ? `${a.rating} of 5` : 'Not rated',
                },
                { term: 'Tags', description: a.tags.join(', ') || 'None' },
              ]}
            />
            {a.coverLetter && (
              <section style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-default)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Cover letter</h3>
                <p className="ats-preserve" style={{ fontSize: '0.95rem' }}>{a.coverLetter}</p>
              </section>
            )}
            {a.answers.length > 0 && (
              <section style={{ marginTop: '16px', borderTop: '1px solid var(--color-border-default)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Application answers</h3>
                {a.answers.map((x, i) => (
                  <div className="ats-answer" key={i} style={{ marginBottom: '12px' }}>
                    <strong style={{ display: 'block', fontSize: '0.9rem' }}>{x.question}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.95rem' }}>{x.answer}</p>
                  </div>
                ))}
              </section>
            )}
          </Card>

          {/* Resume Evidence */}
          <Card heading="Resume" headingLevel={2}>
            {a.resume ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileText size={24} style={{ color: 'var(--color-primary)' }} />
                  <div>
                    <strong style={{ display: 'block' }}>{a.resume.fileName}</strong>
                    <small style={{ color: 'var(--color-text-muted)' }}>Uploaded: {formatDate(a.resume.uploadedAt)}</small>
                  </div>
                </div>
                {a.resume.documentId ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={() => safeDownload(`/documents/manage/applications/${applicationId}/${a.resume?.documentId}/download`)}>
                      View Resume
                    </Button>
                    <Button variant="primary" onClick={() => safeDownload(`/documents/manage/applications/${applicationId}/${a.resume?.documentId}/download`)}>
                      <Download size={14} style={{ marginRight: '6px' }} /> Download
                    </Button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Secure reference token missing.</span>
                )}
              </div>
            ) : (
              <EmptyState title="No resume submitted" description="The candidate did not attach a resume to this application." />
            )}
          </Card>

          {/* Skill Match Evidence */}
          <Card
            heading="Skill Match"
            headingLevel={2}
            description="Skill Match is deterministic evidence calculated from the submitted candidate profile and the job/application snapshot. It is not an AI hiring decision."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: '4px solid var(--color-primary)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 'bold',
                fontSize: '1.5rem'
              }}>
                {a.matchScore}%
              </div>
              <div>
                <strong>{a.skillMatchBreakdown.filter(s => s.required && s.score >= 30).length} of {a.skillMatchBreakdown.filter(s => s.required).length} required skills matched</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                  Skill match is calculated deterministically from the submitted profile and the job/application snapshot when the candidate applied.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '6px', marginBottom: '10px' }}>Required Skills</h3>
                {a.skillMatchBreakdown.filter(s => s.required).length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {a.skillMatchBreakdown.filter(s => s.required).map((s) => {
                      const isMatched = s.score >= 30;
                      return (
                        <li key={s.skill} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
                          {isMatched ? <Check size={16} style={{ color: 'var(--color-success-strong)', marginTop: '2px' }} /> : <X size={16} style={{ color: 'var(--color-danger-strong)', marginTop: '2px' }} />}
                          <div>
                            <strong>{s.skill}</strong>
                            <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>
                              Candidate: {s.candidateProficiency || 'None'} ({s.candidateExperience} yrs) vs Min: {s.minimumProficiency || 'None'} ({s.minimumExperience} yrs)
                            </small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No required skills defined for this job.</p>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '6px', marginBottom: '10px' }}>Preferred Skills</h3>
                {a.skillMatchBreakdown.filter(s => !s.required).length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {a.skillMatchBreakdown.filter(s => !s.required).map((s) => {
                      const isMatched = s.score >= 30;
                      return (
                        <li key={s.skill} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', fontSize: '0.9rem' }}>
                          {isMatched ? <Check size={16} style={{ color: 'var(--color-success-strong)', marginTop: '2px' }} /> : <span style={{ width: '16px', display: 'inline-block' }} />}
                          <div>
                            <strong>{s.skill}</strong>
                            <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>
                              Candidate: {s.candidateProficiency || 'None'} ({s.candidateExperience} yrs) vs Min: {s.minimumProficiency || 'None'} ({s.minimumExperience} yrs)
                            </small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No preferred skills defined for this job.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Candidate Skills List */}
          <Card heading="Skills" headingLevel={2}>
            {a.skillsDetail && a.skillsDetail.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {a.skillsDetail.map((s) => (
                  <div key={s.name} style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-default)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.9rem' }}>
                    <strong>{s.name}</strong> <span style={{ color: 'var(--color-text-muted)' }}>({labelStatus(s.proficiency)} · {s.yearsOfExperience} yrs)</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No skills listed" description="The candidate has not listed any skills." />
            )}
          </Card>

          {/* Experience Section */}
          <Card heading="Experience" headingLevel={2}>
            {a.experience && a.experience.length > 0 ? (
              <div>
                {a.experience.map((exp, idx) => (
                  <div key={idx} style={{ borderBottom: idx === a.experience.length - 1 ? 'none' : '1px solid var(--color-border-default)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{exp.title}</h3>
                        <strong>{exp.company}</strong> {exp.employmentType && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>({labelStatus(exp.employmentType)})</span>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {exp.startDate ? new Date(exp.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : ''} – {exp.currentlyWorking ? 'Present' : exp.endDate ? new Date(exp.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : ''}
                        </span>
                        {exp.source === 'profile' && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-warning-strong)', fontWeight: 600 }}>
                            Fallback from live profile
                          </span>
                        )}
                      </div>
                    </div>
                    {exp.description && (
                      <p style={{ marginTop: '8px', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{exp.description}</p>
                    )}
                    {exp.skills && exp.skills.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {exp.skills.map(s => <span key={s} style={{ fontSize: '0.75rem', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border-default)', padding: '2px 6px', borderRadius: '2px' }}>{s}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No professional experience provided" description="No work history has been logged." />
            )}
          </Card>

          {/* Education Section */}
          <Card heading="Education" headingLevel={2}>
            {a.education && a.education.length > 0 ? (
              <div>
                {a.education.map((edu, idx) => (
                  <div key={idx} style={{ borderBottom: idx === a.education.length - 1 ? 'none' : '1px solid var(--color-border-default)', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{edu.degree}</h3>
                        <strong>{edu.institution}</strong> {edu.fieldOfStudy && <span style={{ color: 'var(--color-text-muted)' }}>· {edu.fieldOfStudy}</span>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                          {edu.startYear} – {edu.endYear || 'Present'}
                        </span>
                        {edu.source === 'profile' && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-warning-strong)', fontWeight: 600 }}>
                            Fallback from live profile
                          </span>
                        )}
                      </div>
                    </div>
                    {edu.grade && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                        <strong>Grade:</strong> {edu.grade}
                      </p>
                    )}
                    {edu.description && (
                      <p style={{ marginTop: '8px', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{edu.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No education information provided" description="No academic history has been logged." />
            )}
          </Card>

          {/* Projects Section */}
          <Card heading="Projects" headingLevel={2}>
            {a.projects && a.projects.length > 0 ? (
              <div>
                {a.projects.map((proj, idx) => {
                  const safeGithub = isSafeUrl(proj.githubUrl) ? proj.githubUrl : undefined;
                  const safeLive = isSafeUrl(proj.liveUrl) ? proj.liveUrl : undefined;
                  return (
                    <div key={idx} style={{ borderBottom: idx === a.projects.length - 1 ? 'none' : '1px solid var(--color-border-default)', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{proj.title}</h3>
                        </div>
                        {proj.source === 'profile' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-strong)', fontWeight: 600 }}>
                            Fallback from live profile
                          </span>
                        )}
                      </div>
                      {proj.description && (
                        <p style={{ marginTop: '8px', fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{proj.description}</p>
                      )}
                      {proj.technologies && proj.technologies.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {proj.technologies.map(t => <span key={t} style={{ fontSize: '0.75rem', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border-default)', padding: '2px 6px', borderRadius: '2px' }}>{t}</span>)}
                        </div>
                      )}
                      <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                        {safeGithub && (
                          <a href={safeGithub} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                            <GithubIcon size={14} /> GitHub <ExternalLink size={12} />
                          </a>
                        )}
                        {safeLive && (
                          <a href={safeLive} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                            <Globe size={14} /> Live Demo <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No projects provided" description="No personal or professional projects listed." />
            )}
          </Card>

          {/* Certifications Section */}
          <Card heading="Certifications" headingLevel={2}>
            {a.certifications && a.certifications.length > 0 ? (
              <div>
                {a.certifications.map((cert, idx) => {
                  const safeCredUrl = isSafeUrl(cert.credentialUrl) ? cert.credentialUrl : undefined;
                  return (
                    <div key={idx} style={{ borderBottom: idx === a.certifications.length - 1 ? 'none' : '1px solid var(--color-border-default)', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{cert.name}</h3>
                          <strong>{cert.issuingOrganization}</strong>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                            Issued: {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '—'}
                          </span>
                          {cert.source === 'profile' && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-warning-strong)', fontWeight: 600 }}>
                              Fallback from live profile
                            </span>
                          )}
                        </div>
                      </div>
                      {cert.credentialId && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                          <strong>Credential ID:</strong> {cert.credentialId}
                        </p>
                      )}
                      {safeCredUrl && (
                        <div style={{ marginTop: '8px' }}>
                          <a href={safeCredUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                            View Credential <ExternalLink size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No certifications provided" description="No credentials or licenses listed." />
            )}
          </Card>

          {/* Online Presence */}
          <Card heading="Online Presence" headingLevel={2}>
            {a.socialLinks ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                    GitHub Link {a.socialLinks.source === 'profile' && <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-strong)' }}>(profile fallback)</span>}
                  </h3>
                  {isSafeUrl(a.socialLinks.github) ? (
                    <a href={a.socialLinks.github} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '12px', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-default)', borderRadius: '4px' }}>
                      <GithubIcon size={18} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: 600 }}>Open GitHub Profile</span>
                      <ExternalLink size={14} style={{ marginLeft: 'auto' }} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No GitHub profile provided.</span>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                    LinkedIn Link {a.socialLinks.source === 'profile' && <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-strong)' }}>(profile fallback)</span>}
                  </h3>
                  {isSafeUrl(a.socialLinks.linkedin) ? (
                    <a href={a.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '12px', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-default)', borderRadius: '4px' }}>
                      <LinkedinIcon size={18} />
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: 600 }}>Open LinkedIn Profile</span>
                      <ExternalLink size={14} style={{ marginLeft: 'auto' }} />
                    </a>
                  ) : (
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No LinkedIn profile provided.</span>
                  )}
                </div>

                {a.socialLinks.portfolio && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>
                      Portfolio Link {a.socialLinks.source === 'profile' && <span style={{ fontSize: '0.75rem', color: 'var(--color-warning-strong)' }}>(profile fallback)</span>}
                    </h3>
                    {isSafeUrl(a.socialLinks.portfolio) ? (
                      <a href={a.socialLinks.portfolio} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '12px', background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-default)', borderRadius: '4px' }}>
                        <Globe size={18} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '0.9rem', fontWeight: 600 }}>{a.socialLinks.portfolio}</span>
                        <ExternalLink size={14} style={{ marginLeft: 'auto' }} />
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No portfolio provided.</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>GitHub Link</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No GitHub profile provided.</span>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-text-muted)' }}>LinkedIn Link</h3>
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>No LinkedIn profile provided.</span>
                </div>
              </div>
            )}
          </Card>

          <ApplicationCommentsSection applicationId={applicationId} />
        </div>
        <ApplicationTimelineSection applicationId={applicationId} />
      </div>
    </div>
  );
}

function ApplicationCommentsSection({ applicationId }: { applicationId: string }) {
  const commentsQuery = useApplicationComments(applicationId);
  const addCommentMutation = useAddApplicationComment(applicationId);
  const deleteCommentMutation = useDeleteApplicationComment(applicationId);

  const [content, setContent] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  if (commentsQuery.isLoading) return <LoadingState label="Loading comments" />;
  const comments = commentsQuery.data ?? [];

  const parentComments = comments.filter((c) => !c.parentId);
  const repliesGrouped: Record<string, CommentItem[]> = {};
  comments.forEach((curr) => {
    if (curr.parentId) {
      const pid = curr.parentId;
      if (!repliesGrouped[pid]) repliesGrouped[pid] = [];
      repliesGrouped[pid].push(curr);
    }
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await addCommentMutation.mutateAsync({ content: content.trim() });
      setContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    try {
      await addCommentMutation.mutateAsync({ content: replyContent.trim(), parentId });
      setReplyContent('');
      setReplyToId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await deleteCommentMutation.mutateAsync(commentId);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Card heading="Internal Recruiter Comments" headingLevel={2}>
      <form onSubmit={handleAddComment} style={{ display: 'grid', gap: '8px', marginBottom: '24px' }}>
        <TextArea
          label="Leave a comment"
          placeholder="Use @username to mention team members..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" size="compact" disabled={addCommentMutation.isPending}>
            Post Comment
          </Button>
        </div>
      </form>

      <div style={{ display: 'grid', gap: '16px' }}>
        {parentComments.map((pc) => (
          <div key={pc._id} style={{ borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.05))', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <strong>{pc.author?.fullName}</strong>{' '}
                <small style={{ color: 'var(--color-text-secondary)' }}>{pc.author?.email}</small>
                <p style={{ margin: '8px 0 4px 0' }}>{pc.content}</p>
                <small style={{ color: 'var(--color-text-secondary)' }}>{formatDate(pc.createdAt)}</small>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button size="compact" variant="quiet" onClick={() => setReplyToId(pc._id)}>Reply</Button>
                <Button size="compact" variant="quiet" onClick={() => handleDelete(pc._id)}>Delete</Button>
              </div>
            </div>

            {repliesGrouped[pc._id]?.map((reply) => (
              <div key={reply._id} style={{ marginLeft: '24px', marginTop: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--color-border-subtle, rgba(0,0,0,0.08))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{reply.author?.fullName}</strong>{' '}
                    <small style={{ color: 'var(--color-text-secondary)' }}>{reply.author?.email}</small>
                    <p style={{ margin: '4px 0' }}>{reply.content}</p>
                    <small style={{ color: 'var(--color-text-secondary)' }}>{formatDate(reply.createdAt)}</small>
                  </div>
                  <Button size="compact" variant="quiet" onClick={() => handleDelete(reply._id)}>Delete</Button>
                </div>
              </div>
            ))}

            {replyToId === pc._id && (
              <div style={{ marginLeft: '24px', marginTop: '12px', display: 'grid', gap: '8px' }}>
                <TextArea
                  label="Reply to comment"
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <Button size="compact" variant="secondary" onClick={() => setReplyToId(null)}>Cancel</Button>
                  <Button size="compact" onClick={() => handleAddReply(pc._id)}>Post Reply</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ApplicationTimelineSection({ applicationId }: { applicationId: string }) {
  const timelineQuery = useApplicationTimeline(applicationId);
  const addNoteMutation = useAddApplicationNote(applicationId);
  const deleteNoteMutation = useDeleteApplicationNote(applicationId);
  const updateNoteMutation = useUpdateApplicationNote(applicationId);

  const [noteContent, setNoteContent] = useState('');
  const [notePrivate, setNotePrivate] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  if (timelineQuery.isLoading) return <LoadingState label="Loading timeline" />;
  const timeline = timelineQuery.data ?? [];

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      await addNoteMutation.mutateAsync({ note: noteContent.trim(), isPrivate: notePrivate });
      setNoteContent('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <aside className="ats-evidence-rail" aria-labelledby="ats-timeline-title" style={{ width: '100%', position: 'static' }}>
      <h2 id="ats-timeline-title" style={{ marginBottom: '16px' }}>Evidence trail</h2>

      <form onSubmit={handleAddNote} style={{ display: 'grid', gap: '8px', marginBottom: '24px', padding: '16px', background: 'var(--color-surface, #fff)', borderRadius: '8px', border: '1px solid var(--color-border-subtle, #eee)' }}>
        <TextArea
          label="Leave a recruiter note"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="Keep tracking notes about this candidate..."
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notePrivate}
              onChange={(e) => setNotePrivate(e.target.checked)}
            />
            <span>Private note</span>
          </label>
          <Button type="submit" size="compact" disabled={addNoteMutation.isPending}>Add Note</Button>
        </div>
      </form>

      <ol style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '16px' }}>
        {timeline.map((item, index) => (
          <li key={index} style={{ padding: '12px', background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border-subtle, #eee)', borderRadius: '8px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
                {item.type.replace('_', ' ')}
              </span>
              <time style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{formatDate(item.timestamp)}</time>
            </div>

            {item.type === 'status_change' && (
              <p style={{ margin: '8px 0 0 0' }}>
                Changed stage from <strong>{labelStatus(item.from || '')}</strong> to <strong>{labelStatus(item.to || '')}</strong>
                {item.reason && <span style={{ display: 'block', fontStyle: 'italic', fontSize: '13px', marginTop: '4px' }}>Reason: "{item.reason}"</span>}
              </p>
            )}

            {item.type === 'note' && (
              <div style={{ marginTop: '8px' }}>
                {editingNoteId === item.id ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <TextArea
                      label="Edit note"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button size="compact" variant="secondary" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                      <Button size="compact" onClick={async () => {
                        const nid = item.id;
                        if (nid && editingContent.trim()) {
                          await updateNoteMutation.mutateAsync({ noteId: nid, body: { note: editingContent.trim() } });
                          setEditingNoteId(null);
                        }
                      }}>Save</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0 }}>{item.content}</p>
                    {item.isPrivate && <span style={{ display: 'inline-block', marginTop: '4px' }}><Badge>Private</Badge></span>}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <Button size="compact" variant="quiet" onClick={() => { if (item.id) { setEditingNoteId(item.id); setEditingContent(item.content || ''); } }}>Edit</Button>
                      <Button size="compact" variant="quiet" onClick={async () => {
                        if (item.id && window.confirm('Are you sure you want to delete this note?')) {
                          await deleteNoteMutation.mutateAsync(item.id);
                        }
                      }}>Delete</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {item.type === 'comment' && (
              <p style={{ margin: '8px 0 0 0' }}>
                Comment: "{item.content}"
              </p>
            )}

            {item.type === 'audit_event' && (
              <p style={{ margin: '8px 0 0 0' }}>
                Action: <strong>{item.action}</strong>
              </p>
            )}

            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
              By {item.actor?.fullName || 'System'}
            </div>
          </li>
        ))}
      </ol>
    </aside>
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

export function CandidateComparisonPage() {
  const [params] = useSearchParams();
  const jobId = params.get('jobId') || '';
  const query = useCandidateComparison(jobId, Boolean(jobId));

  const rows = query.data ?? [];

  return (
    <div className="ats-page">
      <AtsHeader
        title="Candidate Comparison Matrix"
        description="Compare candidate screening scores, experience, and assessment outcomes for this job opening."
      />
      {query.isLoading ? (
        <LoadingState label="Loading candidate comparison" />
      ) : query.isError ? (
        <ErrorState
          detail={query.error instanceof Error ? query.error.message : 'Could not fetch candidate comparisons.'}
          retry={() => void query.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No candidates to compare"
          description="There are no active candidate applications for this job vacancy yet."
        />
      ) : (
        <Card heading="Side-by-Side Candidates Comparison" headingLevel={2}>
          <DataTable
            rows={rows}
            rowKey={(r) => r.applicationId}
            columns={[
              {
                id: 'candidateName',
                header: 'Candidate',
                render: (r) => (
                  <RouterLink to={`/org/applications/${r.applicationId}`} className="tvx-link font-semibold text-primary">
                    {r.candidateName}
                  </RouterLink>
                ),
              },
              {
                id: 'skillMatch',
                header: 'Skill Match Score',
                render: (r) => `${r.skillMatchScore}%`,
              },
              {
                id: 'experienceYears',
                header: 'Experience',
                render: (r) => `${r.experienceYears} Year${r.experienceYears !== 1 ? 's' : ''}`,
              },
              {
                id: 'assessmentScore',
                header: 'Assessment Percentage',
                render: (r) => r.assessmentScore !== null ? `${r.assessmentScore}%` : 'N/A',
              },
              {
                id: 'mcqScore',
                header: 'MCQ Score',
                render: (r) => r.mcqScore !== null ? `${r.mcqScore}%` : 'N/A',
              },
              {
                id: 'codingScore',
                header: 'Coding Score',
                render: (r) => r.codingScore !== null ? `${r.codingScore}%` : 'N/A',
              },
              {
                id: 'currentStage',
                header: 'Current Stage',
                render: (r) => (
                  <StatusTag tone={r.currentStage === 'rejected' ? 'danger' : 'info'}>
                    {r.currentStage.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </StatusTag>
                ),
              },
              {
                id: 'actions',
                header: 'Action',
                render: (r) => (
                  <RouterLink
                    className="tvx-button tvx-button--secondary text-xs py-1 px-2"
                    to={`/org/applications/${r.applicationId}`}
                  >
                    View Pipeline Details
                  </RouterLink>
                ),
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
