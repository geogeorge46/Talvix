import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  Layers,
  CheckCircle2,
  Plus,
  Search,
  X,
  RotateCcw,
  FileEdit,
  Archive,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  FileText,
  Video,
  Phone,
  MapPin,
  User,
  Download,
  ExternalLink,
  CalendarX,
  Sparkles,
  Copy,
} from 'lucide-react';
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
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
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import { useCompany } from '../organization-admin/api';
import {
  useProcess,
  useProcessAction,
  useRoundAction,
  useProcesses,
  useTemplate,
  useTemplateAction,
  useTemplates,
  useTemplateSave,
  useCalendar,
} from './api';
import {
  formatZoned,
  isoToDatetimeLocal,
  label,
  type CandidateProcess,
  type Process,
  type RoundPlan,
  type Template,
  type SafeSchedule,
  zonedLocalToIso,
} from './model';
import './interviews.css';
const has = (p: string[], v: string) => p.includes(v),
  oid = /^[a-f\d]{24}$/i;
const err = (e: unknown) =>
  e instanceof Error ? e.message : 'The request could not be completed.';
const tone = (s: string) =>
  ['completed', 'confirmed', 'accepted', 'active'].includes(s)
    ? 'success'
    : ['cancelled', 'no-show', 'declined'].includes(s)
      ? 'danger'
      : ['reschedule-requested', 'awaiting-feedback', 'proposed'].includes(s)
        ? 'warning'
        : 'neutral';
export function InterviewTabs() {
  return (
    <nav className="ats-nav-tabs-wrapper" aria-label="Interview sections">
      <div className="ats-nav-tabs">
        <NavLink
          to="/org/interviews"
          end
          className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Briefcase size={15} />
          <span>Processes</span>
        </NavLink>
        <NavLink
          to="/org/interviews/calendar"
          className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Calendar size={15} />
          <span>Calendar</span>
        </NavLink>
        <NavLink
          to="/org/interviews/templates"
          className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Layers size={15} />
          <span>Templates</span>
        </NavLink>
        <NavLink
          to="/org/interviews/feedback"
          className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}
        >
          <CheckCircle2 size={15} />
          <span>Scorecards</span>
        </NavLink>
        <NavLink
          to="/org/interviews/new"
          className={({ isActive }) => `ats-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Plus size={15} />
          <span>Create process</span>
        </NavLink>
      </div>
    </nav>
  );
}
function Rail({
  rounds,
  definition = false,
}: {
  rounds: (RoundPlan | CandidateProcess['rounds'][number])[];
  definition?: boolean;
}) {
  return (
    <section className="iv-rail" aria-labelledby="round-timeline">
      <div className="iv-rail__head">
        <h2 id="round-timeline">
          {definition ? 'Interview definition' : 'Process timeline'}
        </h2>
        <span>{rounds.length} rounds</span>
      </div>
      {definition && (
        <Alert tone="info" title="Definition snapshot">
          This ordered plan is immutable. Live round status, interviewer
          assignment and scheduling are unavailable from this recruiter
          endpoint.
        </Alert>
      )}
      <ol>
        {[...rounds]
          .sort((a, b) => a.order - b.order)
          .map((r, i) => (
            <li key={r.id || `${r.name}-${i}`}>
              <span className="iv-rail__number">{i + 1}</span>
              <div>
                <strong>{r.name}</strong>
                <p>
                  {label(r.type)}
                  {'durationMinutes' in r
                    ? ` · ${r.durationMinutes} minutes`
                    : ''}
                </p>
                {'status' in r && (
                  <StatusTag tone={tone(r.status)}>{label(r.status)}</StatusTag>
                )}
              </div>
            </li>
          ))}
      </ol>
    </section>
  );
}
function TemplateCard({ t }: { t: Template }) {
  const codeBadge = `#TPL-${t.id.slice(-6).toUpperCase()}`;
  return (
    <article className="iv-record" style={{ borderRadius: '12px', padding: '16px' }}>
      <div className="job-entity-info" style={{ flex: 1 }}>
        <div className="job-entity-title-row">
          <strong style={{ fontSize: '0.9375rem' }}>{t.name}</strong>
          <span className="job-code-badge">{codeBadge}</span>
        </div>
        <small style={{ color: '#64748b' }}>
          {t.rounds.length} rounds · used {t.usageCount} times
        </small>
      </div>
      <span className={`job-status-pill job-status-pill--${t.isActive ? 'success' : 'neutral'}`}>
        <span className={`job-status-dot job-status-dot--${t.isActive ? 'success' : 'neutral'}`} />
        {t.isActive ? 'Active' : 'Inactive'}
      </span>
      <Link
        className="tvx-button tvx-button--secondary tvx-button--sm"
        to={`/org/interviews/templates/${t.id}`}
        style={{ height: '30px', borderRadius: '9999px', fontSize: '0.78125rem' }}
      >
        Open
      </Link>
    </article>
  );
}
export function TemplatesPage() {
  const { recruiter } = useAuth();
  const view = has(recruiter?.permissions ?? [], 'interviews.view');
  const manage = has(recruiter?.permissions ?? [], 'interviews.manage');
  const [p, setP] = useSearchParams();

  const currentPage = Number(p.get('page')) || 1;
  const currentSearch = p.get('search') || '';
  const currentStatus = p.get('status') || '';

  const [searchDraft, setSearchDraft] = useState(currentSearch);

  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  const queryStr = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', '10');
    params.set('sort', 'newest');
    if (currentSearch) params.set('search', currentSearch);
    if (currentStatus) params.set('status', currentStatus);
    return params.toString();
  }, [currentPage, currentSearch, currentStatus]);

  const q = useTemplates(queryStr, view);

  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );

  const items = (q.data?.items ?? []) as Template[];
  const totalItems = q.data?.total ?? items.length;
  const activeCount = items.filter((t) => t.isActive).length;
  const reusableCount = items.filter((t) => t.isReusable).length;
  const totalRounds = items.reduce((acc, t) => acc + (t.rounds?.length || 0), 0);
  const maxUsage = items.length ? Math.max(...items.map((t) => t.usageCount || 0)) : 0;

  const hasFilters = Boolean(currentSearch || currentStatus);

  const updateFilters = (patch: { search?: string; status?: string; page?: number }) => {
    const next = new URLSearchParams(p);
    if (patch.search !== undefined) {
      if (patch.search) next.set('search', patch.search);
      else next.delete('search');
    }
    if (patch.status !== undefined) {
      if (patch.status) next.set('status', patch.status);
      else next.delete('status');
    }
    if (patch.page !== undefined) {
      if (patch.page > 1) next.set('page', String(patch.page));
      else next.delete('page');
    } else {
      next.delete('page');
    }
    setP(next, { replace: true });
  };

  return (
    <div className="iv-page">
      <PageHeader
        title="Interview templates"
        description="Reusable, ordered interview plans and scorecard definitions."
        secondaryActions={<InterviewTabs />}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to="/org/interviews/templates/new"
            >
              <Plus size={16} /> Create template
            </Link>
          ) : undefined
        }
      />

      <div className="ats-metrics-grid">
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box"><Layers size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">Catalog</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Total Templates</span>
            <span className="ats-metric-card__val">{totalItems}</span>
            <span className="ats-metric-card__sub">Structured interview plans</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#10b981' }}><CheckCircle2 size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--success">Ready</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Active Plans</span>
            <span className="ats-metric-card__val">{activeCount}</span>
            <span className="ats-metric-card__sub">Deployed across workflows</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#0284c7' }}><Copy size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--info">Multi-Use</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Reusable Plans</span>
            <span className="ats-metric-card__val">{reusableCount}</span>
            <span className="ats-metric-card__sub">Clonable template definitions</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#6366f1' }}><Briefcase size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">Stages</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Total Rounds</span>
            <span className="ats-metric-card__val">{totalRounds}</span>
            <span className="ats-metric-card__sub">Defined evaluation stages</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#f59e0b' }}><Sparkles size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--warning">Popularity</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Top Usage</span>
            <span className="ats-metric-card__val">{maxUsage}</span>
            <span className="ats-metric-card__sub">Max active process runs</span>
          </div>
        </div>
      </div>

      <Toolbar
        label="Template filters"
        start={
          <SearchField
            label="Search templates"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={(value) => updateFilters({ search: value.trim(), page: 1 })}
          />
        }
        end={
          <div className="tvx-dashboard-filter-actions">
            <Select
              aria-label="Filter by status"
              value={currentStatus}
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              onChange={(e) => updateFilters({ status: e.target.value, page: 1 })}
            />
            {hasFilters && (
              <Button
                variant="quiet"
                onClick={() => {
                  setSearchDraft('');
                  setP({}, { replace: true });
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        }
      />

      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <div className="ats-table-card">
          <DataTable
            caption="Interview templates"
            rows={items}
            rowKey={(x) => x.id}
            isLoading={q.isLoading}
            pagination={
              q.data && q.data.pages > 1
                ? {
                    page: q.data.page,
                    totalPages: q.data.pages,
                    onPageChange: (page) => updateFilters({ page }),
                  }
                : undefined
            }
            empty={
              hasFilters ? (
                <FilteredEmptyState
                  title="No matching templates"
                  description="Adjust your search query or status filter."
                  onClear={() => {
                    setSearchDraft('');
                    setP({}, { replace: true });
                  }}
                />
              ) : (
                <EmptyState
                  title="No templates yet"
                  description="Create a structured interview plan to standardize candidate evaluations."
                />
              )
            }
            columns={[
              {
                id: 'name',
                header: 'Template',
                render: (x) => {
                  const codeBadge = `#TPL-${x.id.slice(-6).toUpperCase()}`;
                  return (
                    <div className="job-entity-cell">
                      <div className="job-entity-icon">
                        <Layers size={18} />
                      </div>
                      <div className="job-entity-info">
                        <div className="job-entity-title-row">
                          <Link to={`/org/interviews/templates/${x.id}`} className="job-entity-title">
                            {x.name}
                          </Link>
                          <span className="job-code-badge">{codeBadge}</span>
                        </div>
                        <div className="job-entity-meta">
                          <span>{x.description || 'No description provided'}</span>
                        </div>
                      </div>
                    </div>
                  );
                },
              },
              {
                id: 'rounds',
                header: 'Rounds',
                render: (x) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <Badge variant="neutral">
                      {x.rounds?.length || 0} {x.rounds?.length === 1 ? 'round' : 'rounds'}
                    </Badge>
                    {x.rounds?.slice(0, 2).map((r) => (
                      <span
                        key={r.id || r.name}
                        style={{
                          fontSize: '0.75rem',
                          color: '#64748b',
                          background: '#f8fafc',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {r.name}
                      </span>
                    ))}
                    {x.rounds && x.rounds.length > 2 && (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        +{x.rounds.length - 2} more
                      </span>
                    )}
                  </div>
                ),
              },
              {
                id: 'usage',
                header: 'Usage',
                render: (x) => (
                  <Badge variant={x.usageCount > 0 ? 'accent' : 'neutral'}>
                    {x.usageCount || 0} {x.usageCount === 1 ? 'process' : 'processes'}
                  </Badge>
                ),
              },
              {
                id: 'status',
                header: 'Status',
                render: (x) => (
                  <span className={`job-status-pill job-status-pill--${x.isActive ? 'success' : 'neutral'}`}>
                    <span className={`job-status-dot job-status-dot--${x.isActive ? 'success' : 'neutral'}`} />
                    {x.isActive ? 'Active' : 'Inactive'}
                  </span>
                ),
              },
            ]}
            renderNarrow={(x) => <TemplateCard t={x} />}
            rowActions={(x) => (
              <Link
                className="tvx-button tvx-button--secondary tvx-button--sm"
                to={`/org/interviews/templates/${x.id}`}
                style={{ height: '30px', borderRadius: '9999px', fontSize: '0.78125rem' }}
              >
                Open
              </Link>
            )}
          />
        </div>
      )}
    </div>
  );
}
export function TemplateDetailPage() {
  const { templateId = '' } = useParams(),
    { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    q = useTemplate(templateId, view && oid.test(templateId)),
    action = useTemplateAction(templateId),
    nav = useNavigate();
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading interview template" />;
  if (q.isError || !q.data) return <ErrorState detail={err(q.error)} />;
  const t = q.data;
  return (
    <div className="iv-page">
      <PageHeader
        title={t.name}
        description={t.description || 'Reusable interview definition.'}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to={`/org/interviews/templates/${t.id}/edit`}
            >
              Edit template
            </Link>
          ) : undefined
        }
      />
      <Card heading="Template details" headingLevel={2}>
        <DescriptionList
          items={[
            { term: 'Status', description: t.isActive ? 'Active' : 'Inactive' },
            { term: 'Usage', description: `${t.usageCount} processes` },
            { term: 'Reusable', description: t.isReusable ? 'Yes' : 'No' },
          ]}
        />
        {manage && (
          <div className="iv-actions">
            <Button
              variant="secondary"
              loading={action.isPending}
              onClick={() =>
                void action
                  .mutateAsync('clone')
                  .then(() => nav('/org/interviews/templates'))
              }
            >
              Clone
            </Button>
            <Button
              variant="danger"
              disabled={!t.isActive}
              onClick={() => void action.mutateAsync('delete')}
            >
              Deactivate
            </Button>
          </div>
        )}
      </Card>
      <Rail rounds={t.rounds} />
      {t.rounds.map((r) => (
        <Card
          key={r.id}
          heading={`${r.order + 1}. ${r.name}`}
          headingLevel={2}
          description={`${label(r.type)} · ${r.durationMinutes} minutes`}
        >
          <ul className="iv-criteria">
            {r.criteria.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span>
                  {label(c.category)} · {c.weight} weight · max {c.maximumScore}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
export function TemplateFormPage() {
  const { templateId } = useParams(),
    edit = Boolean(templateId),
    { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.manage'),
    q = useTemplate(templateId ?? '', edit && can);
  if (!can)
    return (
      <PermissionState description="The interviews.manage permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading template" />;
  return q.data ? <TemplateEditor existing={q.data} /> : <TemplateEditor />;
}
function TemplateEditor({ existing }: { existing?: Template }) {
  const nav = useNavigate();
  const [name, setName] = useState(existing?.name ?? ''),
    [description, setDescription] = useState(existing?.description ?? ''),
    [rounds, setRounds] = useState<RoundPlan[]>(
      existing?.rounds ?? [
        {
          id: 'new-1',
          name: 'Screening',
          description: '',
          type: 'screening',
          durationMinutes: 30,
          order: 0,
          required: true,
          criteria: [
            {
              id: 'communication',
              name: 'Communication',
              category: 'communication',
              weight: 1,
              maximumScore: 5,
              required: true,
            },
          ],
        },
      ],
    );
  const save = useTemplateSave(existing?.id);
  const move = (i: number, d: number) => {
    const n = [...rounds],
      j = i + d;
    if (j < 0 || j >= n.length) return;
    const current = n[i],
      target = n[j];
    if (!current || !target) return;
    n[i] = target;
    n[j] = current;
    setRounds(n.map((r, k) => ({ ...r, order: k })));
  };
  return (
    <form
      className="iv-page"
      onSubmit={(e) => {
        e.preventDefault();
        void save
          .mutateAsync({
            name,
            description,
            isReusable: true,
            rounds: rounds.map((r) => ({
              name: r.name,
              description: r.description,
              type: r.type,
              durationMinutes: r.durationMinutes,
              order: r.order,
              required: r.required,
              scorecardTemplate: { criteria: r.criteria },
              defaultInterviewers: [],
              minimumInterviewers: 1,
              maximumInterviewers: 1,
            })),
          })
          .then(() => nav('/org/interviews/templates'));
      }}
    >
      <PageHeader
        title={
          existing ? 'Edit interview template' : 'Create interview template'
        }
        description="Build an ordered, keyboard-operable interview plan."
      />
      <Card heading="Template details" headingLevel={2}>
        <TextField
          required
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Card>
      <Card
        heading="Rounds"
        headingLevel={2}
        description="Use Move up and Move down; dragging is never required."
      >
        <ol className="iv-editor-rounds">
          {rounds.map((r, i) => (
            <li key={r.id}>
              <TextField
                label={`Round ${i + 1} name`}
                value={r.name}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <Select
                label="Type"
                value={r.type}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i ? { ...x, type: e.target.value } : x,
                    ),
                  )
                }
                options={[
                  'screening',
                  'technical',
                  'coding',
                  'behavioral',
                  'managerial',
                  'hr',
                  'culture-fit',
                  'case-study',
                  'final',
                  'other',
                ].map((x) => ({ value: x, label: label(x) }))}
              />
              <TextField
                type="number"
                min="10"
                max="480"
                label="Duration (minutes)"
                value={String(r.durationMinutes)}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i
                        ? { ...x, durationMinutes: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <div className="iv-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!i}
                  onClick={() => move(i, -1)}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={i === rounds.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Move down
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {save.isError && (
          <Alert tone="danger" title="Could not save">
            {err(save.error)}
          </Alert>
        )}
        <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
          Save template
        </Button>
      </Card>
    </form>
  );
}

function formatDateTimeParts(dateStr?: string) {
  if (!dateStr) return { date: '-', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '-', time: '' };
    const dateFormatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return { date: '-', time: '' };
  }
}

export function ProcessesPage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'interviews.view');
  const manage = has(recruiter?.permissions ?? [], 'interviews.manage');
  const [p, setP] = useSearchParams();

  const search = p.get('search') || '';
  const statusFilter = p.get('status') || '';
  const sort = p.get('sort') || 'newest';
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = 10;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Paginated query for table
  const queryStr = `page=${page}&limit=${limit}&sort=${sort}${
    search ? `&search=${encodeURIComponent(search)}` : ''
  }${statusFilter ? `&status=${statusFilter}` : ''}`;
  const q = useProcesses(queryStr, can);

  // Query for metric summary cards
  const allQ = useProcesses('limit=50&sort=newest', can);

  if (!can) {
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  }

  const items = (q.data?.items ?? []) as Process[];
  const totalItems = q.data?.pagination?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const allItems = (allQ.data?.items ?? []) as Process[];
  const totalProcesses = allQ.data?.pagination?.total ?? allItems.length;
  const activeCount = allItems.filter((x) => x.status === 'active').length;
  const draftCount = allItems.filter((x) => x.status === 'draft').length;
  const completedCount = allItems.filter((x) => x.status === 'completed').length;
  const cancelledCount = allItems.filter((x) => x.status === 'cancelled' || x.status === 'archived').length;

  const startIdx = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalItems);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((x) => x.id)));
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
    const n = new URLSearchParams(p);
    n.set('page', String(newPage));
    setP(n);
  };

  const handleClearFilters = () => {
    const n = new URLSearchParams();
    setP(n);
    setSelectedIds(new Set());
  };

  const isFiltered = Boolean(search || statusFilter || sort !== 'newest');

  return (
    <div className="iv-page">
      {/* Header & Sub-Navigation Pill Tabs */}
      <PageHeader
        title="Interview processes"
        description="Track structured interview plans, candidates, scorecards and timeline execution."
        secondaryActions={<InterviewTabs />}
        primaryAction={
          manage ? (
            <Link className="iv-btn-black" to="/org/interviews/new">
              <Plus size={16} />
              Create Process
            </Link>
          ) : undefined
        }
      />

      {/* 5 Metrics Cards Grid */}
      <div className="iv-metrics-grid">
        <div className="iv-metric-card">
          <div className="iv-metric-card__header">
            <div className="iv-metric-icon-box">
              <Briefcase size={20} />
            </div>
            <span className="iv-metric-badge iv-metric-badge--success">
              • Configured
            </span>
          </div>
          <div className="iv-metric-card__body">
            <span className="iv-metric-card__label">Total Processes</span>
            <strong className="iv-metric-card__val">{totalProcesses}</strong>
            <span className="iv-metric-card__sub">Interview pipelines</span>
          </div>
        </div>

        <div className="iv-metric-card">
          <div className="iv-metric-card__header">
            <div className="iv-metric-icon-box">
              <CheckCircle2 size={20} />
            </div>
            <span className="iv-metric-badge iv-metric-badge--success">
              • Active
            </span>
          </div>
          <div className="iv-metric-card__body">
            <span className="iv-metric-card__label">Active Execution</span>
            <strong className="iv-metric-card__val" style={{ color: '#059669' }}>
              {activeCount}
            </strong>
            <span className="iv-metric-card__sub">Live candidate rounds</span>
          </div>
        </div>

        <div className="iv-metric-card">
          <div className="iv-metric-card__header">
            <div className="iv-metric-icon-box">
              <FileEdit size={20} />
            </div>
            <span className="iv-metric-badge iv-metric-badge--warning">
              • In Progress
            </span>
          </div>
          <div className="iv-metric-card__body">
            <span className="iv-metric-card__label">Draft Processes</span>
            <strong className="iv-metric-card__val" style={{ color: '#d97706' }}>
              {draftCount}
            </strong>
            <span className="iv-metric-card__sub">Under configuration</span>
          </div>
        </div>

        <div className="iv-metric-card">
          <div className="iv-metric-card__header">
            <div className="iv-metric-icon-box">
              <Award size={20} />
            </div>
            <span className="iv-metric-badge iv-metric-badge--info">
              • Completed
            </span>
          </div>
          <div className="iv-metric-card__body">
            <span className="iv-metric-card__label">Finished</span>
            <strong className="iv-metric-card__val" style={{ color: '#0284c7' }}>
              {completedCount}
            </strong>
            <span className="iv-metric-card__sub">Evaluated & closed</span>
          </div>
        </div>

        <div className="iv-metric-card">
          <div className="iv-metric-card__header">
            <div className="iv-metric-icon-box">
              <Archive size={20} />
            </div>
            <span className="iv-metric-badge iv-metric-badge--neutral">
              • Inactive
            </span>
          </div>
          <div className="iv-metric-card__body">
            <span className="iv-metric-card__label">Cancelled / Archived</span>
            <strong className="iv-metric-card__val" style={{ color: '#475569' }}>
              {cancelledCount}
            </strong>
            <span className="iv-metric-card__sub">Historical records</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="iv-modern-toolbar">
        <div className="iv-toolbar-filters">
          <div className="iv-filter-group">
            <span className="iv-filter-label">Search</span>
            <div className="iv-search-container">
              <Search className="iv-search-icon" size={16} />
              <input
                type="text"
                className="iv-search-input"
                placeholder="Search processes by application, ID..."
                value={search}
                onChange={(e) => {
                  const n = new URLSearchParams(p);
                  if (e.target.value) n.set('search', e.target.value);
                  else n.delete('search');
                  n.set('page', '1');
                  setP(n);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="iv-search-clear"
                  onClick={() => {
                    const n = new URLSearchParams(p);
                    n.delete('search');
                    n.set('page', '1');
                    setP(n);
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="iv-filter-group">
            <span className="iv-filter-label">Status</span>
            <select
              className="iv-pill-select"
              value={statusFilter}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                if (e.target.value) n.set('status', e.target.value);
                else n.delete('status');
                n.set('page', '1');
                setP(n);
              }}
            >
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="iv-filter-group">
            <span className="iv-filter-label">Sort By</span>
            <select
              className="iv-pill-select"
              value={sort}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                n.set('sort', e.target.value);
                setP(n);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
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

        <div className="iv-toolbar-actions">
          {manage && (
            <Link className="iv-btn-black" to="/org/interviews/new">
              <Plus size={16} />
              Create Process
            </Link>
          )}
        </div>
      </div>

      {/* Modern Data Table Card */}
      <div className="iv-table-card">
        {q.isError ? (
          <div className="p-6">
            <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
          </div>
        ) : q.isLoading ? (
          <div className="p-12">
            <LoadingState label="Loading interview processes..." />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            {isFiltered ? (
              <FilteredEmptyState
                title="No matching processes found"
                description="Try clearing search keywords or status filters."
                onClear={handleClearFilters}
              />
            ) : (
              <EmptyState
                title="No interview processes defined yet"
                description="Create one from an eligible candidate application."
              />
            )}
          </div>
        ) : (
          <>
            <div className="iv-table-wrapper">
              <table className="iv-modern-table" aria-label="Interview processes table">
                <thead>
                  <tr>
                    <th scope="col" className="iv-checkbox-cell">
                      <input
                        type="checkbox"
                        className="iv-custom-checkbox"
                        aria-label="Select all processes"
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col">Process ID</th>
                    <th scope="col">Application / Candidate</th>
                    <th scope="col">Status</th>
                    <th scope="col">Plan & Rounds</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((x) => {
                    const isSelected = selectedIds.has(x.id);
                    const dt = formatDateTimeParts(x.createdAt);
                    const shortCode = `#PRC-${x.id.slice(-6).toUpperCase()}`;
                    const roundCount = x.rounds?.length ?? 0;

                    return (
                      <tr key={x.id} className={isSelected ? 'is-selected' : undefined}>
                        <td className="iv-checkbox-cell">
                          <input
                            type="checkbox"
                            className="iv-custom-checkbox"
                            aria-label={`Select process for application ${x.applicationId}`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(x.id)}
                          />
                        </td>
                        <td>
                          <span className="iv-code-badge">{shortCode}</span>
                        </td>
                        <td>
                          <div className="iv-entity-cell">
                            <div className="iv-entity-icon">
                              <Briefcase size={18} />
                            </div>
                            <div className="iv-entity-info">
                              <Link
                                to={`/org/interviews/${x.id}`}
                                className="iv-entity-title"
                              >
                                Application #{x.applicationId.slice(-8).toUpperCase()}
                              </Link>
                              <span className="iv-entity-meta">
                                <span>{roundCount} rounds configured</span>
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`iv-status-pill iv-status-pill--${
                              x.status === 'active'
                                ? 'active'
                                : x.status === 'completed'
                                ? 'completed'
                                : x.status === 'draft'
                                ? 'draft'
                                : 'cancelled'
                            }`}
                          >
                            <span className="iv-status-dot" />
                            {label(x.status)}
                          </span>
                        </td>
                        <td>
                          <div className="iv-entity-meta">
                            <Layers size={14} />
                            <span>{roundCount} {roundCount === 1 ? 'Round' : 'Rounds'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="iv-date-cell">
                            <span className="iv-date-main">{dt.date}</span>
                            {dt.time && <span className="iv-date-sub">{dt.time}</span>}
                          </div>
                        </td>
                        <td>
                          <Link
                            className="iv-action-link"
                            to={`/org/interviews/${x.id}`}
                          >
                            Open Process
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="iv-pagination-footer">
              <span className="iv-pagination-info">
                Showing <strong>{startIdx}</strong> to <strong>{endIdx}</strong> of{' '}
                <strong>{totalItems}</strong> processes
              </span>
              {totalPages > 1 && (
                <div className="iv-pagination-controls">
                  <button
                    type="button"
                    className="iv-page-btn"
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
                      className={`iv-page-btn ${pNum === page ? 'iv-page-btn--active' : ''}`}
                      onClick={() => handlePageChange(pNum)}
                    >
                      {pNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="iv-page-btn"
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
export function ProcessDetailPage() {
  const { processId = '' } = useParams(),
    { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    schedule = has(recruiter?.permissions ?? [], 'interviews.schedule'),
    evaluate = has(recruiter?.permissions ?? [], 'interviews.evaluate'),
    q = useProcess(processId, view && oid.test(processId)),
    action = useProcessAction(processId),
    [reason, setReason] = useState(''),
    [recommendation, setRecommendation] = useState('hire');
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading interview process" />;
  if (q.isError || !q.data)
    return <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <div className="iv-page">
      <PageHeader
        title={p.candidateName ? `Interview Process: ${p.candidateName}` : "Interview runbook"}
        description={`${p.candidateName ? `Candidate: ${p.candidateName}` : `Candidate ID: ${p.candidateId}`}${p.jobTitle ? ` · Job: ${p.jobTitle}` : ''} · Application ${p.applicationId}`}
        secondaryActions={
          <StatusTag tone={tone(p.status)}>{label(p.status)}</StatusTag>
        }
      />
      {p.status === 'cancelled' && (
        <Alert tone="danger" title="Process cancelled">
          {p.cancellationReason || 'This process is cancelled.'}
        </Alert>
      )}
      <div className="iv-split">
        <Card heading="Process control" headingLevel={2}>
          <DescriptionList
            items={[
              { term: 'Candidate Name', description: p.candidateName || p.candidateId },
              { term: 'Candidate Email', description: p.candidateEmail || 'Not provided' },
              { term: 'Job Title', description: p.jobTitle || p.jobId },
              {
                term: 'Feedback',
                description: p.feedbackReleased ? 'Released' : 'Not released',
              },
              {
                term: 'Recommendation',
                description: label(p.overallRecommendation || 'pending'),
              },
            ]}
          />
          {manage && (
            <div className="iv-actions">
              {['draft', 'active'].includes(p.status) && (
                <ConfirmDialog title="Cancel interview process?" description={<TextArea required label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />} confirmLabel="Cancel process" variant="destructive" onConfirm={() => action.mutateAsync({ action: 'cancel', body: { reason } })} trigger={<Button variant="danger">Cancel process</Button>} />
              )}
              {p.status === 'completed' && !p.feedbackReleased && (
                <ConfirmDialog title="Release feedback to the candidate?" description="Candidate-visible feedback becomes available immediately." confirmLabel="Release feedback" onConfirm={() => action.mutateAsync({ action: 'release-feedback' })} trigger={<Button>Release feedback</Button>} />
              )}
              {['completed', 'cancelled'].includes(p.status) && (
                <ConfirmDialog title="Archive this process?" description="It will leave the active recruiter workspace." confirmLabel="Archive" onConfirm={() => action.mutateAsync({ action: 'archive' })} trigger={<Button variant="secondary">Archive</Button>} />
              )}
            </div>
          )}
        </Card>
        <Card heading="Final decision" headingLevel={2}>
          {p.status === 'completed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Alert tone="success" title="Interview process completed">
                Final Recommendation: <strong>{label(p.overallRecommendation || 'hire')}</strong>
              </Alert>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                Next Steps in Hiring Pipeline:
              </p>
              <div className="iv-actions" style={{ marginTop: 0 }}>
                <Link to={`/org/applications/${p.applicationId}`} className="tvx-button tvx-button--secondary">
                  View ATS Application ↗
                </Link>
                <Link to={`/org/offers/new?applicationId=${p.applicationId}`} className="tvx-button">
                  Create Job Offer 📄↗
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p>Finalize only after every required round is completed or skipped.</p>
              {manage && !['completed', 'cancelled', 'archived'].includes(p.status) && <>
                <Select label="Recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} options={['strong-hire','hire','neutral','no-hire','strong-no-hire'].map((value) => ({ value, label: label(value) }))} />
                <TextArea required label="Decision or override reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                <ConfirmDialog title="Finalize interview process?" description="This computes the aggregate result and completes the process." confirmLabel="Finalize" onConfirm={() => action.mutateAsync({ action: 'finalize', body: { recommendation, reason } })} trigger={<Button disabled={!reason}>Finalize process</Button>} />
              </>}
            </>
          )}
        </Card>
      </div>
      {action.isError && <Alert tone="danger" title="Process action failed">{err(action.error)}</Alert>}
      <section className="iv-runbook" aria-label="Live interview rounds">
        <header><h2>Round timeline</h2><p>Live state from the interview service</p></header>
        <ol>
          {p.rounds.map((round, index) => <LiveRound key={round.id} processId={p.id} round={round} index={index} canSchedule={schedule} canEvaluate={evaluate} />)}
        </ol>
      </section>
    </div>
  );
}

function LiveRound({ processId, round, index, canSchedule, canEvaluate }: { processId: string; round: RoundPlan; index: number; canSchedule: boolean; canEvaluate: boolean }) {
  const action = useRoundAction(processId, round.id);
  const { user } = useAuth();
  const defaultUserId = user?._id || user?.id || '';
  const [open, setOpen] = useState(false), [reason, setReason] = useState(''), [party, setParty] = useState('candidate'), [formError, setFormError] = useState('');
  const [interviewers, setInterviewers] = useState((round.interviewerIds && round.interviewerIds.length > 0) ? round.interviewerIds.join(', ') : defaultUserId);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timezone, setTimezone] = useState(round.schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [start, setStart] = useState(''), [mode, setMode] = useState(round.schedule?.mode || 'video');
  const [provider, setProvider] = useState(round.schedule?.meetingProvider || 'custom'), [details, setDetails] = useState(round.schedule?.meetingUrl || '');

  useEffect(() => {
    if (!interviewers && defaultUserId) {
      setInterviewers(defaultUserId);
    }
  }, [defaultUserId, interviewers]);

  useEffect(() => {
    if (open && round.schedule?.startTime) {
      setStart(isoToDatetimeLocal(round.schedule.startTime, timezone));
    }
  }, [open, round.schedule, timezone]);

  const companyQuery = useCompany(open && canSchedule, true);
  const teamMembers = (companyQuery.data?.team ?? []).filter((m) => m.status === 'active');

  const interviewerOptions = [
    { value: defaultUserId, label: `Me (${user?.fullName || 'Current Recruiter'})` },
    ...teamMembers
      .filter((m) => m.recruiterId && m.recruiterId !== defaultUserId)
      .map((m) => ({
        value: m.recruiterId,
        label: `${m.fullName || 'Team Member'} (${m.email || m.role})`,
      })),
  ];

  const scheduled = Boolean(round.schedule), isActive = ['scheduled', 'in-progress', 'awaiting-feedback'].includes(round.status ?? '');
  const detailsRequired = mode !== 'video' || provider === 'custom';
  const submitSchedule = () => {
    setFormError('');
    let startIso = '';
    try { startIso = zonedLocalToIso(start, timezone); } catch (cause) { setFormError(err(cause)); return Promise.reject(cause); }
    if (mode === 'video' && provider === 'custom' && !/^https:\/\//i.test(details)) { const cause = new Error('Enter a valid HTTPS meeting URL.'); setFormError(cause.message); return Promise.reject(cause); }
    if (mode === 'video' && provider !== 'custom' && details && !/^https:\/\//i.test(details)) { const cause = new Error('Enter a valid HTTPS meeting URL.'); setFormError(cause.message); return Promise.reject(cause); }
    const startTime = new Date(startIso), endTime = new Date(startTime.getTime() + round.durationMinutes * 60000);
    let selectedInterviewers = interviewers.split(',').map((x) => x.trim()).filter(Boolean);
    if (selectedInterviewers.length === 0 && defaultUserId) {
      selectedInterviewers = [defaultUserId];
    }
    if (selectedInterviewers.length === 0) {
      const cause = new Error('Please select at least one interviewer.');
      setFormError(cause.message);
      return Promise.reject(cause);
    }
    const body: Record<string, unknown> = { interviewerIds: selectedInterviewers, timezone, startTime: startTime.toISOString(), endTime: endTime.toISOString(), mode, meetingProvider: provider, ...(scheduled ? { reason } : {}) };
    if (mode === 'video' && details) body.meetingUrl = details;
    if (mode === 'phone') body.phoneDetails = { phoneNumber: details };
    if (mode === 'onsite') body.location = { name: 'Interview location', address: details };
    return action.mutateAsync({ action: scheduled ? 'reschedule' : 'schedule', body }).then(() => setOpen(false)).catch((cause) => { setFormError(err(cause)); throw cause; });
  };
  return <li className={isActive ? 'iv-round iv-round--active' : 'iv-round'}>
    <span className="iv-round__marker" aria-hidden="true">{index + 1}</span>
    <article>
      <header><div><small>Round {index + 1} · {label(round.type)}</small><h3>{round.name}</h3></div><StatusTag tone={tone(round.status ?? 'pending')}>{label(round.status ?? 'pending')}</StatusTag></header>
      <p>{round.description || `${round.durationMinutes} minute structured interview`}</p>
      <dl className="iv-round__meta"><div><dt>Duration</dt><dd>{round.durationMinutes} min</dd></div><div><dt>Interviewers</dt><dd>{round.interviewerIds?.length ? round.interviewerIds.join(', ') : 'Unassigned'}</dd></div><div><dt>Schedule</dt><dd>{round.schedule ? formatZoned(round.schedule.startTime, round.schedule.timezone) : 'Not scheduled'}</dd></div><div><dt>Mode</dt><dd>{round.schedule ? `${label(round.schedule.mode)} · ${label(round.schedule.meetingProvider)}` : '—'}</dd></div></dl>
      {action.isError && <Alert tone="danger" title="Round action failed">{err(action.error)}</Alert>}
      <div className="iv-actions">
        {(round.scheduledInterview || round.schedule?.id) && (
          <Link
            to={`/org/interviews/schedules/${round.scheduledInterview || round.schedule?.id}/room`}
            className="tvx-button tvx-button--primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#2563eb', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
          >
            🎥 Enter Native Interview Room ↗
          </Link>
        )}
        {canSchedule && ['pending','scheduled'].includes(round.status ?? '') && <Button onClick={() => setOpen(true)}>{scheduled ? 'Reschedule' : 'Schedule round'}</Button>}
        {canEvaluate && round.status === 'scheduled' && <Button onClick={() => void action.mutateAsync({ action: 'start' })}>Start round</Button>}
        {canEvaluate && ['in-progress','awaiting-feedback'].includes(round.status ?? '') && <ConfirmDialog title="Complete this round?" description={<TextArea label="Reason if feedback is incomplete" value={reason} onChange={(e) => setReason(e.target.value)} />} confirmLabel="Complete round" onConfirm={() => action.mutateAsync({ action: 'complete', body: { reason } })} trigger={<Button>Complete round</Button>} />}
        {canSchedule && scheduled && ['scheduled','in-progress'].includes(round.status ?? '') && <ConfirmDialog title="Record a no-show?" description={<div className="iv-form-grid"><Select label="Absent party" value={party} onChange={(e) => setParty(e.target.value)} options={['candidate','interviewer','both'].map((value) => ({ value, label: label(value) }))} /><TextArea required label="Reason" error={!reason.trim() ? 'A reason is required.' : undefined} value={reason} onChange={(e) => setReason(e.target.value)} /></div>} confirmLabel="Record no-show" variant="destructive" onConfirm={() => reason.trim() ? action.mutateAsync({ action: 'no-show', body: { party, reason: reason.trim() } }) : Promise.reject(new Error('A reason is required.'))} trigger={<Button variant="secondary">No-show</Button>} />}
        {canEvaluate && round.interviewerIds?.length ? <Link to={`/org/interviews/feedback/${round.id}`}>Open scorecard</Link> : null}
        {canSchedule && scheduled && !['completed','cancelled'].includes(round.status ?? '') && <ConfirmDialog title="Cancel this round?" description={<TextArea required label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />} confirmLabel="Cancel round" variant="destructive" onConfirm={() => action.mutateAsync({ action: 'cancel', body: { reason } })} trigger={<Button variant="danger">Cancel</Button>} />}
      </div>
    </article>
    <Dialog open={open} onOpenChange={setOpen} title={scheduled ? 'Reschedule round' : 'Schedule round'} description={`The end time is fixed to ${round.durationMinutes} minutes after the start.`} footer={<div className="tvx-dialog__actions"><Button variant="secondary" onClick={() => setOpen(false)}>Close</Button><Button loading={action.isPending} disabled={!interviewers || !start || (detailsRequired && !details) || (scheduled && !reason)} onClick={() => void submitSchedule()}>{scheduled ? 'Reschedule' : 'Schedule'}</Button></div>}>
      {formError && <Alert tone="danger" title="Check the scheduling fields">{formError}</Alert>}
      <div className="iv-form-grid">
        <Select
          label="Assigned interviewer"
          value={interviewers.split(',')[0]?.trim() || defaultUserId}
          onChange={(e) => setInterviewers(e.target.value)}
          options={interviewerOptions}
        />
        <div style={{ gridColumn: '1 / -1', marginTop: '-8px' }}>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
          >
            {showAdvanced ? '▲ Hide raw IDs' : '▼ Advanced: Multiple interviewers / raw IDs'}
          </button>
        </div>
        {showAdvanced && (
          <TextField
            required
            label="Interviewer IDs (comma separated)"
            hint="Enter one or more team member User IDs separated by commas for panel interviews."
            value={interviewers}
            onChange={(e) => setInterviewers(e.target.value)}
          />
        )}
        <TextField required label="IANA timezone" error={formError.toLowerCase().includes('timezone') ? formError : undefined} value={timezone} onChange={(e) => setTimezone(e.target.value)} /><TextField required type="datetime-local" label="Start time" error={formError.toLowerCase().includes('local time') ? formError : undefined} value={start} onChange={(e) => setStart(e.target.value)} /><Select label="Mode" value={mode} onChange={(e) => setMode(e.target.value)} options={['video','phone','onsite'].map((value) => ({ value, label: label(value) }))} /><Select label="Meeting provider" value={provider} onChange={(e) => setProvider(e.target.value)} options={['native','zoom','google-meet','microsoft-teams','custom','none'].map((value) => ({ value, label: label(value) }))} /><TextField required={detailsRequired} error={formError.toLowerCase().includes('https') ? formError : undefined} label={mode === 'video' ? (provider === 'custom' ? 'HTTPS meeting URL' : 'HTTPS meeting URL (optional - will auto-generate if blank)') : mode === 'phone' ? 'Phone number' : 'Location address'} value={details} onChange={(e) => setDetails(e.target.value)} />{scheduled && <TextArea required label="Reschedule reason" value={reason} onChange={(e) => setReason(e.target.value)} />}</div>
    </Dialog>
  </li>;

}

export function CalendarPage() {
  const { recruiter } = useAuth();
  const view = has(recruiter?.permissions ?? [], 'interviews.view');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get start and end dates of the week containing currentDate
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const q = useCalendar(`from=${startOfWeek.toISOString()}&to=${endOfWeek.toISOString()}`, view);

  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );

  const days = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + idx);
    return d;
  });

  const todayDate = new Date();

  const nextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    setCurrentDate(next);
  };

  const prevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    setCurrentDate(prev);
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  const formatRangeText = () => {
    const startStr = startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const endStr = endOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  };

  return (
    <div className="iv-page">
      <PageHeader
        title="Recruiter interview calendar"
        description="View scheduled sessions, mock video links, and download calendar invites."
        secondaryActions={<InterviewTabs />}
      />

      <div className="iv-calendar-toolbar">
        <div className="iv-calendar-nav-group">
          <Button variant="secondary" size="compact" onClick={prevWeek} leadingIcon={<ChevronLeft size={16} />}>
            Prev
          </Button>
          <Button variant="secondary" size="compact" onClick={today}>
            Today
          </Button>
          <Button variant="secondary" size="compact" onClick={nextWeek} trailingIcon={<ChevronRight size={16} />}>
            Next
          </Button>
        </div>
        <div className="iv-calendar-range-title">
          <Calendar size={18} style={{ color: '#0284c7' }} />
          <span>{formatRangeText()}</span>
        </div>
      </div>

      {q.isLoading ? (
        <LoadingState label="Loading calendar schedules" />
      ) : q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <div className="iv-calendar-grid">
          {days.map((dayDate) => {
            const isToday = dayDate.toDateString() === todayDate.toDateString();
            const daySchedules = (q.data ?? []).filter((s: SafeSchedule) => {
              const sDate = new Date(s.startTime);
              return sDate.toDateString() === dayDate.toDateString();
            });

            return (
              <div key={dayDate.toISOString()} className={`iv-calendar-day ${isToday ? 'is-today' : ''}`}>
                <header className="iv-calendar-day-header">
                  <span className="iv-day-name">{dayDate.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  <span className="iv-day-number">{dayDate.getDate()}</span>
                </header>
                <div className="iv-calendar-day-events">
                  {daySchedules.length === 0 ? (
                    <div className="iv-empty-day">
                      <CalendarX size={20} />
                      <span>No interviews</span>
                    </div>
                  ) : (
                    daySchedules.map((s: SafeSchedule) => {
                      const startTime = new Date(s.startTime);
                      const modeLower = (s.mode || 'video').toLowerCase();

                      return (
                        <article key={s.id} className="iv-calendar-event-card">
                          <header className="iv-event-header">
                            <span className="iv-event-time">
                              {Number.isNaN(startTime.valueOf())
                                ? 'Scheduled'
                                : startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`iv-event-mode-tag iv-event-mode-tag--${modeLower}`}>
                              {modeLower === 'phone' ? (
                                <Phone size={11} />
                              ) : modeLower === 'onsite' ? (
                                <MapPin size={11} />
                              ) : (
                                <Video size={11} />
                              )}
                              {s.mode || 'Video'}
                            </span>
                          </header>

                          <div className="iv-event-candidate" title={s.candidateName || s.candidateId || 'Candidate'}>
                            <User size={13} style={{ flexShrink: 0, color: '#64748b' }} />
                            <span>{s.candidateName || (s.candidateId ? `Candidate #${s.candidateId.slice(-6)}` : 'Candidate')}</span>
                          </div>

                          <div className="iv-event-actions">
                            {s.id ? (
                              <Link to={`/org/interviews/schedules/${s.id}/room`} className="iv-join-btn" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', fontWeight: 600 }}>
                                <Video size={13} /> Enter Native Room ↗
                              </Link>
                            ) : s.meetingUrl ? (
                              <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="iv-join-btn">
                                <Video size={13} /> Join Meeting
                              </a>
                            ) : null}
                            <div className="iv-sub-links">
                              <Link to={`/org/interviews/${s.processId || s.process || s.id}`} className="iv-sub-link">
                                Process
                              </Link>
                              <a
                                href={`/api/v1/interviews/schedules/${s.id}/ics`}
                                download
                                className="iv-sub-link"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}
                              >
                                <Download size={11} /> Invite
                              </a>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
