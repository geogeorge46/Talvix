import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FileText,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  MetricCard,
  PageHeader,
  PermissionState,
  SearchField,
  Select,
  StatusTag,
  Toolbar,
  type DataColumn,
} from '../../design-system';
import { can, useDashboardQueries } from './api';
import {
  APPLICATION_STAGES,
  parseDashboardFilters,
  type CandidateViewModel,
  type DashboardFilters,
} from './model';
import './organization-dashboard.css';

const stageOptions = APPLICATION_STAGES.map((value) => ({
  value,
  label: value
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()),
}));
const statusTone = (status: CandidateViewModel['stage']) =>
  status === 'hired' || status === 'offer-accepted'
    ? 'success'
    : status === 'rejected' || status === 'offer-declined'
      ? 'danger'
      : status.includes('offer')
        ? 'warning'
        : 'neutral';

function MetricBoundary({
  allowed,
  label,
  value,
  loading,
  error,
  metadata,
  icon,
  retry,
}: {
  allowed: boolean;
  label: string;
  value: React.ReactNode;
  loading: boolean;
  error: boolean;
  metadata: React.ReactNode;
  icon: React.ReactNode;
  retry: () => void;
}) {
  if (!allowed)
    return (
      <MetricCard
        label={label}
        value="Unavailable"
        metadata="Permission required"
        icon={icon}
      />
    );
  if (error)
    return (
      <Card className="tvx-dashboard-metric-error">
        <strong>{label}</strong>
        <span>Could not load</span>
        <Button variant="quiet" onClick={retry}>
          Retry
        </Button>
      </Card>
    );
  return (
    <MetricCard
      label={label}
      value={value}
      metadata={metadata}
      icon={icon}
      isLoading={loading}
    />
  );
}

function MatchScore({ candidate }: { candidate: CandidateViewModel }) {
  if (candidate.skillMatch === null)
    return <span className="tvx-dashboard-muted">Unavailable</span>;
  return (
    <span
      className="tvx-match"
      aria-label={`Deterministic skill match ${candidate.skillMatch} percent`}
    >
      <strong>{Math.round(candidate.skillMatch)}</strong>
      <small>%</small>
    </span>
  );
}

export function OrganizationDashboardPage() {
  const { user, recruiter } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseDashboardFilters(searchParams),
    [searchParams],
  );
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const permissions = recruiter?.permissions ?? [];
  const owner = Boolean(recruiter?.isCompanyOwner);
  const update = (patch: Partial<DashboardFilters>, resetPage = false) => {
    const next = { ...filters, ...patch, ...(resetPage ? { page: 1 } : {}) };
    const params = new URLSearchParams();
    if (next.range !== 30) params.set('range', String(next.range));
    if (next.q) params.set('q', next.q);
    if (next.stage) params.set('stage', next.stage);
    if (next.page > 1) params.set('page', String(next.page));
    setSearchParams(params, { replace: true });
  };
  useEffect(() => {
    const canonical = new URLSearchParams();
    if (filters.range !== 30) canonical.set('range', String(filters.range));
    if (filters.q) canonical.set('q', filters.q);
    if (filters.stage) canonical.set('stage', filters.stage);
    if (filters.page > 1) canonical.set('page', String(filters.page));
    if (canonical.toString() !== searchParams.toString())
      setSearchParams(canonical, { replace: true });
  }, [filters, searchParams, setSearchParams]);
  const queries = useDashboardQueries({
    filters,
    actorId: user?._id ?? 'unknown',
    companyId: recruiter?.company?._id ?? 'unknown',
    permissions,
    owner,
  });
  const applicationsAllowed = can(permissions, owner, 'applications.view');
  const interviewsAllowed = can(permissions, owner, 'interviews.view');
  const rows = queries.applications.data?.candidates ?? [];
  const pageData = queries.applications.data?.pagination;
  const hasFilters = Boolean(filters.q || filters.stage);
  const columns: DataColumn<CandidateViewModel>[] = [
    {
      id: 'candidate',
      header: 'Candidate',
      render: (candidate) => (
        <div className="tvx-candidate-identity">
          <Avatar name={candidate.name} size="sm" />
          <span>
            <strong>{candidate.name}</strong>
            <small>Applied {formatDate(candidate.submittedAt)}</small>
          </span>
        </div>
      ),
    },
    { id: 'role', header: 'Role', accessor: (candidate) => candidate.role },
    {
      id: 'match',
      header: 'Skill match',
      align: 'center',
      render: (candidate) => <MatchScore candidate={candidate} />,
    },
    {
      id: 'skills',
      header: 'Skills',
      render: (candidate) => (
        <div className="tvx-skill-list">
          {candidate.skills.length ? (
            candidate.skills.map((skill) => (
              <Badge
                key={skill}
                variant={
                  candidate.matchedSkills.includes(skill) ? 'accent' : 'neutral'
                }
              >
                {skill}
              </Badge>
            ))
          ) : (
            <span className="tvx-dashboard-muted">Not provided</span>
          )}
        </div>
      ),
    },
    {
      id: 'stage',
      header: 'Stage',
      render: (candidate) => (
        <StatusTag tone={statusTone(candidate.stage)}>
          {candidate.stageLabel}
        </StatusTag>
      ),
    },
  ];
  const clearFilters = () => {
    setSearchDraft('');
    update({ q: '', stage: '', page: 1 });
  };
  return (
    <div className="tvx-org-dashboard">
      <PageHeader
        title="Hiring overview"
        description="Monitor recruitment velocity and the talent pipeline across your organization."
        secondaryActions={
          <Select
            label="Dashboard date range"
            value={String(filters.range)}
            options={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
            onChange={(event) =>
              update(
                {
                  range: Number(
                    event.target.value,
                  ) as DashboardFilters['range'],
                },
                true,
              )
            }
          />
        }
        primaryAction={
          can(permissions, owner, 'jobs.create') ? (
            <Button
              leadingIcon={<Plus />}
              onClick={() => navigate('/org/jobs/new')}
            >
              Create job
            </Button>
          ) : undefined
        }
      />

      <section className="tvx-dashboard-metrics" aria-label="Hiring metrics">
        <MetricBoundary
          allowed={can(permissions, owner, 'jobs.update')}
          label="Active jobs"
          value={queries.jobs.data?.active ?? 0}
          loading={queries.jobs.isLoading}
          error={queries.jobs.isError}
          retry={() => void queries.jobs.refetch()}
          metadata={
            queries.jobs.data?.partial
              ? `Partial: first 50 of ${queries.jobs.data.total} managed jobs`
              : 'Published and paused jobs'
          }
          icon={<BriefcaseBusiness />}
        />
        <MetricBoundary
          allowed={applicationsAllowed}
          label="New applications"
          value={queries.newApplications.data ?? 0}
          loading={queries.newApplications.isLoading}
          error={queries.newApplications.isError}
          retry={() => void queries.newApplications.refetch()}
          metadata={`Last ${filters.range} days`}
          icon={<Users />}
        />
        <MetricBoundary
          allowed={interviewsAllowed}
          label="Interviews this week"
          value={queries.weekInterviews.data?.length ?? 0}
          loading={queries.weekInterviews.isLoading}
          error={queries.weekInterviews.isError}
          retry={() => void queries.weekInterviews.refetch()}
          metadata="Current UTC week"
          icon={<CalendarDays />}
        />
        <MetricBoundary
          allowed={can(permissions, owner, 'offers.view')}
          label="Offers pending"
          value={queries.offers.data ?? 0}
          loading={queries.offers.isLoading}
          error={queries.offers.isError}
          retry={() => void queries.offers.refetch()}
          metadata="Current pending approvals"
          icon={<FileText />}
        />
      </section>

      <PipelinePanel allowed={applicationsAllowed} query={queries.pipeline} />

      <div className="tvx-dashboard-workspace-grid">
        <section
          className="tvx-candidates"
          aria-labelledby="candidate-workspace-title"
        >
          <div className="tvx-section-heading">
            <div>
              <h2 id="candidate-workspace-title">
                Active Candidates Workspace
              </h2>
              <p>Applications submitted within the selected dashboard range.</p>
            </div>
          </div>
          {applicationsAllowed ? (
            <>
              <Toolbar
                label="Candidate filters"
                start={
                  <SearchField
                    label="Search candidates"
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onSearch={(value) => update({ q: value.trim() }, true)}
                  />
                }
                end={
                  <div className="tvx-dashboard-filter-actions">
                    <Select
                      label="Filter by stage"
                      value={filters.stage}
                      placeholder="All stages"
                      options={stageOptions}
                      onChange={(event) =>
                        update(
                          {
                            stage: event.target
                              .value as DashboardFilters['stage'],
                          },
                          true,
                        )
                      }
                    />
                    {hasFilters && (
                      <Button variant="quiet" onClick={clearFilters}>
                        Reset filters
                      </Button>
                    )}
                  </div>
                }
              />
              <p className="sr-only" aria-live="polite">
                {queries.applications.isLoading
                  ? 'Loading candidates'
                  : `${pageData?.total ?? 0} candidates found`}
              </p>
              <DataTable
                caption="Candidates in the selected date range"
                rows={rows}
                rowKey={(candidate) => candidate.id}
                columns={columns}
                isLoading={queries.applications.isLoading}
                {...(queries.applications.isError
                  ? { error: 'Candidates could not be loaded.' }
                  : {})}
                empty={
                  hasFilters ? (
                    <FilteredEmptyState
                      title="No candidates match"
                      description="Try a broader search or remove a stage filter."
                      onClear={clearFilters}
                    />
                  ) : (
                    <EmptyState
                      title="No applications yet"
                      description={`No applications were submitted in the last ${filters.range} days.`}
                    />
                  )
                }
                renderNarrow={(candidate) => (
                  <CandidateCard candidate={candidate} />
                )}
                {...(pageData && pageData.pages > 1
                  ? {
                      pagination: {
                        page: pageData.page,
                        totalPages: pageData.pages,
                        onPageChange: (page: number) => update({ page }),
                        ariaLabel: 'Candidate pages',
                      },
                    }
                  : {})}
                rowActions={(candidate) => (
                  <Link
                    className="tvx-dashboard-row-link"
                    to={`/org/applications/${candidate.id}`}
                  >
                    View
                    <span className="sr-only">
                      {' '}
                      {candidate.name}'s application
                    </span>
                    <ChevronRight aria-hidden />
                  </Link>
                )}
              />
              {queries.applications.isError && (
                <Button
                  variant="secondary"
                  onClick={() => void queries.applications.refetch()}
                >
                  Retry candidates
                </Button>
              )}
            </>
          ) : (
            <PermissionState description="Application viewing permission is required for the candidate workspace." />
          )}
        </section>
        <InsightsRail
          pipeline={queries.pipeline.data}
          pipelineAllowed={applicationsAllowed}
          interviews={queries.interviews.data ?? []}
          interviewsAllowed={interviewsAllowed}
          interviewsLoading={queries.interviews.isLoading}
          interviewsError={queries.interviews.isError}
          retryInterviews={() => void queries.interviews.refetch()}
        />
      </div>
    </div>
  );
}

function PipelinePanel({
  allowed,
  query,
}: {
  allowed: boolean;
  query: ReturnType<typeof useDashboardQueries>['pipeline'];
}) {
  if (!allowed)
    return (
      <PermissionState
        title="Hiring pipeline unavailable"
        description="Application viewing permission is required for pipeline data."
      />
    );
  return (
    <Card className="tvx-pipeline-card">
      <div className="tvx-pipeline-heading">
        <h2>Hiring pipeline</h2>
        <p>
          All-time application status, independent of the selected date range.
        </p>
      </div>
      {query.isError ? (
        <ErrorState
          detail="Pipeline data could not be loaded."
          retry={() => void query.refetch()}
        />
      ) : query.isLoading ? (
        <div className="tvx-pipeline-loading" aria-busy="true">
          Loading pipeline…
        </div>
      ) : query.data?.total === 0 ? (
        <EmptyState
          title="No pipeline activity"
          description="Application stages will appear here once candidates apply."
        />
      ) : (
        <ol className="tvx-pipeline">
          {query.data?.stages.map((stage, index) => (
            <li key={stage.id}>
              <span className="tvx-pipeline-node" aria-hidden>
                {index + 1}
              </span>
              <span>
                {stage.label}
                <strong>{stage.count}</strong>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
function CandidateCard({ candidate }: { candidate: CandidateViewModel }) {
  return (
    <article className="tvx-candidate-card">
      <div className="tvx-candidate-identity">
        <Avatar name={candidate.name} />
        <span>
          <strong>{candidate.name}</strong>
          <small>{candidate.role}</small>
        </span>
      </div>
      <dl>
        <div>
          <dt>Deterministic skill match</dt>
          <dd>
            <MatchScore candidate={candidate} />
          </dd>
        </div>
        <div>
          <dt>Stage</dt>
          <dd>
            <StatusTag tone={statusTone(candidate.stage)}>
              {candidate.stageLabel}
            </StatusTag>
          </dd>
        </div>
        <div>
          <dt>Skills</dt>
          <dd>{candidate.skills.join(', ') || 'Not provided'}</dd>
        </div>
      </dl>
    </article>
  );
}
function InsightsRail({
  pipeline,
  pipelineAllowed,
  interviews,
  interviewsAllowed,
  interviewsLoading,
  interviewsError,
  retryInterviews,
}: {
  pipeline: ReturnType<typeof import('./model').toPipeline> | undefined;
  pipelineAllowed: boolean;
  interviews: import('./model').InterviewViewModel[];
  interviewsAllowed: boolean;
  interviewsLoading: boolean;
  interviewsError: boolean;
  retryInterviews: () => void;
}) {
  const attention =
    pipeline?.stages.find((stage) => stage.id === 'screening')?.count ?? 0;
  return (
    <aside className="tvx-insights" aria-labelledby="insights-title">
      <div className="tvx-insights-title">
        <Sparkles aria-hidden />
        <div>
          <h2 id="insights-title">AI Insights</h2>
          <small>Integration boundary</small>
        </div>
      </div>
      <div className="tvx-ai-unavailable">
        <strong>AI unavailable</strong>
        <p>
          No AI insights endpoint is configured. Talvix does not generate or
          infer recommendations here.
        </p>
      </div>
      <section>
        <h3>
          <CircleAlert aria-hidden /> Attention required
        </h3>
        {pipelineAllowed ? (
          <p>
            <strong>{attention}</strong> applications are currently in
            screening. This is an operational count, not an AI recommendation.
          </p>
        ) : (
          <PermissionState description="Application permission is required for operational signals." />
        )}
      </section>
      <section>
        <h3>
          <CalendarDays aria-hidden /> Upcoming interviews
        </h3>
        {!interviewsAllowed ? (
          <PermissionState description="Interview viewing permission is required." />
        ) : interviewsLoading ? (
          <p aria-busy="true">Loading interviews…</p>
        ) : interviewsError ? (
          <ErrorState
            variant="inline"
            detail="Upcoming interviews could not be loaded."
            retry={retryInterviews}
          />
        ) : interviews.length ? (
          <ul className="tvx-interview-list">
            {interviews.slice(0, 4).map((interview) => (
              <li key={interview.id}>
                <time dateTime={interview.startTime}>
                  {formatDateTime(interview.startTime)}
                </time>
                <span>
                  {interview.mode.replaceAll('-', ' ')}
                  {interview.place ? ` · ${interview.place}` : ''}
                </span>
                <StatusTag tone="info">
                  {interview.status.replaceAll('-', ' ')}
                </StatusTag>
              </li>
            ))}
          </ul>
        ) : (
          <p>No interviews in the selected range.</p>
        )}
      </section>
    </aside>
  );
}
function formatDate(value: string | null) {
  if (!value) return 'date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}
