import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  useNavigate,
  useBlocker,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError, apiRequest } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  ErrorSummary,
  FilteredEmptyState,
  Form,
  FormActions,
  FormSection,
  LoadingState,
  MetricCard,
  PageHeader,
  PermissionState,
  PendingApprovalState,
  SuspendedState,
  SearchField,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
  UnverifiedCompanyState,
} from '../../design-system';
import {
  allowedActions,
  emptyDraft,
  employmentTypes,
  jobStatuses,
  statusMeta,
  toDraft,
  type JobDraft,
  type JobView,
  workModes,
} from './model';
import { useJobAction, useManagedJob, useManagedJobs, useSaveJob, useCloneJob } from './api';
import {
  Briefcase,
  CheckCircle2,
  FileEdit,
  Clock,
  Archive,
  Plus,
  Search,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
  Building2,
  Sparkles,
  Eye,
  Copy,
  Send,
  Pause,
  Play,
  XCircle,
} from 'lucide-react';
import './job-management.css';
const label = (s: string) =>
  s.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function JobTabs({ canCreate = true }: { canCreate?: boolean }) {
  return (
    <div className="job-nav-tabs-wrapper">
      <nav className="job-nav-tabs" aria-label="Job sections">
        <NavLink
          to="/org/jobs"
          end
          className={({ isActive }) => `job-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Briefcase size={15} />
          <span>All Jobs</span>
        </NavLink>
        {canCreate && (
          <NavLink
            to="/org/jobs/new"
            className={({ isActive }) => `job-nav-tab job-nav-tab--create ${isActive ? 'active' : ''}`}
          >
            <Plus size={15} />
            <span>Create job</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}
function useAccess() {
  const { user, recruiter } = useAuth();
  const p = recruiter?.permissions ?? [];
  const verification = recruiter?.company?.verificationStatus ?? 'pending';
  const companyState = !recruiter?.isApproved
    ? 'approval-pending'
    : recruiter?.company?.isActive === false
      ? 'inactive'
      : verification === 'suspended'
        ? 'suspended'
        : verification === 'rejected'
          ? 'rejected'
          : verification === 'verified'
            ? 'verified'
            : 'unverified';
  const blocked = [
    'approval-pending',
    'inactive',
    'suspended',
    'rejected',
  ].includes(companyState);
  return {
    user,
    recruiter,
    p,
    blocked,
    companyState,
    verified: recruiter?.company?.verificationStatus === 'verified',
    has: (x: string) => p.includes(x),
  };
}
function Block() {
  const a = useAccess();
  if (a.companyState === 'approval-pending')
    return (
      <PendingApprovalState
        title="Recruiter approval pending"
        description="Job management becomes available after your membership is approved."
      />
    );
  if (a.companyState === 'suspended')
    return (
      <SuspendedState
        title="Company suspended"
        description="Job management is read-only while this company is suspended."
      />
    );
  if (a.companyState === 'rejected')
    return (
      <PermissionState
        title="Company verification rejected"
        description="Job mutations are unavailable. Contact an administrator before continuing."
      />
    );
  if (a.companyState === 'inactive')
    return (
      <PermissionState
        title="Company inactive"
        description="This company is inactive, so job management is unavailable."
      />
    );
  return null;
}
function Status({ job }: { job: JobView }) {
  const [name, tone] = statusMeta(job.status);
  return <StatusTag tone={tone}>{name}</StatusTag>;
}
function JobRowActions({
  job,
  permissions,
  verified,
}: {
  job: JobView;
  permissions: string[];
  verified: boolean;
}) {
  const mutation = useJobAction(job.id);
  const cloneMutation = useCloneJob();
  const navigate = useNavigate();
  const [action, setAction] = useState<
    null | 'submit' | 'pause' | 'resume' | 'close' | 'archive'
  >(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = allowedActions(job.status, permissions, verified);
  const choices = (
    ['submit', 'pause', 'resume', 'close', 'archive'] as const
  ).filter((x) => allowed[x]);
  const hasCreatePermission = permissions.includes('jobs.create');

  const getActionIcon = (actName: string) => {
    switch (actName) {
      case 'submit':
        return <Send size={13} />;
      case 'pause':
        return <Pause size={13} />;
      case 'resume':
        return <Play size={13} />;
      case 'close':
        return <XCircle size={13} />;
      case 'archive':
        return <Archive size={13} />;
      default:
        return null;
    }
  };

  return (
    <div className="job-actions">
      {error && (
        <Alert tone="danger" title="Action failed">
          {error}
        </Alert>
      )}
      <Link
        className="job-action-btn job-action-btn--details"
        to={`/org/jobs/${job.id}`}
      >
        <Eye size={13} />
        <span>Details</span>
      </Link>
      {hasCreatePermission && (
        <button
          type="button"
          className="job-action-btn job-action-btn--clone"
          disabled={cloneMutation.isPending}
          onClick={async () => {
            try {
              setError(null);
              const result = await cloneMutation.mutateAsync(job.id);
              if (result && typeof result === 'object' && 'job' in result) {
                const newJob = (result as { job: { _id: string } }).job;
                navigate(`/org/jobs/${newJob._id}/edit`);
              }
            } catch (err) {
              setError((err as Error)?.message ?? 'Cloning failed');
            }
          }}
        >
          <Copy size={13} />
          <span>{cloneMutation.isPending ? 'Cloning...' : 'Clone'}</span>
        </button>
      )}
      {choices.map((x) => (
        <button
          key={x}
          type="button"
          className={`job-action-btn job-action-btn--${x}`}
          disabled={mutation.isPending}
          onClick={() => setAction(x)}
        >
          {getActionIcon(x)}
          <span>{label(x)}</span>
        </button>
      ))}
      {action && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={`${label(action)} job?`}
          description="This updates the job lifecycle immediately."
          confirmLabel={label(action)}
          variant={action === 'archive' ? 'destructive' : 'default'}
          onConfirm={async () => {
            try {
              setError(null);
              await mutation.mutateAsync(action);
              setAction(null);
            } catch (reason) {
              setAction(null);
              setError(
                reason instanceof ApiError && reason.status === 409
                  ? 'This job changed. Open details and reload before retrying.'
                  : reason instanceof Error
                    ? reason.message
                    : 'The action could not be completed.',
              );
            }
          }}
        />
      )}
    </div>
  );
}
function formatDateParts(dateStr?: string) {
  if (!dateStr) return { date: 'No deadline', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: 'No deadline', time: '' };
    const dateFormatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
    return { date: `Closes ${dateFormatted}`, time: '' };
  } catch {
    return { date: 'No deadline', time: '' };
  }
}

export function ManagedJobsPage() {
  const a = useAccess();
  const [sp, setSp] = useSearchParams();
  const rawPage = Number(sp.get('page'));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const q = (sp.get('q') ?? '').trim().slice(0, 100);
  const status = jobStatuses.includes((sp.get('status') ?? '') as never)
    ? (sp.get('status') ?? '')
    : '';
  const employment = employmentTypes.includes((sp.get('employment') ?? '') as never)
    ? (sp.get('employment') ?? '')
    : '';
  const workMode = workModes.includes((sp.get('workMode') ?? '') as never)
    ? (sp.get('workMode') ?? '')
    : '';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const query = useManagedJobs(page, q, a.has('jobs.update') && !a.blocked);

  const allJobs = (query.data?.jobs ?? []) as JobView[];
  const rows = useMemo(
    () =>
      allJobs.filter(
        (j) =>
          (!status || j.status === status) &&
          (!employment || j.employmentType === employment) &&
          (!workMode || j.workMode === workMode),
      ),
    [allJobs, status, employment, workMode],
  );

  const totalJobs = query.data?.pagination.total ?? allJobs.length;
  const totalPages = query.data?.pagination.pages ?? 1;

  // Metric card statistics from loaded jobs
  const openCount = allJobs.filter((j) => j.status === 'open' || j.status === 'published').length;
  const draftCount = allJobs.filter((j) => j.status === 'draft').length;
  const pausedCount = allJobs.filter((j) => j.status === 'paused').length;
  const closedCount = allJobs.filter((j) => j.status === 'closed' || j.status === 'archived').length;

  const limit = 10;
  const startIdx = totalJobs === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalJobs);

  const update = (values: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(values).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    n.set('page', '1');
    setSp(n);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(rows.map((j) => j.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handlePageChange = (newPage: number) => {
    const n = new URLSearchParams(sp);
    n.set('page', String(newPage));
    setSp(n);
  };

  const handleClearFilters = () => {
    setSp(new URLSearchParams());
    setSelectedIds(new Set());
  };

  const isFiltered = Boolean(q || status || employment || workMode);

  if (!a.has('jobs.update')) {
    return (
      <PermissionState description="The jobs.update permission is required to view managed jobs." />
    );
  }
  if (a.blocked) return <Block />;

  return (
    <div className="jobs-page">
      {/* Header & Sub-Navigation Pill Tabs */}
      <PageHeader
        title="Jobs"
        description="Create, review, and move open roles through the hiring lifecycle."
        secondaryActions={<JobTabs canCreate={a.has('jobs.create')} />}
      />

      {/* 5 Metrics Summary Cards */}
      <div className="job-metrics-grid">
        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <Briefcase size={20} />
            </div>
            <span className="job-metric-badge job-metric-badge--success">
              • Configured
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">Total Managed Jobs</span>
            <strong className="job-metric-card__val">{totalJobs}</strong>
            <span className="job-metric-card__sub">Across organization</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <CheckCircle2 size={20} />
            </div>
            <span className="job-metric-badge job-metric-badge--success">
              • Active
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">Published & Open</span>
            <strong className="job-metric-card__val" style={{ color: '#059669' }}>
              {openCount}
            </strong>
            <span className="job-metric-card__sub">Accepting applications</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <FileEdit size={20} />
            </div>
            <span className="job-metric-badge job-metric-badge--warning">
              • In Progress
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">Draft Roles</span>
            <strong className="job-metric-card__val" style={{ color: '#d97706' }}>
              {draftCount}
            </strong>
            <span className="job-metric-card__sub">Under composition</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <Clock size={20} />
            </div>
            <span className="job-metric-badge job-metric-badge--info">
              • Paused
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">On Hold</span>
            <strong className="job-metric-card__val" style={{ color: '#0284c7' }}>
              {pausedCount}
            </strong>
            <span className="job-metric-card__sub">Temporarily paused</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <Archive size={20} />
            </div>
            <span className="job-metric-badge job-metric-badge--neutral">
              • Retired
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">Closed & Archived</span>
            <strong className="job-metric-card__val" style={{ color: '#475569' }}>
              {closedCount}
            </strong>
            <span className="job-metric-card__sub">Fulfilled / inactive</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="job-modern-toolbar">
        <div className="job-toolbar-filters">
          <div className="job-filter-group">
            <span className="job-filter-label">Search</span>
            <div className="job-search-container">
              <Search className="job-search-icon" size={16} />
              <input
                type="text"
                className="job-search-input"
                placeholder="Search jobs by title, location..."
                value={q}
                onChange={(e) => update({ q: e.target.value })}
              />
              {q && (
                <button
                  type="button"
                  className="job-search-clear"
                  onClick={() => update({ q: '' })}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="job-filter-group">
            <span className="job-filter-label">Status</span>
            <select
              className="job-pill-select"
              aria-label="Status — current page"
              value={status}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="">All status</option>
              {jobStatuses.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="job-filter-group">
            <span className="job-filter-label">Employment</span>
            <select
              className="job-pill-select"
              aria-label="Employment — current page"
              value={employment}
              onChange={(e) => update({ employment: e.target.value })}
            >
              <option value="">All employment</option>
              {employmentTypes.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="job-filter-group">
            <span className="job-filter-label">Work Mode</span>
            <select
              className="job-pill-select"
              aria-label="Work mode — current page"
              value={workMode}
              onChange={(e) => update({ workMode: e.target.value })}
            >
              <option value="">All work modes</option>
              {workModes.map((v) => (
                <option key={v} value={v}>
                  {label(v)}
                </option>
              ))}
            </select>
          </div>

          {isFiltered && (
            <button
              type="button"
              className="tvx-button tvx-button--secondary text-xs"
              style={{ borderRadius: '9999px', height: '42px', padding: '0 16px' }}
              onClick={handleClearFilters}
            >
              <RotateCcw size={14} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Modern Data Table Card */}
      <div className="job-table-card">
        {query.isLoading ? (
          <div className="p-12">
            <LoadingState label="Loading jobs" />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <ErrorState
              detail={(query.error as Error).message}
              retry={() => void query.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8">
            {isFiltered ? (
              <FilteredEmptyState
                title="No matching jobs"
                description="No jobs on this page match the current filters."
                onClear={handleClearFilters}
              />
            ) : (
              <EmptyState
                title="No jobs yet"
                description="Create the first job to begin recruiting."
                action={
                  a.has('jobs.create') ? (
                    <Link className="job-btn-black" to="/org/jobs/new">
                      <Plus size={16} />
                      Create Job
                    </Link>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : (
          <>
            <div className="job-table-wrapper">
              <table className="job-modern-table" aria-label="Managed jobs table">
                <thead>
                  <tr>
                    <th scope="col" className="job-checkbox-cell">
                      <input
                        type="checkbox"
                        className="job-custom-checkbox"
                        aria-label="Select all jobs"
                        checked={rows.length > 0 && selectedIds.size === rows.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col">Role & Location</th>
                    <th scope="col">Status</th>
                    <th scope="col">Setup & Openings</th>
                    <th scope="col">Apps & Views</th>
                    <th scope="col">Deadline</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => {
                    const isSelected = selectedIds.has(j.id);
                    const dt = formatDateParts(j.deadline);
                    const shortCode = `#JOB-${j.id.slice(-6).toUpperCase()}`;

                    return (
                      <tr key={j.id} className={isSelected ? 'is-selected' : undefined}>
                        <td className="job-checkbox-cell">
                          <input
                            type="checkbox"
                            className="job-custom-checkbox"
                            aria-label={`Select ${j.title}`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(j.id)}
                          />
                        </td>
                        <td>
                          <div className="job-entity-cell">
                            <div className="job-entity-icon">
                              <Briefcase size={18} />
                            </div>
                            <div className="job-entity-info">
                              <div className="job-entity-title-row">
                                <Link
                                  to={`/org/jobs/${j.id}`}
                                  className="job-entity-title"
                                >
                                  {j.title}
                                </Link>
                                <span className="job-code-badge">{shortCode}</span>
                              </div>
                              <span className="job-entity-meta">
                                <span>{j.location}</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`job-status-pill job-status-pill--${
                              j.status === 'open' || j.status === 'published'
                                ? 'published'
                                : j.status === 'draft'
                                ? 'draft'
                                : j.status === 'paused'
                                ? 'paused'
                                : 'closed'
                            }`}
                          >
                            <span className="job-status-dot" />
                            {label(j.status)}
                          </span>
                        </td>
                        <td>
                          <div className="job-setup-cell">
                            <span className="job-setup-type">{label(j.employmentType)}</span>
                            <span className="job-setup-mode">{label(j.workMode)}</span>
                            <span className="job-setup-openings">{j.openings} {j.openings === 1 ? 'opening' : 'openings'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="job-stats-cell">
                            <span className="job-stat-pill job-stat-pill--apps" title="Applications count">
                              <Users size={12} />
                              <span>{j.applicationsCount} apps</span>
                            </span>
                            <span className="job-stat-pill job-stat-pill--views" title="Views count">
                              <Eye size={12} />
                              <span>{j.viewsCount} views</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="job-date-cell">
                            <span className="job-date-main">{dt.date}</span>
                          </div>
                        </td>
                        <td>
                          <JobRowActions job={j} permissions={a.p} verified={a.verified} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Accessible Narrow Layout for Mobile view ports */}
            <div className="sm:hidden p-4 space-y-3 border-t border-slate-100">
              {rows.map((j) => (
                <div key={`narrow-${j.id}`} className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="font-semibold text-slate-900 mb-1">
                    <Link to={`/org/jobs/${j.id}`} className="hover:underline">
                      {j.title}
                    </Link>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">
                    {j.location} · {label(j.employmentType)} · {label(j.workMode)}
                  </div>
                  <div className="text-xs text-slate-600 mb-3">
                    {j.openings} openings · {j.applicationsCount} applications · {j.viewsCount} views
                  </div>
                  <JobRowActions job={j} permissions={a.p} verified={a.verified} />
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="job-pagination-footer">
              <span className="job-pagination-info">
                Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of{' '}
                <strong>{totalJobs}</strong> jobs
              </span>
              {totalPages > 1 && (
                <div className="job-pagination-controls">
                  <button
                    type="button"
                    className="job-page-btn"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
                    <button
                      key={pNum}
                      type="button"
                      className={`job-page-btn ${pNum === page ? 'job-page-btn--active' : ''}`}
                      onClick={() => handlePageChange(pNum)}
                    >
                      {pNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="job-page-btn"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function JobDetailsPage() {
  const { jobId = '' } = useParams();
  const a = useAccess();
  const q = useManagedJob(jobId, a.has('jobs.update') && !a.blocked);
  const m = useJobAction(jobId);
  const cloneMutation = useCloneJob();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<
    null | 'submit' | 'pause' | 'resume' | 'close' | 'archive'
  >(null);
  const [actionError, setActionError] = useState<{
    message: string;
    stale: boolean;
  } | null>(null);
  if (!a.has('jobs.update')) return <PermissionState />;
  if (a.blocked) return <Block />;
  if (q.isLoading) return <LoadingState label="Loading job" />;
  if (q.isError || !q.data)
    return (
      <ErrorState
        detail={(q.error as Error)?.message ?? 'Job not found'}
        retry={() => void q.refetch()}
      />
    );
  const j = q.data,
    actions = allowedActions(j.status, a.p, a.verified);
  return (
    <main className="jobs-page">
      <PageHeader
        title={j.title}
        eyebrow={<Status job={j} />}
        description={`${label(j.employmentType)} · ${label(j.workMode)} · ${j.location}`}
        primaryAction={
          actions.edit ? (
            <Link
              className="tvx-button tvx-button--primary tvx-button--md"
              to={`/org/jobs/${j.id}/edit`}
            >
              Edit job
            </Link>
          ) : undefined
        }
        secondaryActions={
          <div className="job-actions">
            {a.p.includes('jobs.create') && (
              <Button
                variant="secondary"
                disabled={cloneMutation.isPending}
                onClick={async () => {
                  try {
                    setActionError(null);
                    const result = await cloneMutation.mutateAsync(j.id);
                    if (result && typeof result === 'object' && 'job' in result) {
                      const newJob = (result as { job: { _id: string } }).job;
                      navigate(`/org/jobs/${newJob._id}/edit`);
                    }
                  } catch (err) {
                    setActionError({
                      message: (err as Error)?.message ?? 'Cloning failed',
                      stale: false,
                    });
                  }
                }}
              >
                {cloneMutation.isPending ? 'Cloning...' : 'Clone job'}
              </Button>
            )}
            {(['submit', 'pause', 'resume', 'close', 'archive'] as const)
              .filter((x) => actions[x])
              .map((x) => (
                <Button
                  key={x}
                  variant={x === 'archive' ? 'danger' : 'secondary'}
                  onClick={() => setConfirm(x)}
                >
                  {label(x)}
                </Button>
              ))}
          </div>
        }
      />
      {!a.verified && (j.status === 'draft' || j.status === 'paused') && (
        <UnverifiedCompanyState description="Verification is required before submitting or resuming this job." />
      )}
      {actionError && (
        <Alert
          tone="danger"
          title={
            actionError.stale ? 'Job changed on the server' : 'Action failed'
          }
        >
          <p>
            {actionError.stale
              ? 'Reload the latest job before choosing another lifecycle action.'
              : actionError.message}
          </p>
          {actionError.stale && (
            <Button variant="secondary" onClick={() => void q.refetch()}>
              Reload job
            </Button>
          )}
        </Alert>
      )}
      {j.status === 'rejected' && (
        <Alert tone="danger" title="Changes requested">
          <p>
            {j.rejectionReason ??
              'The reviewer requested changes. No reason was provided.'}
          </p>
        </Alert>
      )}
      {j.status === 'pending-review' && (
        <Alert tone="warning" title="Awaiting review">
          An administrator must approve this job before publication.
        </Alert>
      )}
      {j.status === 'published' && (
        <Alert tone="info" title="Published">
          This job is live and accepting applications.
        </Alert>
      )}
      {j.status === 'paused' && (
        <Alert tone="warning" title="Paused">
          Applications are paused until the job is resumed.
        </Alert>
      )}
      {j.status === 'closed' && (
        <Alert tone="info" title="Closed">
          This job no longer accepts applications.
        </Alert>
      )}
      {j.status === 'archived' && (
        <Alert tone="info" title="Archived">
          This job is retained for historical reference.
        </Alert>
      )}
      <div className="job-detail-grid">
        <Card heading="Role overview">
          <p className="job-description">{j.description}</p>
          <DescriptionList
            items={[
              { term: 'Openings', description: j.openings },
              { term: 'Applications', description: j.applicationsCount },
              { term: 'Views', description: j.viewsCount },
              {
                id: 'deadline',
                term: 'Deadline',
                description: j.deadline
                  ? new Date(j.deadline).toLocaleDateString()
                  : 'No deadline',
              },
            ]}
          />
        </Card>
        <Card heading="Requirements">
          {j.requirements.length ? (
            <ul>
              {j.requirements.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Responsibilities">
          {j.responsibilities.length ? (
            <ul>
              {j.responsibilities.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Experience and compensation">
          <DescriptionList
            items={[
              {
                term: 'Experience',
                description: `${j.draft.minimumExperience}${j.draft.maximumExperience ? `–${j.draft.maximumExperience}` : '+'} years`,
              },
              {
                term: 'Salary',
                description: j.draft.salaryMinimum
                  ? `${j.draft.salaryCurrency} ${j.draft.salaryMinimum}–${j.draft.salaryMaximum} ${j.draft.salaryPeriod}${j.draft.salaryVisible ? ' · visible' : ' · private'}`
                  : 'Not specified',
              },
              { term: 'Location', description: j.location },
            ]}
          />
        </Card>
        <Card heading="Skills">
          {j.draft.skills.length ? (
            <ul>
              {j.draft.skills.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong> · {label(s.minimumProficiency)} ·{' '}
                  {s.minimumYearsOfExperience} years · weight {s.weight}
                  {s.required ? ' · required' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Preferred qualifications">
          {j.preferredQualifications.length ? (
            <ul>
              {j.preferredQualifications.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Education">
          {j.educationRequirements.length ? (
            <ul>
              {j.educationRequirements.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Application settings">
          <DescriptionList
            items={[
              {
                term: 'Resume',
                description: j.draft.resumeRequired ? 'Required' : 'Optional',
              },
              {
                term: 'Assessment',
                description: j.draft.assessmentRequired
                  ? 'Required'
                  : 'Not required',
              },
              {
                term: 'Minimum profile completion',
                description: `${j.draft.minimumProfileCompletion}%`,
              },
              {
                term: 'Questions',
                description: j.draft.questions.length
                  ? j.draft.questions.map((q) => q.question).join(' · ')
                  : 'None',
              },
            ]}
          />
        </Card>
        <Card heading="Record history">
          <DescriptionList
            items={[
              {
                term: 'Reviewed',
                description: j.reviewedAt
                  ? new Date(j.reviewedAt).toLocaleString()
                  : 'Not reviewed',
              },
              {
                term: 'Created',
                description: j.createdAt
                  ? new Date(j.createdAt).toLocaleString()
                  : 'Unknown',
              },
              {
                term: 'Updated',
                description: j.updatedAt
                  ? new Date(j.updatedAt).toLocaleString()
                  : 'Unknown',
              },
            ]}
          />
        </Card>
      </div>
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`${label(confirm)} job?`}
          description="This updates the job lifecycle immediately."
          confirmLabel={label(confirm)}
          variant={confirm === 'archive' ? 'destructive' : 'default'}
          onConfirm={async () => {
            try {
              setActionError(null);
              await m.mutateAsync(confirm);
              setConfirm(null);
            } catch (error) {
              setConfirm(null);
              setActionError({
                message:
                  error instanceof Error
                    ? error.message
                    : 'The action could not be completed.',
                stale: error instanceof ApiError && error.status === 409,
              });
            }
          }}
        />
      )}
    </main>
  );
}
const draftKey = (actor: string, company: string, id: string) =>
  `talvix:job-draft:v1:${actor}:${company}:${id}`;
function readDraft(key: string): { draft: JobDraft; savedAt: number } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as unknown;
    if (!value || typeof value !== 'object') return null;
    const record = value as {
      version?: unknown;
      savedAt?: unknown;
      draft?: unknown;
    };
    if (
      record.version !== 1 ||
      typeof record.savedAt !== 'number' ||
      !record.draft ||
      typeof record.draft !== 'object'
    )
      return null;
    const d = record.draft as Record<string, unknown>;
    const stringKeys = [
      'title',
      'description',
      'employmentType',
      'workMode',
      'city',
      'state',
      'country',
      'openings',
      'deadline',
      'minimumExperience',
      'maximumExperience',
      'responsibilities',
      'requirements',
      'preferredQualifications',
      'educationRequirements',
      'minimumProfileCompletion',
      'salaryMinimum',
      'salaryMaximum',
      'salaryCurrency',
      'salaryPeriod',
    ];
    if (
      !stringKeys.every((k) => typeof d[k] === 'string') ||
      typeof d.assessmentRequired !== 'boolean' ||
      typeof d.resumeRequired !== 'boolean' ||
      typeof d.salaryVisible !== 'boolean' ||
      !Array.isArray(d.skills) ||
      !Array.isArray(d.questions)
    )
      return null;
    return { draft: d as unknown as JobDraft, savedAt: record.savedAt };
  } catch {
    return null;
  }
}
function validate(d: JobDraft) {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = 'Enter a title.';
  if (!d.description.trim()) e.description = 'Enter a description.';
  if (!employmentTypes.includes(d.employmentType as never))
    e.employmentType = 'Choose an employment type.';
  if (!workModes.includes(d.workMode as never))
    e.workMode = 'Choose a work mode.';
  if (!(Number(d.openings) > 0)) e.openings = 'Openings must be at least 1.';
  if (!Number.isInteger(Number(d.openings)) || Number(d.openings) > 10000)
    e.openings = 'Openings must be a whole number from 1 to 10,000.';
  if (d.deadline && new Date(d.deadline) <= new Date())
    e.deadline = 'Application deadline must be in the future.';
  if (d.scheduledPublishAt && new Date(d.scheduledPublishAt) <= new Date())
    e.scheduledPublishAt = 'Scheduled publish date must be in the future.';
  if (d.scheduledPublishAt && d.deadline && new Date(d.scheduledPublishAt) >= new Date(d.deadline))
    e.scheduledPublishAt = 'Scheduled publish date must be before the application deadline.';
  if (Number(d.minimumExperience) < 0 || Number(d.minimumExperience) > 60)
    e.minimumExperience = 'Experience must be between 0 and 60 years.';
  if (
    Number(d.maximumExperience) < Number(d.minimumExperience) &&
    d.maximumExperience
  )
    e.maximumExperience = 'Maximum experience cannot be lower than minimum.';
  if (
    d.maximumExperience &&
    (Number(d.maximumExperience) < 0 || Number(d.maximumExperience) > 60)
  )
    e.maximumExperience = 'Experience must be between 0 and 60 years.';
  const salaryStarted = d.salaryMinimum !== '' || d.salaryMaximum !== '';
  if (salaryStarted) {
    if (d.salaryMinimum === '' || d.salaryMaximum === '') {
      e.salaryMinimum = 'Enter both salary bounds.';
    } else {
      const minVal = Number(d.salaryMinimum);
      const maxVal = Number(d.salaryMaximum);
      if (isNaN(minVal) || minVal < 0) {
        e.salaryMinimum = 'Minimum salary must be a positive number.';
      }
      if (isNaN(maxVal) || maxVal < 0) {
        e.salaryMaximum = 'Maximum salary must be a positive number.';
      }
      if (!e.salaryMinimum && !e.salaryMaximum && maxVal < minVal) {
        e.salaryMaximum = 'Maximum salary cannot be lower than minimum salary.';
      }
    }
  }
  if (salaryStarted && !/^[A-Z]{3}$/.test(d.salaryCurrency))
    e.salaryCurrency = 'Use a three-letter currency code.';
  if (
    Number(d.minimumProfileCompletion) < 0 ||
    Number(d.minimumProfileCompletion) > 100
  )
    e.minimumProfileCompletion = 'Profile completion must be from 0 to 100.';
  const names = d.skills
    .map((s) => s.name.trim().toLowerCase())
    .filter(Boolean);
  if (new Set(names).size !== names.length)
    e.skills = 'Skill names must be unique.';
  d.skills.forEach((s, i) => {
    if (!s.name.trim()) e[`skills.${i}.name`] = 'Enter a skill name.';
    if (Number(s.weight) < 1 || Number(s.weight) > 100)
      e[`skills.${i}.weight`] = 'Weight must be between 1 and 100.';
    if (!Number.isInteger(Number(s.weight)))
      e[`skills.${i}.weight`] = 'Weight must be a whole number.';
    if (
      Number(s.minimumYearsOfExperience) < 0 ||
      Number(s.minimumYearsOfExperience) > 60
    )
      e[`skills.${i}.minimumYearsOfExperience`] =
        'Skill experience must be from 0 to 60 years.';
  });
  d.questions.forEach((q, i) => {
    if (!q.question.trim())
      e[`applicationQuestions.${i}.question`] = 'Enter a question.';
    if (
      ['single-choice', 'multiple-choice'].includes(q.type) &&
      q.options.split('\n').filter((x) => x.trim()).length < 2
    )
      e[`applicationQuestions.${i}.options`] =
        'Choice questions require at least two options.';
  });
  return e;
}
function formatApiError(err: any): string {
  if (err instanceof ApiError) {
    if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
      return Object.entries(err.fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join('\n');
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

interface AIDescriptionEditorProps {
  jobTitle: string;
  value: string;
  onApply: (newDesc: string) => void;
  onCancel: () => void;
  draft?: JobDraft | undefined;
}

function AIDescriptionEditor({ jobTitle, value, onApply, onCancel, draft }: AIDescriptionEditorProps) {
  const [desc, setDesc] = useState(value);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [safetyCheckResult, setSafetyCheckResult] = useState<{ isSafe: boolean; riskScore: number; issues: string[] } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '400px', maxWidth: '800px', width: '100%', padding: '4px' }}>
      <div className="ai-assist-toolbar" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-secondary)' }}>AI Recruiter Assist:</span>
        <Button
          type="button"
          variant="secondary"
          disabled={aiGenerating}
          onClick={async () => {
            if (!jobTitle.trim()) {
              alert('Please enter a job title first.');
              return;
            }
            setAiGenerating(true);
            try {
              const skills = draft?.skills?.map((s) => s.name).filter(Boolean) ?? [];
              const location = [draft?.city, draft?.state, draft?.country].filter(Boolean).join(', ');
              const minExp = draft?.minimumExperience ? Number(draft.minimumExperience) : undefined;
              const maxExp = draft?.maximumExperience ? Number(draft.maximumExperience) : undefined;

              const payload: Record<string, unknown> = {
                title: jobTitle,
                keyRequirements: draft?.requirements?.trim() || undefined,
                employmentType: draft?.employmentType || undefined,
                workMode: draft?.workMode || undefined,
                skills: skills.length > 0 ? skills : undefined,
                minimumExperience: minExp && !Number.isNaN(minExp) ? minExp : undefined,
                maximumExperience: maxExp && !Number.isNaN(maxExp) ? maxExp : undefined,
                location: location || undefined,
              };

              const res = await apiRequest<{ description: string }>('/jobs/ai/generate-description', {
                method: 'POST',
                body: payload,
              });
              if (res?.description) {
                setDesc(res.description);
              }
            } catch (err) {
              alert('Failed to generate description:\n' + formatApiError(err));
            } finally {
              setAiGenerating(false);
            }
          }}
        >
          {aiGenerating ? 'Generating...' : 'Generate Description'}
        </Button>


        <Button
          type="button"
          variant="secondary"
          disabled={aiChecking}
          onClick={async () => {
            if (!jobTitle.trim() || !desc.trim()) {
              alert('Please enter both job title and description first.');
              return;
            }
            setAiChecking(true);
            try {
              const res = await apiRequest<{ check: { isSafe: boolean; riskScore: number; issues: string[] } }>('/jobs/ai/safety-check', {
                method: 'POST',
                body: { title: jobTitle, description: desc }
              });
              if (res?.check) {
                setSafetyCheckResult(res.check);
              }
            } catch (err) {
              alert('Failed to run safety check:\n' + formatApiError(err));
            } finally {
              setAiChecking(false);
            }
          }}
        >
          {aiChecking ? 'Running safety check...' : 'AI Safety Check'}
        </Button>

        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            navigator.clipboard.writeText(desc).then(() => alert('Copied to clipboard!'));
          }}
        >
          Copy All
        </Button>
        <Button
          type="button"
          variant="quiet"
          onClick={async () => {
            try {
              const text = await navigator.clipboard.readText();
              setDesc(text);
            } catch (err) {
              alert('Failed to paste from clipboard. Please paste manually into the text area.');
            }
          }}
        >
          Paste
        </Button>
      </div>

      {safetyCheckResult && (
        <div style={{
          padding: '12px',
          background: safetyCheckResult.isSafe ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          borderLeft: `4px solid ${safetyCheckResult.isSafe ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)'}`,
          borderRadius: '4px'
        }}>
          <strong>AI Safety Verdict: {safetyCheckResult.isSafe ? '✓ Safe' : '⚠️ Risk Detected'}</strong>
          <small style={{ display: 'block', color: 'var(--color-text-muted)', marginTop: '2px' }}>Risk Score: {safetyCheckResult.riskScore}/100</small>
          {safetyCheckResult.issues.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13px' }}>
              {safetyCheckResult.issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-secondary)' }}>Job Description Text:</span>
          <span style={{ fontSize: '12px', color: desc.length > 10000 ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
            {desc.length.toLocaleString()}/10,000 characters
          </span>
        </div>
        <textarea
          style={{
            width: '100%',
            height: '350px',
            padding: '12px',
            fontFamily: 'inherit',
            fontSize: '14px',
            lineHeight: '1.5',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            resize: 'vertical'
          }}
          maxLength={10000}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Type, paste, or generate your job description here..."
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => onApply(desc)}
        >
          Apply Description
        </Button>
      </div>
    </div>
  );
}

export function JobFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { jobId = 'new' } = useParams();
  const nav = useNavigate(),
    a = useAccess(),
    existing = useManagedJob(
      jobId,
      mode === 'edit' && a.has('jobs.update') && !a.blocked,
    ),
    save = useSaveJob(mode === 'edit' ? jobId : undefined);
  const key = draftKey(
    a.user?._id ?? 'anon',
    a.recruiter?.company?._id ?? 'none',
    jobId,
  );
  const initialStored = useMemo(() => readDraft(key), [key]);
  const [savedDraft, setSavedDraft] = useState<JobDraft | null>(
    () => initialStored?.draft ?? null,
  );
  const [d, setD] = useState(emptyDraft),
    [dirty, setDirty] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [safetyCheckResult, setSafetyCheckResult] = useState<{ isSafe: boolean; riskScore: number; issues: string[] } | null>(null);
  const [submittingAndPublishing, setSubmittingAndPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const cloneMutation = useCloneJob();
  const blocker = useBlocker(dirty);
  const [createdWithoutRead, setCreatedWithoutRead] = useState(false);
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    if (
      mode === 'edit' &&
      existing.data?.updatedAt &&
      initialStored &&
      initialStored.savedAt <= new Date(existing.data.updatedAt).getTime()
    ) {
      sessionStorage.removeItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedDraft(null);
    }
    if (mode === 'edit' && existing.data && !savedDraft) {
      // Server state initializes the edit buffer when the query resolves.
      setD(toDraft(existing.data));
      setDirty(false);
    }
  }, [mode, existing.data, savedDraft, initialStored, key]);
  useEffect(() => {
    if (dirty)
      sessionStorage.setItem(
        key,
        JSON.stringify({ version: 1, savedAt: Date.now(), draft: d }),
      );
  }, [d, dirty, key]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [dirty]);
  const set = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  if (mode === 'create' && !a.has('jobs.create')) return <PermissionState />;
  if (mode === 'edit' && !a.has('jobs.update')) return <PermissionState />;
  if (a.blocked) return <Block />;
  if (mode === 'edit' && existing.isLoading)
    return <LoadingState label="Loading job" />;
  if (
    mode === 'edit' &&
    existing.data &&
    !allowedActions(existing.data.status, ['jobs.update'], a.verified).edit
  )
    return (
      <PermissionState
        title="Read-only job"
        description="Only draft or rejected jobs can be edited."
      />
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending || submitLock.current) return;
    const next = validate(d);
    setErrors(next);
    if (Object.keys(next).length) {
      setTimeout(() => summary.current?.focus());
      return;
    }
    submitLock.current = true;
    try {
      const res = await save.mutateAsync(d);
      sessionStorage.removeItem(key);
      setDirty(false);
      const id = (res.job as { _id?: string } | undefined)?._id;
      if (mode === 'create' && !a.has('jobs.update'))
        setCreatedWithoutRead(true);
      else
        window.setTimeout(
          () =>
            nav(
              mode === 'edit' || id
                ? `/org/jobs/${mode === 'edit' ? jobId : id}`
                : '/org',
            ),
          0,
        );
    } catch (err) {
      const f = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(
        Object.keys(f).length
          ? f
          : {
            form: err instanceof Error ? err.message : 'Could not save job.',
          },
      );
      setTimeout(() => summary.current?.focus());
    } finally {
      submitLock.current = false;
    }
  };
  if (createdWithoutRead)
    return (
      <EmptyState
        title="Job created"
        description="Your draft was saved. You do not have permission to open managed job details."
        action={<Button onClick={() => nav('/org')}>Return to overview</Button>}
      />
    );
  return (
    <main className="jobs-page job-form-page">
      <JobTabs canCreate={a.has('jobs.create')} />

      {/* Hero Header Card */}
      <div className="job-form-hero">
        <div className="job-form-hero__main">
          <div className="job-form-hero__icon">
            <Briefcase size={26} />
          </div>
          <div className="job-form-hero__content">
            <div className="job-form-hero__meta">
              <span className="job-form-hero__code">
                {mode === 'create' ? '#DRAFT-NEW' : `#JOB-${jobId.slice(-6).toUpperCase()}`}
              </span>
              <StatusTag tone={mode === 'create' ? 'draft' : (existing.data?.status ? statusMeta(existing.data.status)[1] : 'draft')}>
                {mode === 'create' ? 'New Draft' : label(existing.data?.status || 'draft')}
              </StatusTag>
            </div>
            <h1 className="job-form-hero__title">
              {mode === 'create' ? 'Create New Job Position' : 'Edit Job Position'}
            </h1>
            <p className="job-form-hero__sub">
              Draft a targeted position with AI-assisted description generation and skill auto-suggestions.
            </p>
          </div>
        </div>
        <div className="job-form-hero__actions">
          <Link to="/org/jobs" className="job-form-hero__back">
            <ChevronLeft size={16} />
            <span>Back to Jobs</span>
          </Link>
        </div>
      </div>

      {/* 5-Card Draft Completeness Grid */}
      <div className="job-metrics-grid">
        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box">
              <FileEdit size={20} />
            </div>
            <span className={`job-metric-badge ${d.title.trim() && d.description.trim() ? 'job-metric-badge--success' : 'job-metric-badge--warning'}`}>
              {d.title.trim() && d.description.trim() ? 'Complete' : 'Incomplete'}
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">1. Role Basics</span>
            <span className="job-metric-card__val" style={{ fontSize: '1rem', fontStyle: d.title ? 'normal' : 'italic' }}>
              {d.title ? d.title : 'Untitled Position'}
            </span>
            <span className="job-metric-card__sub">{d.workMode ? label(d.workMode) : 'No work mode'} · {d.openings} opening(s)</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
              <MapPin size={20} />
            </div>
            <span className={`job-metric-badge ${d.city || d.country ? 'job-metric-badge--success' : 'job-metric-badge--neutral'}`}>
              {d.city || d.country ? 'Configured' : 'Optional'}
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">2. Location & Exp</span>
            <span className="job-metric-card__val" style={{ fontSize: '1rem' }}>
              {[d.city, d.country].filter(Boolean).join(', ') || 'Remote / Unset'}
            </span>
            <span className="job-metric-card__sub">{d.minimumExperience || 0}-{d.maximumExperience || 0} yrs experience</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}>
              <Building2 size={20} />
            </div>
            <span className={`job-metric-badge ${d.salaryMinimum || d.salaryMaximum ? 'job-metric-badge--success' : 'job-metric-badge--neutral'}`}>
              {d.salaryMinimum || d.salaryMaximum ? 'Set' : 'Omitted'}
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">3. Compensation</span>
            <span className="job-metric-card__val" style={{ fontSize: '1rem' }}>
              {d.salaryMinimum || d.salaryMaximum
                ? `${d.salaryCurrency || 'USD'} ${d.salaryMinimum || 0} - ${d.salaryMaximum || 0}`
                : 'Not specified'}
            </span>
            <span className="job-metric-card__sub">{d.salaryPeriod ? label(d.salaryPeriod) : 'Yearly'} ({d.salaryVisible ? 'Public' : 'Private'})</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' }}>
              <Sparkles size={20} />
            </div>
            <span className={`job-metric-badge ${d.skills.length > 0 ? 'job-metric-badge--success' : 'job-metric-badge--warning'}`}>
              {d.skills.length} skill(s)
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">4. Skills & Req</span>
            <span className="job-metric-card__val" style={{ fontSize: '1rem' }}>
              {d.skills.length > 0 ? `${d.skills.length} skills attached` : 'No skills set'}
            </span>
            <span className="job-metric-card__sub">{d.requirements ? 'Requirements set' : 'Add requirements'}</span>
          </div>
        </div>

        <div className="job-metric-card">
          <div className="job-metric-card__header">
            <div className="job-metric-icon-box" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)' }}>
              <Users size={20} />
            </div>
            <span className={`job-metric-badge ${d.questions.length > 0 ? 'job-metric-badge--info' : 'job-metric-badge--neutral'}`}>
              {d.questions.length} question(s)
            </span>
          </div>
          <div className="job-metric-card__body">
            <span className="job-metric-card__label">5. Screening</span>
            <span className="job-metric-card__val" style={{ fontSize: '1rem' }}>
              {d.questions.length > 0 ? `${d.questions.length} custom questions` : 'Default screening'}
            </span>
            <span className="job-metric-card__sub">Min Profile: {d.minimumProfileCompletion || 0}%</span>
          </div>
        </div>
      </div>

      {savedDraft && (
        <Alert tone="warning" title="Newer local draft available">
          <p>
            Restore your saved browser draft or discard it and continue with the
            server version.
          </p>
          <div className="job-actions" style={{ marginTop: '10px' }}>
            <Button
              type="button"
              onClick={() => {
                setD(savedDraft);
                setDirty(true);
                setSavedDraft(null);
              }}
            >
              Restore draft
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                sessionStorage.removeItem(key);
                setSavedDraft(null);
                if (existing.data) setD(toDraft(existing.data));
              }}
            >
              Discard draft
            </Button>
          </div>
        </Alert>
      )}

      <Form className="job-form job-form-container" busy={save.isPending} onSubmit={submit}>
        <ErrorSummary
          ref={summary}
          errors={Object.entries(errors).map(([fieldId, message]) => ({
            fieldId: fieldId === 'form' ? 'job-form' : fieldId,
            message,
          }))}
        />
        <FormSection
          heading="Role basics"
          description="Required details used in the job lifecycle."
        >
          <TextField
            id="title"
            label="Job title"
            required
            value={d.title}
            error={errors.title}
            maxLength={150}
            onChange={(e) => set('title', e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', marginBottom: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Job Description</span>
            <Dialog
              open={descriptionEditorOpen}
              onOpenChange={setDescriptionEditorOpen}
              title="AI Job Description Assistant"
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}
                  onClick={() => setDescriptionEditorOpen(true)}
                >
                  ✨ AI Assist
                </Button>
              }
            >
              <AIDescriptionEditor
                jobTitle={d.title}
                value={d.description}
                draft={d}
                onApply={(newDesc) => {
                  set('description', newDesc);
                  setDescriptionEditorOpen(false);
                }}
                onCancel={() => setDescriptionEditorOpen(false)}
              />

            </Dialog>
          </div>
          <TextArea
            id="description"
            label="Description"
            required
            value={d.description}
            error={errors.description}
            maxLength={10000}
            onChange={(e) => set('description', e.target.value)}
            hint="Click the 'AI Assist' button above to open the expanded editor."
          />
          <div className="job-form-grid">
            <Select
              id="employmentType"
              label="Employment type"
              required
              value={d.employmentType}
              error={errors.employmentType}
              options={employmentTypes.map((v) => ({
                value: v,
                label: label(v),
              }))}
              onChange={(e) => set('employmentType', e.target.value)}
            />
            <Select
              id="workMode"
              label="Work mode"
              required
              value={d.workMode}
              error={errors.workMode}
              options={workModes.map((v) => ({ value: v, label: label(v) }))}
              onChange={(e) => set('workMode', e.target.value)}
            />
            <TextField
              id="openings"
              label="Openings"
              type="number"
              min="1"
              max="10000"
              value={d.openings}
              error={errors.openings}
              onChange={(e) => set('openings', e.target.value)}
            />
            <TextField
              id="deadline"
              label="Application deadline"
              type="date"
              value={d.deadline}
              error={errors.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
            <TextField
              id="scheduledPublishAt"
              label="Scheduled publish date"
              type="date"
              value={d.scheduledPublishAt}
              error={errors.scheduledPublishAt}
              onChange={(e) => set('scheduledPublishAt', e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection heading="Location and experience">
          <div className="job-form-grid">
            <TextField
              label="City"
              value={d.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <TextField
              label="State"
              value={d.state}
              onChange={(e) => set('state', e.target.value)}
            />
            <TextField
              label="Country"
              value={d.country}
              onChange={(e) => set('country', e.target.value)}
            />
            <TextField
              id="minimumExperience"
              label="Minimum experience"
              type="number"
              min="0"
              max="60"
              value={d.minimumExperience}
              error={errors.minimumExperience}
              onChange={(e) => set('minimumExperience', e.target.value)}
            />
            <TextField
              id="maximumExperience"
              label="Maximum experience"
              type="number"
              min="0"
              max="60"
              value={d.maximumExperience}
              error={errors.maximumExperience}
              onChange={(e) => set('maximumExperience', e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          heading="Salary"
          description="Leave both amounts empty to omit salary from the API payload."
        >
          <div className="job-form-grid">
            <TextField
              id="salaryMinimum"
              label="Minimum salary"
              type="number"
              min="0"
              value={d.salaryMinimum}
              error={errors.salaryMinimum}
              onChange={(e) => set('salaryMinimum', e.target.value)}
            />
            <TextField
              id="salaryMaximum"
              label="Maximum salary"
              type="number"
              min="0"
              value={d.salaryMaximum}
              error={errors.salaryMaximum}
              onChange={(e) => set('salaryMaximum', e.target.value)}
            />
            <Select
              id="salaryCurrency"
              label="Currency"
              value={d.salaryCurrency}
              error={errors.salaryCurrency}
              options={[
                { value: 'USD', label: 'USD ($)' },
                { value: 'EUR', label: 'EUR (€)' },
                { value: 'GBP', label: 'GBP (£)' },
                { value: 'INR', label: 'INR (₹)' },
                { value: 'CAD', label: 'CAD (C$)' },
                { value: 'AUD', label: 'AUD (A$)' },
                { value: 'SGD', label: 'SGD (S$)' },
                { value: 'AED', label: 'AED (د.إ)' }
              ]}
              onChange={(e) => set('salaryCurrency', e.target.value)}
            />
            <Select
              label="Salary period"
              value={d.salaryPeriod}
              options={['hourly', 'monthly', 'yearly'].map((v) => ({
                value: v,
                label: label(v),
              }))}
              onChange={(e) => set('salaryPeriod', e.target.value)}
            />
            <Checkbox
              label="Show salary publicly"
              checked={d.salaryVisible}
              onChange={(e) => set('salaryVisible', e.target.checked)}
            />
          </div>
        </FormSection>

        <FormSection
          heading="Requirements"
          description="Enter one item per line."
        >
          {(
            [
              'responsibilities',
              'requirements',
              'preferredQualifications',
              'educationRequirements',
            ] as const
          ).map((k) => (
            <TextArea
              key={k}
              label={label(k)}
              value={d[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          ))}
        </FormSection>

        <FormSection heading="Application settings">
          <Checkbox
            label="Resume required"
            checked={d.resumeRequired}
            onChange={(e) => set('resumeRequired', e.target.checked)}
          />
          <Checkbox
            label="Assessment required"
            checked={d.assessmentRequired}
            onChange={(e) => set('assessmentRequired', e.target.checked)}
          />
          <TextField
            id="minimumProfileCompletion"
            label="Minimum profile completion"
            type="number"
            min="0"
            max="100"
            value={d.minimumProfileCompletion}
            error={errors.minimumProfileCompletion}
            onChange={(e) => set('minimumProfileCompletion', e.target.value)}
          />
        </FormSection>

        <FormSection
          heading="Skills"
          description="Add exact skill requirements used during review."
        >
          {d.skills.map((skill, index) => (
            <Card
              key={index}
              heading={`Skill ${index + 1}`}
              actions={
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    set(
                      'skills',
                      d.skills.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              }
            >
              <div className="job-form-grid">
                <TextField
                  label="Skill name"
                  id={`skills.${index}.name`}
                  error={errors[`skills.${index}.name`]}
                  value={skill.name}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, name: e.target.value } : s,
                      ),
                    )
                  }
                />
                <Select
                  label="Minimum proficiency"
                  value={skill.minimumProficiency}
                  options={[
                    'beginner',
                    'intermediate',
                    'advanced',
                    'expert',
                  ].map((v) => ({ value: v, label: label(v) }))}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index
                          ? { ...s, minimumProficiency: e.target.value }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label="Minimum years"
                  id={`skills.${index}.minimumYearsOfExperience`}
                  error={errors[`skills.${index}.minimumYearsOfExperience`]}
                  type="number"
                  min="0"
                  max="60"
                  value={skill.minimumYearsOfExperience}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index
                          ? { ...s, minimumYearsOfExperience: e.target.value }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label="Weight"
                  id={`skills.${index}.weight`}
                  error={errors[`skills.${index}.weight`]}
                  type="number"
                  min="1"
                  max="100"
                  value={skill.weight}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, weight: e.target.value } : s,
                      ),
                    )
                  }
                />
                <Checkbox
                  label="Required skill"
                  checked={skill.required}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, required: e.target.checked } : s,
                      ),
                    )
                  }
                />
              </div>
            </Card>
          ))}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                set('skills', [
                  ...d.skills,
                  {
                    name: '',
                    required: true,
                    minimumProficiency: 'beginner',
                    minimumYearsOfExperience: '0',
                    weight: '50',
                  },
                ])
              }
            >
              Add skill
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={aiSuggesting}
              onClick={async () => {
                if (!d.title.trim()) {
                  alert('Please enter a job title first to suggest skills.');
                  return;
                }
                setAiSuggesting(true);
                try {
                  const res = await apiRequest<{ skills: string[] }>('/jobs/ai/suggest-skills', {
                    method: 'POST',
                    body: { title: d.title, description: d.description || d.title }
                  });
                  if (res?.skills?.length) {
                    const newSkills = res.skills.map(name => ({
                      name,
                      required: true,
                      minimumProficiency: 'beginner',
                      minimumYearsOfExperience: '1',
                      weight: '50'
                    }));
                    const existingNames = new Set(d.skills.map(s => s.name.toLowerCase()));
                    const filteredNew = newSkills.filter(s => !existingNames.has(s.name.toLowerCase()));
                    set('skills', [...d.skills, ...filteredNew]);
                  }
                } catch (err) {
                  alert('Failed to suggest skills:\n' + formatApiError(err));
                } finally {
                  setAiSuggesting(false);
                }
              }}
            >
              {aiSuggesting ? 'Suggesting Skills...' : 'Suggest Skills'}
            </Button>
          </div>
        </FormSection>

        <FormSection
          heading="Application questions"
          description="Choice questions require at least two options, one per line."
        >
          {d.questions.map((question, index) => (
            <Card
              key={index}
              heading={`Question ${index + 1}`}
              actions={
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    set(
                      'questions',
                      d.questions.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              }
            >
              <TextArea
                label="Question"
                id={`applicationQuestions.${index}.question`}
                error={errors[`applicationQuestions.${index}.question`]}
                value={question.question}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, question: e.target.value } : q,
                    ),
                  )
                }
              />
              <Select
                label="Answer type"
                value={question.type}
                options={[
                  'text',
                  'textarea',
                  'number',
                  'boolean',
                  'single-choice',
                  'multiple-choice',
                ].map((v) => ({ value: v, label: label(v) }))}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, type: e.target.value } : q,
                    ),
                  )
                }
              />
              {['single-choice', 'multiple-choice'].includes(question.type) && (
                <TextArea
                  label="Options"
                  id={`applicationQuestions.${index}.options`}
                  error={errors[`applicationQuestions.${index}.options`]}
                  value={question.options}
                  onChange={(e) =>
                    set(
                      'questions',
                      d.questions.map((q, i) =>
                        i === index ? { ...q, options: e.target.value } : q,
                      ),
                    )
                  }
                />
              )}
              <Checkbox
                label="Required question"
                checked={question.required}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, required: e.target.checked } : q,
                    ),
                  )
                }
              />
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set('questions', [
                ...d.questions,
                { question: '', type: 'text', required: false, options: '' },
              ])
            }
          >
            Add question
          </Button>
        </FormSection>

        <FormActions className="job-form-sticky-bar">
          <div className="job-form-sticky-bar__info">
            <Clock size={15} />
            <span>{dirty ? 'Unsaved changes (auto-saved to browser session)' : 'Draft in sync'}</span>
          </div>
          <div className="job-form-sticky-bar__actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => nav('/org/jobs')}
            >
              Cancel
            </Button>
            {mode === 'edit' && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={cloneMutation.isPending}
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const result = await cloneMutation.mutateAsync(jobId);
                      if (result && typeof result === 'object' && 'job' in result) {
                        const newJob = (result as { job: { _id: string } }).job;
                        setDirty(false);
                        sessionStorage.removeItem(key);
                        alert('Job cloned successfully!');
                        nav(`/org/jobs/${newJob._id}/edit`);
                      }
                    } catch (err) {
                      alert('Failed to clone job: ' + (err as Error).message);
                    }
                  }}
                >
                  {cloneMutation.isPending ? 'Cloning...' : 'Clone job'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  loading={archiving}
                  onClick={async (e) => {
                    e.preventDefault();
                    if (confirm('Are you sure you want to archive this job?')) {
                      setDirty(false);
                      setArchiving(true);
                      try {
                        await apiRequest(`/jobs/manage/${jobId}`, { method: 'DELETE' });
                        sessionStorage.removeItem(key);
                        alert('Job archived successfully.');
                        nav('/org/jobs');
                      } catch (err) {
                        alert('Failed to archive job: ' + (err as Error).message);
                      } finally {
                        setArchiving(false);
                      }
                    }
                  }}
                >
                  Archive job
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              loading={save.isPending || submittingAndPublishing}
              onClick={async (e) => {
                e.preventDefault();
                const nextErrors = validate(d);
                if (Object.keys(nextErrors).length > 0) {
                  setErrors(nextErrors);
                  summary.current?.scrollIntoView({ behavior: 'smooth' });
                  return;
                }
                setSubmittingAndPublishing(true);
                try {
                  const res = await save.mutateAsync(d);
                  let savedId = jobId;
                  if (res && typeof res === 'object' && 'job' in res) {
                    const jobData = (res as { job: { _id: string } }).job;
                    savedId = jobData._id;
                  }
                  await apiRequest(`/jobs/manage/${savedId}/submit`, { method: 'PATCH' });
                  setDirty(false);
                  sessionStorage.removeItem(key);
                  alert('Job submitted and published successfully!');
                  nav('/org/jobs');
                } catch (err) {
                  alert('Failed to publish job: ' + (err as Error).message);
                } finally {
                  setSubmittingAndPublishing(false);
                }
              }}
            >
              Submit & Publish
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save draft
            </Button>
          </div>
        </FormActions>
      </Form>
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && blocker.reset()}
          title="Discard unsaved changes?"
          description="Your unsaved job changes will be lost."
          confirmLabel="Discard and leave"
          variant="destructive"
          onConfirm={async () => {
            setDirty(false);
            sessionStorage.removeItem(key);
            blocker.proceed();
          }}
        />
      )}
      {safetyCheckResult && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--color-overlay)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: 'var(--color-surface-1)',
              border: `1px solid ${safetyCheckResult.isSafe ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '24px',
              borderRadius: 'var(--border-radius-lg, 12px)',
              width: '95%',
              maxWidth: '550px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} style={{ color: safetyCheckResult.isSafe ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>AI Safety Check Result</h3>
              </div>
              <button
                type="button"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
                onClick={() => setSafetyCheckResult(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px', borderRadius: '8px', background: safetyCheckResult.isSafe ? 'var(--color-success-bg)' : 'var(--color-danger-bg)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: safetyCheckResult.isSafe ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>
                  Status: {safetyCheckResult.isSafe ? 'Passed (Safe)' : 'Flagged (Unsafe)'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  Risk Score: {safetyCheckResult.riskScore}/100
                </div>
              </div>
            </div>

            <div>
              <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Identified Issues:</strong>
              {safetyCheckResult.issues.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {safetyCheckResult.issues.map((issue, idx) => (
                    <li key={idx} style={{ color: 'var(--color-text-secondary)', lineHeight: '1.4' }}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>No issues found. This job description looks safe.</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button type="button" variant="primary" onClick={() => setSafetyCheckResult(null)}>
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
