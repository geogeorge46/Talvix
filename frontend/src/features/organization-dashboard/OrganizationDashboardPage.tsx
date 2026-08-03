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
  Building,
  TrendingUp,
  ShieldCheck,
  History,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  PermissionState,
  SearchField,
  Select,
  StatusTag,
  Toolbar,
  type DataColumn,
} from '../../design-system';
import { can, useDashboardQueries, useRecruiterDashboardQuery, useCompanyDashboardQuery } from './api';
import { apiRequest, tokenStore } from '../../api/client';
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
  const recDash = useRecruiterDashboardQuery();
  const compDash = useCompanyDashboardQuery();
  const [activeTab, setActiveTab] = useState<'recruiter' | 'company'>('recruiter');

  // Widget settings
  const [widgets, setWidgets] = useState<Array<{ id: string; visible: boolean; order: number }>>([
    { id: 'metrics', visible: true, order: 0 },
    { id: 'pipeline', visible: true, order: 1 },
    { id: 'workspace', visible: true, order: 2 },
    { id: 'recentActivity', visible: true, order: 3 },
    { id: 'quickActions', visible: true, order: 4 },
    { id: 'insights', visible: true, order: 5 }
  ]);
  const [showPersonalize, setShowPersonalize] = useState(false);

  useEffect(() => {
    apiRequest<{ widgets: Array<{ id: string; visible: boolean; order: number }> }>('/dashboard/widgets')
      .then(res => {
        if (res?.widgets?.length) {
          setWidgets(res.widgets.sort((a, b) => a.order - b.order));
        }
      })
      .catch(err => console.error('Failed to load widgets:', err));
  }, []);

  const handleToggleWidget = (id: string) => {
    const updated = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setWidgets(updated);
    apiRequest('/dashboard/widgets', { method: 'PATCH', body: { widgets: updated } })
      .catch(err => console.error(err));
  };

  const handleMoveWidget = (id: string, direction: 'up' | 'down') => {
    const index = widgets.findIndex(w => w.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === widgets.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const nextWidgets = [...widgets];
    const temp = nextWidgets[index];
    const target = nextWidgets[targetIndex];
    if (!target || !temp) return;
    nextWidgets[index] = target;
    nextWidgets[targetIndex] = temp;

    const updated = nextWidgets.map((w, i) => ({ ...w, order: i }));
    setWidgets(updated);
    apiRequest('/dashboard/widgets', { method: 'PATCH', body: { widgets: updated } })
      .catch(err => console.error(err));
  };

  const handleResetLayout = () => {
    apiRequest<{ widgets: Array<{ id: string; visible: boolean; order: number }> }>('/dashboard/widgets', { method: 'PATCH', body: { reset: true } })
      .then(res => {
        if (res?.widgets?.length) {
          setWidgets(res.widgets.sort((a, b) => a.order - b.order));
        }
      })
      .catch(err => console.error(err));
  };

  // SSE Stream setup
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;

    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';
    const es = new EventSource(`${base}/realtime/stream?token=${token}`);

    const triggerRefetch = () => {
      recDash.refetch();
      compDash.refetch();
      queries.applications.refetch();
      queries.pipeline.refetch();
    };

    es.addEventListener('new_application', triggerRefetch);
    es.addEventListener('interview_status_update', triggerRefetch);
    es.addEventListener('offer_status_update', triggerRefetch);
    es.addEventListener('notification_created', triggerRefetch);

    return () => {
      es.close();
    };
  }, [recDash, compDash, queries.applications, queries.pipeline]);
  const columns: DataColumn<any>[] = [
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
            candidate.skills.map((skill: string) => (
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

      <div className="tvx-tabs" style={{ marginBottom: '1.5rem' }}>
        <div role="tablist" style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid var(--color-border-subtle)', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button
              role="tab"
              data-state={activeTab === 'recruiter' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('recruiter')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 0.5rem' }}
            >
              My Dashboard
            </button>
            <button
              role="tab"
              data-state={activeTab === 'company' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('company')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 0.5rem' }}
            >
              Company Dashboard
            </button>
          </div>
          {activeTab === 'recruiter' && (
            <Button size="compact" variant="quiet" onClick={() => setShowPersonalize(!showPersonalize)} style={{ marginBottom: '0.25rem' }}>
              Layout Settings
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'recruiter' ? (
        <>
          {showPersonalize && (
            <div style={{ marginBottom: '1.5rem', border: '1px dashed var(--color-border-subtle)', borderRadius: '8px', padding: '1rem', background: 'var(--color-bg-surface || #ffffff)' }}>
              <Card heading="Personalize Widgets Layout" headingLevel={2}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  {widgets.map((widget, idx) => (
                    <div key={widget.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', border: '1px solid var(--color-border-subtle)', borderRadius: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                          type="checkbox"
                          id={`check-${widget.id}`}
                          checked={widget.visible}
                          onChange={() => handleToggleWidget(widget.id)}
                        />
                        <label htmlFor={`check-${widget.id}`} style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                          {widget.id.replace(/([A-Z])/g, ' $1')}
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <Button variant="quiet" size="compact" disabled={idx === 0} onClick={() => handleMoveWidget(widget.id, 'up')}>↑ Move Up</Button>
                        <Button variant="quiet" size="compact" disabled={idx === widgets.length - 1} onClick={() => handleMoveWidget(widget.id, 'down')}>↓ Move Down</Button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <Button variant="quiet" onClick={handleResetLayout}>Restore Default Layout</Button>
                    <Button onClick={() => setShowPersonalize(false)}>Close Settings</Button>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {widgets.filter(w => w.visible).length === 0 ? (
            <EmptyState
              title="All widgets hidden"
              description="Customize your layout from the settings drawer to display information."
            />
          ) : (
            <>
              {widgets.find(w => w.id === 'metrics')?.visible && (
                <section className="tvx-dashboard-metrics" aria-label="Hiring metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                  <MetricCard
                    label="Active jobs"
                    value={recDash.data?.data?.metrics.activeJobs ?? 0}
                    icon={<BriefcaseBusiness />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Draft jobs"
                    value={recDash.data?.data?.metrics.draftJobs ?? 0}
                    icon={<BriefcaseBusiness />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Closed jobs"
                    value={recDash.data?.data?.metrics.closedJobs ?? 0}
                    icon={<BriefcaseBusiness />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Total Applications"
                    value={recDash.data?.data?.metrics.totalApplications ?? 0}
                    icon={<Users />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Interviews Scheduled"
                    value={recDash.data?.data?.metrics.interviewsScheduled ?? 0}
                    icon={<CalendarDays />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Offers Sent"
                    value={recDash.data?.data?.metrics.offersSent ?? 0}
                    icon={<FileText />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Candidates Hired"
                    value={recDash.data?.data?.metrics.candidatesHired ?? 0}
                    icon={<Users />}
                    isLoading={recDash.isLoading}
                  />
                  <MetricCard
                    label="Team Members"
                    value={recDash.data?.data?.metrics.teamMembers ?? 0}
                    icon={<Users />}
                    isLoading={recDash.isLoading}
                  />
                </section>
              )}

              {widgets.find(w => w.id === 'pipeline')?.visible && (
                <PipelinePanel allowed={applicationsAllowed} query={queries.pipeline} />
              )}

              <div className="tvx-dashboard-workspace-grid">
                <section
                  className="tvx-candidates"
                  aria-labelledby="candidate-workspace-title"
                >
                  {widgets.find(w => w.id === 'workspace')?.visible && (
                    <>
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
                                  aria-label="Filter by stage"
                                  value={filters.stage}
                                  options={[{ value: '', label: 'All stages' }, ...stageOptions]}
                                  onChange={(event) => update({ stage: event.target.value as any }, true)}
                                />
                                {hasFilters && (
                                  <Button variant="quiet" onClick={() => {
                                    setSearchDraft('');
                                    update({ q: '', stage: '', page: 1 });
                                  }}>
                                    Reset filters
                                  </Button>
                                )}
                              </div>
                            }
                          />
                          {queries.applications.isError ? (
                            <ErrorState
                              detail={(queries.applications.error as Error).message}
                              retry={() => void queries.applications.refetch()}
                            />
                          ) : (
                            <DataTable
                              {...({
                                columns,
                                rows,
                                isLoading: queries.applications.isPending,
                                pagination: pageData && pageData.pages > 1
                                  ? {
                                      page: pageData.page,
                                      totalPages: pageData.pages,
                                      onPageChange: (page: number) => update({ page }),
                                    }
                                  : undefined,
                                emptyState: hasFilters ? (
                                  <FilteredEmptyState
                                    title="No candidates match"
                                    description="Try a broader search or remove a stage filter."
                                    onClear={() => {
                                      setSearchDraft('');
                                      update({ q: '', stage: '', page: 1 });
                                    }}
                                  />
                                ) : (
                                  <EmptyState
                                    title="No applications"
                                    description="Candidates who apply to your managed jobs appear here."
                                  />
                                ),
                                rowActions: (candidate: any) => (
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
                                )
                              } as any)}
                            />
                          )}
                        </>
                      ) : (
                        <PermissionState title="Access denied" description="applications.view is required to view candidate workspace." />
                      )}
                    </>
                  )}

                  {widgets.find(w => w.id === 'recentActivity')?.visible && (
                    <div style={{ marginTop: '2rem' }}>
                      <Card heading="Recent Activity" headingLevel={2}>
                        {recDash.data?.data?.recentActivity?.length ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {recDash.data.data.recentActivity.map((act: any) => (
                              <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid var(--color-border-subtle)', borderRadius: '6px' }}>
                                <div>
                                  <div>{act.description}</div>
                                  <small style={{ color: 'var(--color-text-subtle)' }}>By {act.user}</small>
                                </div>
                                <small style={{ color: 'var(--color-text-subtle)' }}>{formatDateTime(act.timestamp)}</small>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--color-text-subtle)' }}>No recent activity.</p>
                        )}
                      </Card>
                    </div>
                  )}
                </section>

                <aside className="tvx-dashboard-sidebar">
                  {widgets.find(w => w.id === 'quickActions')?.visible && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <Card heading="Quick Actions" headingLevel={2}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                          <Button onClick={() => navigate('/org/jobs/new')}>Create Job</Button>
                          <Button onClick={() => navigate('/org/team')}>Invite Recruiter</Button>
                          <Button onClick={() => navigate('/org/candidates')}>View Candidates</Button>
                          <Button onClick={() => navigate('/org/interviews')}>Schedule Interview</Button>
                          <Button onClick={() => navigate('/org/company')}>Company Settings</Button>
                        </div>
                      </Card>
                    </div>
                  )}

                  {widgets.find(w => w.id === 'insights')?.visible && (
                    <InsightsRail
                      pipeline={queries.pipeline.data}
                      pipelineAllowed={applicationsAllowed}
                      interviews={queries.interviews.data ?? []}
                      interviewsAllowed={interviewsAllowed}
                      interviewsLoading={queries.interviews.isLoading}
                      interviewsError={queries.interviews.isError}
                      retryInterviews={() => void queries.interviews.refetch()}
                    />
                  )}
                </aside>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {compDash.isLoading ? (
            <LoadingState label="Loading company overview" />
          ) : compDash.isError ? (
            <ErrorState detail="Failed to load company dashboard statistics." retry={() => void compDash.refetch()} />
          ) : (
            <>
              <section className="tvx-dashboard-metrics" aria-label="Company Overview" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <MetricCard
                  label="Company Score"
                  value={`${compDash.data?.overview.companyScore}/100`}
                  icon={<Sparkles />}
                />
                <MetricCard
                  label="Verification Status"
                  value={compDash.data?.overview.verificationStatus}
                  icon={<ShieldCheck />}
                />
                <MetricCard
                  label="Active Jobs"
                  value={compDash.data?.overview.activeJobs ?? 0}
                  icon={<BriefcaseBusiness />}
                />
                <MetricCard
                  label="Recruiter Count"
                  value={compDash.data?.overview.recruiterCount ?? 0}
                  icon={<Users />}
                />
                <MetricCard
                  label="Hiring Progress"
                  value={compDash.data?.overview.hiringProgress ?? 0}
                  icon={<TrendingUp />}
                />
              </section>

              <section className="tvx-dashboard-metrics" aria-label="Company Stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <MetricCard
                  label="Applications"
                  value={compDash.data?.statistics.applicationsReceived ?? 0}
                  icon={<FileText />}
                />
                <MetricCard
                  label="Interviews Completed"
                  value={compDash.data?.statistics.interviewsCompleted ?? 0}
                  icon={<CalendarDays />}
                />
                <MetricCard
                  label="Offers Accepted"
                  value={compDash.data?.statistics.offersAccepted ?? 0}
                  icon={<FileText />}
                />
                <MetricCard
                  label="Success Rate"
                  value={`${compDash.data?.statistics.hiringSuccessRate ?? 0}%`}
                  icon={<Sparkles />}
                />
                <MetricCard
                  label="Avg Time to Hire"
                  value={`${compDash.data?.statistics.averageTimeToHire ?? 0} Days`}
                  icon={<History />}
                />
              </section>

              <div className="tvx-dashboard-workspace-grid">
                <section className="tvx-candidates">
                  <Card heading="Company Profile" headingLevel={2}>
                    <DescriptionList
                      items={[
                        { term: 'Industry', description: compDash.data?.overview.industry },
                        { term: 'Company Size', description: compDash.data?.overview.companySize },
                        { term: 'Verification Status', description: compDash.data?.overview.verificationStatus }
                      ]}
                    />
                  </Card>
                </section>

                <aside className="tvx-dashboard-sidebar">
                  <Card heading="Team Summary" headingLevel={2}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>Primary Admin</strong>
                        {compDash.data?.teamSummary.primary_admin.length ? (
                          compDash.data.teamSummary.primary_admin.map((u: any) => <div key={u._id}>{u.fullName} ({u.email})</div>)
                        ) : (
                          <div>None</div>
                        )}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>HR Admins</strong>
                        {compDash.data?.teamSummary.hr_admin.length ? (
                          compDash.data.teamSummary.hr_admin.map((u: any) => <div key={u._id}>{u.fullName} ({u.email})</div>)
                        ) : (
                          <div>None</div>
                        )}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>Recruiters</strong>
                        {compDash.data?.teamSummary.recruiter.length ? (
                          compDash.data.teamSummary.recruiter.map((u: any) => <div key={u._id}>{u.fullName} ({u.email})</div>)
                        ) : (
                          <div>None</div>
                        )}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--color-text-subtle)' }}>Hiring Managers</strong>
                        {compDash.data?.teamSummary.hiring_manager.length ? (
                          compDash.data.teamSummary.hiring_manager.map((u: any) => <div key={u._id}>{u.fullName} ({u.email})</div>)
                        ) : (
                          <div>None</div>
                        )}
                      </div>
                    </div>
                  </Card>
                </aside>
              </div>
            </>
          )}
        </>
      )}
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
