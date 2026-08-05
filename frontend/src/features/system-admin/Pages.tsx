import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, Download, RefreshCw, Search, ShieldAlert, Cpu } from 'lucide-react';
import { ApiError, tokenStore } from '../../api/client';
import { adminApi, adminPaths, approvalAction, downloadAnalyticsCsv } from './api';
import { APPLICATION_ADMIN_STATUSES, displayValue, recordId, type AdminRecord, type PageMeta } from './model';
import { useGetAdminClaims, useResolveClaim } from '../organization-admin/api';
import './system-admin.css';

const objectId = /^[a-f\d]{24}$/i;
const label = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (x) => x.toUpperCase());
const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'The request could not be completed.';

function State({ kind, children }: { kind: 'loading' | 'error' | 'empty'; children: React.ReactNode }) {
  return <div className={`sys-state sys-state--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

function Header({ eyebrow, title, intro, actions }: { eyebrow: string; title: string; intro: string; actions?: React.ReactNode }) {
  return <header className="sys-header">
    <div><p className="sys-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></div>
    {actions && <div className="sys-header__actions">{actions}</div>}
  </header>;
}

function Status({ value }: { value: unknown }) {
  const text = displayValue(value);
  const tone = /approved|active|healthy|clean|verified|delivered|sent|complete/i.test(text) ? 'good'
    : /pending|processing|review|scheduled/i.test(text) ? 'warn'
    : /reject|fail|suspend|cancel|infect|quarant|expired/i.test(text) ? 'bad' : 'neutral';
  return <span className={`sys-status sys-status--${tone}`}><i aria-hidden />{label(text)}</span>;
}

const rowTitle = (row: AdminRecord) => displayValue(row.name ?? row.title ?? row.fullName ?? row.displayName ?? row.email ?? row.key ?? recordId(row));
const rowSubtitle = (row: AdminRecord) => displayValue(row.email ?? row.slug ?? row.type ?? row.category ?? row.company ?? row.user);

function LedgerTable({ rows, detailBase, actions }: {
  rows: AdminRecord[]; detailBase?: string | undefined;
  actions?: ((row: AdminRecord) => React.ReactNode) | undefined;
}) {
  return <div className="sys-table-wrap"><table className="sys-table">
    <thead><tr><th>Record</th><th>Status</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{rows.map((row, index) => {
      const id = recordId(row);
      const status = row.status ?? row.verificationStatus ?? row.approvalStatus ?? row.scanStatus ?? row.outboxStatus ?? 'recorded';
      return <tr key={id || index}>
        <td data-label="Record"><strong>{rowTitle(row)}</strong><small className="sys-mono">{rowSubtitle(row)}</small></td>
        <td data-label="Status"><Status value={status} /></td>
        <td data-label="Updated" className="sys-mono">{displayValue(row.updatedAt ?? row.createdAt ?? row.submittedAt)}</td>
        <td data-label="Actions" className="sys-row-actions">{detailBase && id && <Link to={`${detailBase}/${id}`}>Inspect <ArrowRight size={14} /></Link>}{actions?.(row)}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

interface PendingAction { title: string; path: string; method?: 'PATCH' | 'POST' | 'DELETE' | undefined; reason?: boolean | undefined; body?: Record<string, unknown> | undefined; field?: { name: string; label: string; options: string[] } | undefined }
function ActionDialog({ action, onClose, onDone }: { action: PendingAction; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [fieldValue, setFieldValue] = useState(action.field?.options[0] ?? '');
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),textarea:not([disabled]),input:not([disabled]),a[href]')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [onClose]);
  const mutation = useMutation({ mutationFn: () => {
    const hasBody = action.body || action.field || action.reason;
    const body = hasBody ? { ...action.body, ...(action.field ? { [action.field.name]: fieldValue } : {}), ...(action.reason ? { reason } : {}) } : {};
    return adminApi.mutate(action.path, action.method ?? 'PATCH', body);
  } });
  return <div className="sys-dialog-backdrop">
    <section ref={dialog} tabIndex={-1} className="sys-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
      <p className="sys-eyebrow">Audited action</p><h2 id="admin-action-title">{action.title}</h2>
      <p>This change is applied immediately after the backend rechecks your administrator role.</p>
      {action.field && <label>{action.field.label}<select value={fieldValue} onChange={(e) => setFieldValue(e.target.value)}>{action.field.options.map((option) => <option key={option} value={option}>{label(option)}</option>)}</select></label>}
      {action.reason && <label>Reason<textarea required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      {mutation.isError && <p className="sys-error" role="alert">{errorText(mutation.error)}</p>}
      <footer><button className="sys-button sys-button--quiet" onClick={onClose}>Cancel</button><button className="sys-button sys-button--danger" disabled={mutation.isPending || Boolean(action.reason && reason.trim().length < 3)} onClick={() => mutation.mutate(undefined, { onSuccess: () => { onDone(); onClose(); } })}>{mutation.isPending ? 'Applying…' : 'Confirm action'}</button></footer>
    </section>
  </div>;
}

function useCollection(path: string, query: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ['system-admin', path, query], queryFn: () => adminApi.list(path, query) });
}
function Pager({ page, setPage, meta }: { page: number; setPage: (page: number) => void; meta?: PageMeta | undefined }) {
  const pages = meta?.pages ?? 1;
  return <nav className="sys-pager" aria-label="Results pages"><span>{meta?.total ?? '—'} results · page {page} of {pages}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></nav>;
}


export function AdminOverviewPage() {
  const [preset, setPreset] = useState('last-30-days');
  const overview = useQuery({ queryKey: ['system-admin', 'overview', preset], queryFn: () => adminApi.analytics('overview', { preset }) });
  const health = useQuery({ queryKey: ['system-admin', 'health'], queryFn: () => adminApi.analytics('health', { preset: 'today' }), refetchInterval: 30_000 });
  const recruiterQueue = useCollection(adminPaths.recruiterQueue, { page: 1, limit: 1 });
  const companyQueue = useCollection(adminPaths.companyQueue, { page: 1, limit: 1 });
  const jobQueue = useCollection(adminPaths.jobQueue, { page: 1, limit: 1 });
  const data = (overview.data ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? data) as Record<string, unknown>;
  const healthData = (health.data ?? {}) as Record<string, unknown>;
  const healthText = JSON.stringify(healthData).toLowerCase();
  const healthState = health.isError ? 'unhealthy' : health.isLoading ? 'checking' :
    /unhealthy|failed|disconnected|critical/.test(healthText) ? 'unhealthy' :
    /degraded|backlog|warning|stale/.test(healthText) ? 'degraded' : 'healthy';
  const metrics = Object.entries(summary).filter(([, v]) => typeof v === 'number').slice(0, 8);

  const drilldowns: Record<string, string> = {
    totalUsers: '/admin/analytics/users',
    activeUsers: '/admin/analytics/users',
    totalCompanies: '/admin/analytics/companies',
    verifiedCompanies: '/admin/analytics/companies',
    totalRecruiters: '/admin/analytics/recruiters',
    approvedRecruiters: '/admin/analytics/recruiters',
    totalCandidateProfiles: '/admin/analytics/candidates',
    totalJobs: '/admin/analytics/jobs',
    activeJobs: '/admin/analytics/jobs',
    totalAssessments: '/admin/analytics/assessments',
    totalAttempts: '/admin/analytics/assessments',
    totalInterviews: '/admin/analytics/interviews',
    scheduledInterviews: '/admin/analytics/interviews',
    totalOffers: '/admin/analytics/offers',
    activeOffers: '/admin/analytics/offers',
    databaseState: '/admin/analytics/health',
    uptimeSeconds: '/admin/analytics/health',
  };

  return <main className="sys-page">
    <Header eyebrow="System administration / Overview" title="Platform command center" intro="A UTC-bounded operational ledger for platform health, volume, and queues." actions={<select aria-label="Overview range" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Last 24 hours</option><option value="last-7-days">Last 7 days</option><option value="last-30-days">Last 30 days</option><option value="last-90-days">Last 90 days</option></select>} />
    <section className="sys-pulse" aria-labelledby="pulse-title"><div><Activity size={18} /><span><strong id="pulse-title">Platform pulse</strong><small>Live operational scan · UTC</small></span></div>
      <Link to="/admin/analytics/health"><Status value={healthState} /></Link>
      <Link to="/admin/approvals?queue=recruiters">Recruiters · {recruiterQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <Link to="/admin/approvals?queue=companies">Companies · {companyQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <Link to="/admin/approvals?queue=jobs">Jobs · {jobQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <time className="sys-mono">Updated {health.dataUpdatedAt ? new Date(health.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</time>
    </section>
    {overview.isLoading ? <State kind="loading">Reading platform metrics…</State> : overview.isError ? <State kind="error">{errorText(overview.error)}</State> :
      <section className="sys-metrics" aria-label="Platform totals">
        {metrics.length ? metrics.map(([key, value], index) => {
          const path = drilldowns[key] || `/admin/analytics?domain=${key}`;
          return (
            <article key={key} className={index === 0 ? 'sys-metric--lead' : ''} style={{ position: 'relative' }}>
              <span>{label(key)}</span>
              <strong>{Number(value).toLocaleString()}</strong>
              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <small>Within selected range</small>
                <Link to={path} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-action-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  Drill down <ArrowRight size={12} />
                </Link>
              </div>
            </article>
          );
        }) : <State kind="empty">No aggregate metrics were returned for this range.</State>}
      </section>}
    <section className="sys-queue-links"><div><p className="sys-eyebrow">Triage</p><h2>Urgent work stays close</h2><p>Review pending identities and records before moving into corrective operations.</p></div>
      {([['Approvals', '/admin/approvals'], ['Operations', '/admin/operations'], ['Communications', '/admin/communications'], ['Analytics', '/admin/analytics']] as const).map(([name, to]) => <Link key={to} to={to}>{name}<ArrowRight size={16} /></Link>)}
    </section>
  </main>;
}

const queues = {
  recruiters: { path: adminPaths.recruiterQueue, kind: 'recruiters' as const, actions: ['approve', 'reject', 'suspend'] },
  companies: { path: adminPaths.companyQueue, kind: 'companies' as const, actions: ['approve', 'reject', 'suspend'] },
  jobs: { path: adminPaths.jobQueue, kind: 'jobs' as const, actions: ['approve', 'reject', 'feature', 'unfeature'] },
};
export function AdminApprovalsPage() {
  const [sp, setSp] = useSearchParams(); const queue = (sp.get('queue') ?? 'recruiters') as keyof typeof queues;
  const active = queues[queue] ?? queues.recruiters; const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [pending, setPending] = useState<PendingAction | null>(null);
  const query = useCollection(active.path, { page, limit: 20 }); const client = useQueryClient();
  const rows = (query.data?.rows ?? []).filter((row) => `${rowTitle(row)} ${rowSubtitle(row)}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="sys-page"><Header eyebrow="System administration / Triage" title="Approval ledger" intro="Review recruiter identities, company verification, and job publishing requests." />
    <div className="sys-tabs" role="tablist">{Object.keys(queues).map((key) => <button role="tab" aria-selected={queue === key} key={key} onClick={() => { setPage(1); setSp({ queue: key }); }}>{label(key)}</button>)}</div>
    <div className="sys-toolbar"><label><Search size={16} /><span className="sr-only">Search queue</span><input placeholder={`Search ${queue}`} value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="sys-button sys-button--quiet" onClick={() => query.refetch()}><RefreshCw size={15} />Refresh</button></div>
    {query.isLoading ? <State kind="loading">Loading approval queue…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : rows.length ? <><LedgerTable rows={rows} actions={(row) => <>{active.actions.map((action) => <button key={action} onClick={() => setPending({ title: `${label(action)} ${rowTitle(row)}?`, path: approvalAction(active.kind, recordId(row), action), reason: action === 'reject' || action === 'suspend', body: active.kind === 'companies' && action !== 'reject' ? {} : undefined })}>{label(action)}</button>)}</>} /><Pager page={page} setPage={setPage} meta={query.data?.meta} /></> : <State kind="empty">No pending {queue} match this view.</State>}
    {pending && <ActionDialog action={pending} onClose={() => setPending(null)} onDone={() => client.invalidateQueries({ queryKey: ['system-admin', active.path] })} />}
  </main>;
}

const operations = {
  users: { path: adminPaths.users, detail: '/admin/operations/users' },
  recruiters: { path: adminPaths.recruiters, detail: '/admin/operations/recruiters' },
  companies: { path: adminPaths.companies, detail: '/admin/operations/companies' },
  jobs: { path: adminPaths.jobs, detail: '/admin/operations/jobs' },
  applications: { path: adminPaths.applications, detail: '/admin/operations/applications' },
  assessments: { path: adminPaths.assignments, detail: '/admin/operations/assessments' },
  questions: { path: adminPaths.questions, detail: '/admin/operations/questions' },
  interviews: { path: adminPaths.interviews, detail: '/admin/operations/interviews' },
  offers: { path: adminPaths.offers, detail: '/admin/operations/offers' },
  documents: { path: adminPaths.documents, detail: '/admin/operations/documents' },
  audits: { path: adminPaths.audits, detail: '/admin/operations/audits' },
};

export function AdminOperationsPage() {
  const [sp, setSp] = useSearchParams();
  const view = (sp.get('view') ?? 'users') as keyof typeof operations;
  const active = operations[view] ?? operations.users;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerRecordId, setDrawerRecordId] = useState<string | null>(null);

  const queryParams: any = {
    page,
    limit: 20,
  };

  const strictQueryViews = ['applications', 'assessments', 'documents', 'interviews', 'offers'];
  if (!strictQueryViews.includes(view)) {
    if (search) queryParams.search = search;
    queryParams.sortBy = sortBy;
    queryParams.sortOrder = sortOrder;
    if (roleFilter) queryParams.role = roleFilter;
    if (statusFilter) queryParams.status = statusFilter;
  }

  const query = useQuery({
    queryKey: ['system-admin', active.path, queryParams],
    queryFn: () => adminApi.list(active.path, queryParams)
  });

  const client = useQueryClient();
  const [pending, setPending] = useState<PendingAction | null>(null);

  const handleBulkAction = (action: string) => {
    setPending({
      title: `Bulk ${action} ${selectedIds.length} records?`,
      path: '/admin/management/users/bulk',
      method: 'POST',
      body: { userIds: selectedIds, action },
      reason: true
    });
  };

  const handleExport = async () => {
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';
      const response = await fetch(`${base}/admin/management/users/export?role=${roleFilter}`, {
        headers: { Accept: 'text/csv', Authorization: `Bearer ${tokenStore.get()}` },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'users-export.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const rows = query.data?.rows ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Operations" title="Platform Console" intro="Complete operational control over users, recruiters, companies, jobs, assessments, and notifications." />
      <div className="sys-tabs" role="tablist">
        {Object.keys(operations).map((key) => (
          <button role="tab" aria-selected={view === key} key={key} onClick={() => { setPage(1); setSelectedIds([]); setSp({ view: key }); }}>
            {label(key)}
          </button>
        ))}
      </div>

      <div className="sys-toolbar">
        <label style={{ flexGrow: 1 }}>
          <Search size={16} />
          <span className="sr-only">Search</span>
          <input placeholder="Fuzzy search records..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        
        {view === 'users' && (
          <>
            <label>Role
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="candidate">Candidate</option>
                <option value="recruiter">Recruiter</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button className="sys-button sys-button--quiet" onClick={handleExport}>Export CSV</button>
          </>
        )}

        <label>Sort By
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="createdAt">Created Date</option>
            <option value="updatedAt">Updated Date</option>
            <option value="fullName">Name</option>
            <option value="title">Title</option>
          </select>
        </label>

        <label>Order
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        
        <button className="sys-button sys-button--quiet" onClick={() => query.refetch()}><RefreshCw size={15} />Refresh</button>
      </div>

      {selectedIds.length > 0 && (
        <div className="sys-action-strip" style={{ margin: '12px 0', padding: '12px', borderRadius: '6px', background: 'var(--color-bg-alt)' }}>
          <span><strong>Bulk actions:</strong> {selectedIds.length} users selected</span>
          <button className="sys-button sys-button--danger" onClick={() => handleBulkAction('suspend')}>Suspend</button>
          <button className="sys-button" onClick={() => handleBulkAction('restore')}>Restore</button>
          <button className="sys-button" onClick={() => handleBulkAction('verify-email')}>Verify Email</button>
        </div>
      )}

      {query.isLoading ? (
        <State kind="loading">Loading console view...</State>
      ) : query.isError ? (
        <State kind="error">{errorText(query.error)}</State>
      ) : rows.length ? (
        <>
          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  {view === 'users' && <th>Select</th>}
                  <th>Record</th>
                  <th>Status</th>
                  <th>Last Update</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const id = row._id || row.id;
                  const isSel = selectedIds.includes(id);
                  return (
                    <tr key={id}>
                      {view === 'users' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={isSel}
                            aria-label="Select row"
                            onChange={() => {
                              setSelectedIds(prev => isSel ? prev.filter(x => x !== id) : [...prev, id]);
                            }}
                          />
                        </td>
                      )}
                      <td>
                        <strong>{row.fullName || row.name || row.title || row.originalFileName || row.action || id}</strong>
                        <small className="sys-mono">{row.email || row.slug || row.mimeType || row.ipAddress}</small>
                      </td>
                      <td>
                        <Status value={row.status || row.verificationStatus || row.malwareScan?.status || 'active'} />
                      </td>
                      <td className="sys-mono">
                        {new Date(row.updatedAt || row.createdAt || row.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <button className="sys-button sys-button--quiet" onClick={() => setDrawerRecordId(id)}>
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={setPage} meta={query.data?.meta} />
        </>
      ) : (
        <State kind="empty">No management records found.</State>
      )}

      {drawerRecordId && (
        <DetailDrawer
          recordId={drawerRecordId}
          type={view}
          onClose={() => setDrawerRecordId(null)}
          onActionDone={() => {
            setDrawerRecordId(null);
            query.refetch();
          }}
        />
      )}

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            setSelectedIds([]);
            query.refetch();
          }}
        />
      )}
    </main>
  );
}

function DetailDrawer({ recordId, type, onClose, onActionDone }: { recordId: string; type: string; onClose: () => void; onActionDone: () => void }) {
  const pathMap: Record<string, string> = {
    users: `/admin/management/users/${recordId}`,
    recruiters: `/admin/management/recruiters/${recordId}`,
    companies: `/admin/management/companies/${recordId}`,
    jobs: `/admin/management/jobs/${recordId}`,
    questions: `/admin/management/questions/${recordId}`,
    audits: `/admin/management/audits`,
    documents: `/documents/admin/${recordId}`,
    applications: `/applications/admin/${recordId}`,
    assessments: `/assessments/admin/assignments/${recordId}`,
    offers: `/offers/admin/${recordId}`,
    interviews: `/interviews/admin/processes/${recordId}`
  };

  const path = pathMap[type] || `/admin/management/${type}/${recordId}`;
  const query = useQuery({
    queryKey: ['system-admin', 'detail', path],
    queryFn: () => adminApi.detail(path)
  });
  const data = (query.data ?? {}) as any;

  const [pending, setPending] = useState<PendingAction | null>(null);

  const performAction = (actionName: string, config: { path: string; method?: 'PATCH' | 'POST' | 'DELETE'; reason?: boolean; field?: any; body?: any }) => {
    setPending({
      title: `${actionName}?`,
      path: config.path,
      method: config.method || 'PATCH',
      reason: config.reason,
      field: config.field,
      body: config.body
    });
  };

  return (
    <div className="sys-dialog-backdrop">
      <div className="sys-dialog" style={{ maxWidth: '600px', width: '100%', right: 0, height: '100vh', position: 'fixed', top: 0, borderRadius: 0, zIndex: 100 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <p className="sys-eyebrow">Operational details</p>
            <h2>${type.toUpperCase()} Record</h2>
          </div>
          <button className="sys-button sys-button--quiet" onClick={onClose}>Close</button>
        </header>

        {query.isLoading ? (
          <State kind="loading">Loading details...</State>
        ) : query.isError ? (
          <State kind="error">{errorText(query.error)}</State>
        ) : query.data ? (
          <div style={{ overflowY: 'auto', height: 'calc(100vh - 150px)', paddingBottom: '40px' }}>
            <section className="sys-detail">
              <dl style={{ gridTemplateColumns: '1fr' }}>
                {Object.entries(data).filter(([k, v]) => typeof v !== 'object' || v === null).map(([k, v]) => (
                  <div key={k}>
                    <dt>{label(k)}</dt>
                    <dd>{displayValue(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div style={{ marginTop: '24px', padding: '16px', borderRadius: '6px', background: 'var(--color-bg-alt)' }}>
              <h3>Operational overrides</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {type === 'users' && (
                  <>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend User', { path: `/admin/management/users/${recordId}/status`, body: { action: 'suspend' }, reason: true })}>Suspend</button>
                    <button className="sys-button" onClick={() => performAction('Restore User', { path: `/admin/management/users/${recordId}/status`, body: { action: 'restore' }, reason: true })}>Restore</button>
                    <button className="sys-button" onClick={() => performAction('Verify Email', { path: `/admin/management/users/${recordId}/status`, body: { action: 'verify-email' } })}>Verify Email</button>
                    <button className="sys-button" onClick={() => performAction('Change Role', { path: `/admin/management/users/${recordId}/role`, reason: true, field: { name: 'role', label: 'New Role', options: ['candidate', 'recruiter', 'admin'] } })}>Change Role</button>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Soft Delete User', { path: `/admin/management/users/${recordId}`, method: 'DELETE', reason: true })}>Soft Delete</button>
                  </>
                )}
                {type === 'recruiters' && (
                  <button className="sys-button sys-button--danger" onClick={() => performAction('Remove from Company', { path: `/admin/management/recruiters/${recordId}/company`, method: 'DELETE', reason: true })}>Remove Company</button>
                )}
                {type === 'companies' && (
                  <>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend Company', { path: `/admin/companies/admin/${recordId}/suspend`, reason: true })}>Suspend</button>
                    <button className="sys-button" onClick={() => performAction('Verify Company', { path: `/admin/companies/admin/${recordId}/verify` })}>Verify</button>
                    <button className="sys-button" onClick={() => performAction('Merge Company', { path: `/admin/management/companies/merge`, method: 'POST', reason: true, field: { name: 'secondaryId', label: 'Merge Secondary Company ID', options: [] } })}>Merge Company</button>
                  </>
                )}
                {type === 'jobs' && (
                  <>
                    <button className="sys-button" onClick={() => performAction('Pause Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'paused' }, reason: true })}>Pause</button>
                    <button className="sys-button" onClick={() => performAction('Resume Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'published' } })}>Resume</button>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Close Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'closed' }, reason: true })}>Close</button>
                    <button className="sys-button" onClick={() => performAction('Clone Job', { path: `/admin/management/jobs/${recordId}/clone`, method: 'POST' })}>Clone</button>
                  </>
                )}
                {type === 'documents' && (
                  <>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Quarantine Document', { path: `/admin/management/documents/${recordId}/status`, body: { action: 'quarantine' }, reason: true })}>Quarantine</button>
                    <button className="sys-button" onClick={() => performAction('Release Document', { path: `/admin/management/documents/${recordId}/status`, body: { action: 'release' } })}>Release</button>
                  </>
                )}
                {type === 'applications' && (
                  <button className="sys-button" onClick={() => performAction('Move Application Stage', { path: `/admin/management/applications/${recordId}/stage`, reason: true, field: { name: 'status', label: 'New Stage', options: ['applied', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'] } })}>Move Stage</button>
                )}
                {type === 'assessments' && (
                  <>
                    <button className="sys-button" onClick={() => performAction('Clone Assessment', { path: `/admin/management/assessments/${recordId}/clone`, method: 'POST' })}>Clone Assessment</button>
                    <button className="sys-button sys-button--danger" onClick={() => performAction('Force Submit Attempt', { path: `/admin/management/attempts/${recordId}/force-submit`, method: 'POST', reason: true })}>Force Submit</button>
                  </>
                )}
              </div>
            </div>

            {data.auditLogs && data.auditLogs.length > 0 && (
              <section style={{ marginTop: '24px' }}>
                <h3>Audit Timeline</h3>
                <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
                  {data.auditLogs.map((log: any) => (
                    <li key={log._id} style={{ marginBottom: '8px' }}>
                      <strong>{log.action}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}> by {log.actor?.fullName || 'System'} on {new Date(log.timestamp).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <State kind="empty">No record details found.</State>
        )}
      </div>

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            onActionDone();
            onClose();
          }}
        />
      )}
    </div>
  );
}

const detailConfig = {
  applications: { base: '/applications/admin', actions: [['Override status', 'status', true, APPLICATION_ADMIN_STATUSES], ['Archive', 'archive', false]] },
  assessments: { base: '/assessments/admin/assignments', actions: [['Cancel assignment', 'cancel', true], ['Expire assignment', 'expire', true]] },
  attempts: { base: '/assessments/admin/attempts', actions: [['Reopen review', 'reopen-review', true]] },
  interviews: { base: '/interviews/admin/processes', actions: [['Override status', 'status', true, ['draft','active','completed','cancelled']]] },
  schedules: { base: '/interviews/admin/schedules', actions: [['Cancel schedule', 'cancel', true]] },
  feedback: { base: '/interviews/admin/feedback', actions: [['Reopen feedback', 'reopen', true]] },
  offers: { base: '/offers/admin', actions: [['Override status', 'status', true, ['draft','pending-approval','approved','sent','viewed','accepted','declined','expired','withdrawn']], ['Expire', 'expire', true], ['Reopen', 'reopen', true], ['Archive', 'archive', true]] },
  documents: { base: '/documents/admin', actions: [['Set scan status', 'scan-status', true, ['clean','suspicious','infected','failed']], ['Quarantine', 'quarantine', true], ['Release', 'release', true], ['Archive', 'archive', true]] },
} as const;
export function AdminRecordDetailPage() {
  const { type = '', id = '' } = useParams(); const valid = objectId.test(id) && type in detailConfig;
  const config = valid ? detailConfig[type as keyof typeof detailConfig] : detailConfig.applications; const path = `${config.base}/${id}`; const query = useQuery({ queryKey: ['system-admin', path], queryFn: () => adminApi.detail(path), enabled: valid });
  const [pending, setPending] = useState<PendingAction | null>(null);
  if (!valid) return <Navigate to="/not-found" replace />;
  return <main className="sys-page"><Header eyebrow={`Operations / ${label(type)}`} title="Record inspection" intro={`Immutable identifier ${id}`} />
    {query.isLoading ? <State kind="loading">Loading record…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : query.data && <><section className="sys-detail"><dl>{Object.entries(query.data).filter(([, v]) => typeof v !== 'object' || v === null).slice(0, 24).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd className={key.includes('Id') || key.startsWith('_') ? 'sys-mono' : ''}>{displayValue(value)}</dd></div>)}</dl></section>
      {type === 'applications' && Array.isArray(query.data.notes) && query.data.notes.length > 0 && <section className="sys-notes"><h2>Administrative notes</h2>{(query.data.notes as AdminRecord[]).map((note) => <article key={recordId(note)}><p>{displayValue(note.note ?? note.text)}</p><button onClick={() => setPending({ title: 'Delete this application note?', path: `${path}/notes/${recordId(note)}`, method: 'DELETE' })}>Delete note</button></article>)}</section>}
      <section className="sys-action-strip"><div><ShieldAlert size={18} /><span><strong>Corrective actions</strong><small>Current status: {displayValue(query.data.status)} · every intervention is recorded.</small></span></div>{config.actions.map(([title, action, needsReason, options]) => <button key={action} onClick={() => setPending({ title: `${title}?`, path: `${path}/${action}`, reason: needsReason, field: options ? { name: 'status', label: 'New status', options: [...options].filter((status) => status !== query.data?.status) } : undefined })}>{title}</button>)}</section></>}
    {pending && <ActionDialog action={pending} onClose={() => setPending(null)} onDone={() => query.refetch()} />}
  </main>;
}

const communications = { notifications: adminPaths.notifications, templates: adminPaths.templates, outbox: adminPaths.outbox, 'email logs': adminPaths.emailLogs };
export function AdminCommunicationsPage() {
  const [sp, setSp] = useSearchParams(); const view = sp.get('view') ?? 'notifications'; const path = communications[view as keyof typeof communications] ?? adminPaths.notifications;
  const [page, setPage] = useState(1); const query = useCollection(path, { page, limit: 20 }); const [pending, setPending] = useState<PendingAction | null>(null);
  return <main className="sys-page"><Header eyebrow="System administration / Communications" title="Delivery audit" intro="Trace notification creation, templates, outbox processing, and email delivery." actions={view === 'outbox' ? <button className="sys-button" onClick={() => setPending({ title: 'Process up to 20 outbox events?', path: '/notifications/admin/process-outbox', method: 'POST', body: { limit: 20 } })}>Process outbox</button> : undefined} />
    <div className="sys-tabs" role="tablist">{Object.keys(communications).map((key) => <button role="tab" aria-selected={view === key} key={key} onClick={() => { setPage(1); setSp({ view: key }); }}>{label(key)}</button>)}</div>
    {query.isLoading ? <State kind="loading">Loading communication records…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : query.data?.rows.length ? <><LedgerTable rows={query.data.rows} actions={view === 'outbox' ? (row) => <><button onClick={() => setPending({ title: 'Retry this outbox event?', path: `/notifications/admin/outbox/${recordId(row)}/retry` })}>Retry</button><button onClick={() => setPending({ title: 'Cancel this outbox event?', path: `/notifications/admin/outbox/${recordId(row)}/cancel` })}>Cancel</button></> : view === 'templates' ? (row) => <><button onClick={() => setPending({ title: 'Preview this template with empty variables?', path: `/notifications/admin/templates/${recordId(row)}/preview`, method: 'POST', body: { variables: {} } })}>Preview</button><button onClick={() => setPending({ title: 'Clone this template?', path: `/notifications/admin/templates/${recordId(row)}/clone`, method: 'POST' })}>Clone</button><button onClick={() => setPending({ title: 'Deactivate this template?', path: `/notifications/admin/templates/${recordId(row)}/deactivate` })}>Deactivate</button></> : undefined} /><Pager page={page} setPage={setPage} meta={query.data.meta} /></> : <State kind="empty">No {view} records were returned.</State>}
    {pending && <ActionDialog action={pending} onClose={() => setPending(null)} onDone={() => query.refetch()} />}
  </main>;
}

const domains = ['overview', 'users', 'candidates', 'recruiters', 'companies', 'jobs', 'applications', 'assessments', 'interviews', 'offers', 'documents', 'notifications', 'health'];
export function AdminAnalyticsPage() {
  const [sp, setSp] = useSearchParams(); const domain = sp.get('domain') ?? 'overview'; const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [exportError, setExportError] = useState(''); const [exporting, setExporting] = useState(false);
  const params = useMemo(() => from && to ? { from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59Z`).toISOString() } : { preset: 'last-30-days' }, [from, to]);
  const query = useQuery({ queryKey: ['system-admin', 'analytics', domain, params], queryFn: () => adminApi.analytics(domain, params), enabled: domains.includes(domain) });
  const data = (query.data ?? {}) as Record<string, unknown>; const summary = (data.summary ?? data) as Record<string, unknown>;
  const download = async () => {
    try {
      setExportError(''); setExporting(true);
      const blob = await downloadAnalyticsCsv({ report: domain, format: 'csv', timezone: 'UTC', ...params });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `talvix-${domain}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { setExportError(errorText(error)); } finally { setExporting(false); }
  };
  return <main className="sys-page"><Header eyebrow="System administration / Analytics" title="Aggregate intelligence" intro="Privacy-safe platform trends, bounded in UTC and exportable by report." />
    <div className="sys-tabs" role="tablist">
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics"><button role="presentation" aria-selected={domain === 'overview'}>Overview</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/users"><button role="presentation">Users</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/companies"><button role="presentation">Companies</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/recruiters"><button role="presentation">Recruiters</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/candidates"><button role="presentation">Candidates</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/jobs"><button role="presentation">Jobs</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/assessments"><button role="presentation">Assessments</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/interviews"><button role="presentation">Interviews</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/offers"><button role="presentation">Offers</button></Link>
      <Link role="tab" style={{ textDecoration: 'none' }} to="/admin/analytics/health"><button role="presentation">Health</button></Link>
    </div>
    <section className="sys-analytics-controls"><label>Domain<select value={domain} onChange={(e) => setSp({ domain: e.target.value })}>{domains.map((d) => <option key={d}>{d}</option>)}</select></label><label>From (UTC)<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To (UTC)<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label><button className="sys-button" disabled={exporting || Boolean(from) !== Boolean(to)} onClick={download}><Download size={15} />{exporting ? 'Preparing…' : 'Export CSV'}</button></section>
    {exportError && <p className="sys-error" role="alert">{exportError}</p>}
    {query.isLoading ? <State kind="loading">Calculating aggregates…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : <section className="sys-metrics">{Object.entries(summary).filter(([, v]) => typeof v === 'number').map(([key, value]) => <article key={key}><span>{label(key)}</span><strong>{Number(value).toLocaleString()}</strong><small>Aggregate count</small></article>)}</section>}
  </main>;
}

export function AdminClaimsPage() {
  const query = useGetAdminClaims();
  const resolveMutation = useResolveClaim();
  const [notes, setNotes] = useState('');

  const handleResolve = (claimId: string, action: 'approve' | 'reject') => {
    resolveMutation.mutate(
      { claimId, action, notes },
      {
        onSuccess: () => {
          setNotes('');
        },
      }
    );
  };

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Claims"
        title="Ownership disputes & claims"
        intro="Review official documentation, emails, and LinkedIn links to verify company ownership."
      />
      
      {query.isLoading ? (
        <State kind="loading">Loading claims...</State>
      ) : query.isError ? (
        <State kind="error">{errorText(query.error)}</State>
      ) : query.data && query.data.length > 0 ? (
        <div className="sys-table-wrap">
          <table className="sys-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Claimant</th>
                <th>Dispute details</th>
                <th>Status</th>
                <th>Notes / Action</th>
              </tr>
            </thead>
            <tbody>
              {query.data.map((claim: any) => (
                <tr key={claim._id}>
                  <td>
                    <strong>{claim.company?.name}</strong>
                    <small className="sys-mono">{claim.company?.slug}</small>
                  </td>
                  <td>
                    <strong>{claim.claimant?.fullName}</strong>
                    <small className="sys-mono">{claim.claimant?.email}</small>
                  </td>
                  <td>
                    <div>Email: {claim.officialEmail}</div>
                    <div>
                      <a href={claim.linkedinUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--color-primary)' }}>
                        LinkedIn profile
                      </a>
                    </div>
                    {claim.proofUrl && (
                      <div>
                        <a href={claim.proofUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--color-primary)' }}>
                          Verification document
                        </a>
                      </div>
                    )}
                  </td>
                  <td>
                    <Status value={claim.status} />
                  </td>
                  <td>
                    {claim.status === 'pending' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <textarea
                          placeholder="Resolution notes..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '60px',
                            padding: '0.4rem',
                            border: '1px solid var(--color-border-subtle)',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: 'inherit',
                          }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="sys-button"
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => handleResolve(claim._id, 'approve')}
                            disabled={resolveMutation.isPending}
                          >
                            Approve & Transfer
                          </button>
                          <button
                            className="sys-button"
                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => handleResolve(claim._id, 'reject')}
                            disabled={resolveMutation.isPending}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
                        {claim.notes || 'No notes added.'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <State kind="empty">No ownership claims found.</State>
      )}
    </main>
  );
}


// ==========================================
// 1. Generic Custom SVG Charting Components
// ==========================================

export function SVGLineChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  if (!data || data.length === 0) return <State kind="empty">No trend data available</State>;
  const values = data.map(d => d.value);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 1);
  const range = maxVal - minVal;

  const width = 500;
  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
    const y = height - padding - ((d.value - minVal) / range) * chartHeight;
    return { x, y, label: d.label, value: d.value };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${(points[points.length - 1] ?? {x: 0}).x} ${height - padding} L ${(points[0] ?? {x: 0}).x} ${height - padding} Z`;

  const [hovered, setHovered] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  return (
    <div className="sys-chart-container" style={{ height: `${height}px` }}>
      <svg viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="gradient-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-action-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-action-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--color-border-default)" strokeDasharray="4 4" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="var(--color-border-default)" strokeDasharray="4 4" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border-default)" />

        {data.length > 1 && <path d={areaD} fill="url(#gradient-area)" />}
        <path d={pathD} fill="none" stroke="var(--color-action-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--color-surface-primary)" stroke="var(--color-action-primary)" strokeWidth="2" />
            <circle
              cx={p.x}
              cy={p.y}
              r="12"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        ))}
      </svg>
      {hovered && (
        <div className="sys-chart-tooltip" style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100 - 35}%`, transform: 'translateX(-50%)' }}>
          <strong>{hovered.label}</strong>: {hovered.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function SVGBarChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  if (!data || data.length === 0) return <State kind="empty">No bar data available</State>;
  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 1);

  const width = 500;
  const padding = 30;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const barWidth = (chartWidth / data.length) * 0.7;
  const gap = (chartWidth / data.length) * 0.3;

  const [hovered, setHovered] = useState<{ index: number; label: string; value: number; x: number; y: number } | null>(null);

  return (
    <div className="sys-chart-container" style={{ height: `${height}px` }}>
      <svg viewBox={`0 0 ${width} ${height}`}>
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--color-border-default)" strokeDasharray="4 4" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border-default)" />

        {data.map((d, i) => {
          const barHeight = (d.value / maxVal) * chartHeight;
          const x = padding + i * (barWidth + gap) + gap / 2;
          const y = height - padding - barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                fill="var(--color-action-primary)"
                rx="3"
                onMouseEnter={() => setHovered({ index: i, label: d.label, value: d.value, x: x + barWidth / 2, y })}
                onMouseLeave={() => setHovered(null)}
                style={{ transition: 'fill 0.2s', cursor: 'pointer' }}
              />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="sys-chart-tooltip" style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100 - 35}%`, transform: 'translateX(-50%)' }}>
          <strong>{hovered.label}</strong>: {hovered.value.toLocaleString()}
        </div>
      )}
    </div>
  );
}

export function SVGDonutChart({ data, height = 180 }: { data: { label: string; value: number }[]; height?: number }) {
  if (!data || data.length === 0) return <State kind="empty">No breakdowns available</State>;
  const total = data.reduce((acc, curr) => acc + curr.value, 0) || 1;
  const width = 200;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) / 2 - 15;

  let accumulatedAngle = -Math.PI / 2;
  const colors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6b7280', '#06b6d4'
  ];

  const slices = data.map((d, index) => {
    const percentage = d.value / total;
    const radians = (percentage * Math.PI * 2);
    
    const x1 = cx + r * Math.cos(accumulatedAngle);
    const y1 = cy + r * Math.sin(accumulatedAngle);
    
    accumulatedAngle += radians;
    
    const x2 = cx + r * Math.cos(accumulatedAngle);
    const y2 = cy + r * Math.sin(accumulatedAngle);
    
    const largeArc = percentage > 0.5 ? 1 : 0;
    const color = colors[index % colors.length];
    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      pathData,
      label: d.label,
      value: d.value,
      color,
      percentage: Math.round(percentage * 100)
    };
  });

  const [hovered, setHovered] = useState<{ label: string; value: number; percentage: number } | null>(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
      <div className="sys-chart-container" style={{ width: `${width}px`, height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`}>
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.pathData}
              fill={slice.color}
              style={{ cursor: 'pointer', transition: 'transform 0.2s', transformOrigin: `${cx}px ${cy}px` }}
              onMouseEnter={() => setHovered(slice)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          <circle cx={cx} cy={cy} r={r * 0.6} fill="var(--color-surface-primary)" />
          <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--color-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
            {hovered ? hovered.value.toLocaleString() : total.toLocaleString()}
          </text>
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle" style={{ fill: 'var(--color-text-secondary)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {hovered ? `${hovered.percentage}%` : 'Total'}
          </text>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem' }}>
        {slices.slice(0, 5).map((slice, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: slice.color, borderRadius: '2px' }} />
            <strong>{slice.label}</strong>: {slice.value} ({slice.percentage}%)
          </div>
        ))}
        {slices.length > 5 && <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>+ {slices.length - 5} more...</div>}
      </div>
    </div>
  );
}

// ==========================================
// 2. Unified Analytics Filter Toolbar
// ==========================================

export function AnalyticsFilterBar({ onFilterChange }: { onFilterChange: (filters: Record<string, string>) => void }) {
  const [companyId, setCompanyId] = useState('');
  const [recruiterId, setRecruiterId] = useState('');
  const [department, setDepartment] = useState('');
  const [university, setUniversity] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const companiesQuery = useCollection(adminPaths.companyQueue, { page: 1, limit: 100 });
  const recruitersQuery = useCollection(adminPaths.recruiterQueue, { page: 1, limit: 100 });

  const handleApply = () => {
    onFilterChange({
      ...(companyId && { companyId }),
      ...(recruiterId && { recruiterId }),
      ...(department && { department }),
      ...(university && { university }),
      ...(status && { status }),
      ...(from && to && {
        from: new Date(`${from}T00:00:00Z`).toISOString(),
        to: new Date(`${to}T23:59:59Z`).toISOString()
      })
    });
  };

  return (
    <div className="sys-filter-bar">
      <label>Company
        <select value={companyId} onChange={e => setCompanyId(e.target.value)}>
          <option value="">All Companies</option>
          {companiesQuery.data?.rows?.map((c: AdminRecord) => (
            <option key={recordId(c)} value={recordId(c)}>{rowTitle(c)}</option>
          ))}
        </select>
      </label>
      <label>Recruiter
        <select value={recruiterId} onChange={e => setRecruiterId(e.target.value)}>
          <option value="">All Recruiters</option>
          {recruitersQuery.data?.rows?.map((r: AdminRecord) => (
            <option key={recordId(r)} value={recordId(r)}>{rowTitle(r)}</option>
          ))}
        </select>
      </label>
      <label>Department
        <input placeholder="Engineering, Design..." value={department} onChange={e => setDepartment(e.target.value)} />
      </label>
      <label>University
        <input placeholder="Stanford, MIT..." value={university} onChange={e => setUniversity(e.target.value)} />
      </label>
      <label>Status
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <label>From Date
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
      </label>
      <label>To Date
        <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} />
      </label>
      <button className="sys-button" style={{ alignSelf: 'end' }} onClick={handleApply}>Apply</button>
    </div>
  );
}

// ==========================================
// 3. Sub-Analytics Page Components
// ==========================================

export function UsersAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'users', filters], queryFn: () => adminApi.analytics('users', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const roles = (data.breakdowns?.roles as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="User growth & volume" intro="Track registrations, roles distribution, and verification levels." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating user statistics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Users</span><strong>{Number(summary.total ?? 0).toLocaleString()}</strong><small>Cumulative count</small></article>
            <article><span>Active Accounts</span><strong>{Number(summary.active ?? 0).toLocaleString()}</strong><small>Live on platform</small></article>
            <article><span>Suspended/Inactive</span><strong>{Number(summary.suspendedOrDeactivated ?? 0).toLocaleString()}</strong><small>Deactivated</small></article>
            <article><span>Verified Emails</span><strong>{Number(summary.verifiedEmail ?? 0).toLocaleString()}</strong><small>Security verified</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Registration Growth Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Role Distribution</h3>
              <SVGDonutChart data={roles} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function CompaniesAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'companies', filters], queryFn: () => adminApi.analytics('companies', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const statusBreakdown = (data.breakdowns?.verificationStatus as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];
  const industryBreakdown = (data.breakdowns?.industry as { key: string; count: number }[] | undefined)?.map((item) => ({ label: item.key, value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Company workspace statistics" intro="Track company growths, industries, and approvals." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating company aggregates...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Companies</span><strong>{Number(summary.total ?? 0).toLocaleString()}</strong><small>Cumulative count</small></article>
            <article><span>Verified Companies</span><strong>{Number(summary.verified ?? 0).toLocaleString()}</strong><small>Fully approved</small></article>
            <article><span>Pending Triage</span><strong>{Number(summary.pending ?? 0).toLocaleString()}</strong><small>Awaiting review</small></article>
            <article><span>Suspended Profiles</span><strong>{Number(summary.suspended ?? 0).toLocaleString()}</strong><small>Flagged accounts</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Company Growth Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Verification Status</h3>
              <SVGDonutChart data={statusBreakdown} />
            </div>
            <div className="sys-chart-card" style={{ gridColumn: 'span 2' }}>
              <h3>Industry Distribution</h3>
              <SVGBarChart data={industryBreakdown} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function RecruitersAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'recruiters', filters], queryFn: () => adminApi.analytics('recruiters', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const approval = (data.breakdowns?.approval as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Recruiter performance ledgers" intro="Track recruiter signups, pending queue status, and company memberships." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating recruiter metrics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Recruiters</span><strong>{Number(summary.total ?? 0).toLocaleString()}</strong><small>Cumulative count</small></article>
            <article><span>Approved Accounts</span><strong>{Number(summary.approved ?? 0).toLocaleString()}</strong><small>Active memberships</small></article>
            <article><span>Pending Approvals</span><strong>{Number(summary.pending ?? 0).toLocaleString()}</strong><small>Identity backlog</small></article>
            <article><span>Added In Range</span><strong>{Number(summary.addedInRange ?? 0).toLocaleString()}</strong><small>New additions</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Recruiter Growth Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Recruiter Status Distribution</h3>
              <SVGDonutChart data={approval} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function CandidatesAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'candidates', filters], queryFn: () => adminApi.analytics('candidates', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const topUniversities = (data.breakdowns?.topUniversities as { key: string; count: number }[] | undefined)?.map((item) => ({ label: item.key, value: item.count })) ?? [];
  const topSkills = (data.breakdowns?.topSkills as { key: string; count: number }[] | undefined)?.map((item) => ({ label: item.key, value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Candidate profile aggregations" intro="Verify resume uploads, profile completion, and top universities/skills." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating candidate metrics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Candidate Profiles</span><strong>{Number(summary.totalProfiles ?? 0).toLocaleString()}</strong><small>Cumulative profiles</small></article>
            <article><span>Completed Profiles (&gt;=80%)</span><strong>{Number(summary.completedProfiles ?? 0).toLocaleString()}</strong><small>Complete profiles</small></article>
            <article><span>With Resume Uploads</span><strong>{Number(summary.withResumes ?? 0).toLocaleString()}</strong><small>Searchable talent</small></article>
            <article><span>Hired Candidates</span><strong>{Number(summary.hiredCandidates ?? 0).toLocaleString()}</strong><small>Offers accepted</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Candidate Growth Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Top Candidate Skills</h3>
              <SVGDonutChart data={topSkills} />
            </div>
            <div className="sys-chart-card" style={{ gridColumn: 'span 2' }}>
              <h3>Top Sourced Universities</h3>
              <SVGBarChart data={topUniversities} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function JobsAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'jobs', filters], queryFn: () => adminApi.analytics('jobs', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const statusBreakdown = (data.breakdowns?.status as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Job publishing metrics" intro="Monitor drafts, reviews, pauses, and hiring success rates." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating job statistics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Jobs</span><strong>{Number(summary.total ?? 0).toLocaleString()}</strong><small>Cumulative count</small></article>
            <article><span>Active Published</span><strong>{Number(summary.active ?? 0).toLocaleString()}</strong><small>Open positions</small></article>
            <article><span>Pending Moderator Review</span><strong>{Number(summary.pendingApproval ?? 0).toLocaleString()}</strong><small>Verification queue</small></article>
            <article><span>Closed Positions</span><strong>{Number(summary.closed ?? 0).toLocaleString()}</strong><small>Hiring cycles finished</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Job Creation Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Job Statuses</h3>
              <SVGDonutChart data={statusBreakdown} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function AssessmentAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'assessments', filters], queryFn: () => adminApi.analytics('assessments', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const statusBreakdown = (data.breakdowns?.status as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Assessment platform usage" intro="Verify evaluation pass rates, average scores, and attempt timelines." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating assessment statistics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Assignments</span><strong>{Number(summary.assignments ?? 0).toLocaleString()}</strong><small>Assigned tests</small></article>
            <article><span>Attempts Started</span><strong>{Number(summary.attempts ?? 0).toLocaleString()}</strong><small>Attempts started</small></article>
            <article><span>Average Test Score</span><strong>{Number(summary.averageScore ?? 0).toLocaleString()}%</strong><small>Average percentage</small></article>
            <article><span>Pass Rate</span><strong>{Number(summary.passRate ?? 0).toLocaleString()}%</strong><small>Hiring bar target reached</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Attempts Over Time</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Attempts Status</h3>
              <SVGDonutChart data={statusBreakdown} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function InterviewAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'interviews', filters], queryFn: () => adminApi.analytics('interviews', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const statusBreakdown = (data.breakdowns?.status as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Interview scheduling volumes" intro="Track completed, cancelled, or rescheduled meetings." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating interview metrics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Scheduled Interviews</span><strong>{Number(summary.scheduled ?? 0).toLocaleString()}</strong><small>Interviews scheduled</small></article>
            <article><span>Completed Meetings</span><strong>{Number(summary.completed ?? 0).toLocaleString()}</strong><small>Evaluation done</small></article>
            <article><span>Cancellation Rate</span><strong>{Number(summary.cancellationRate ?? 0).toLocaleString()}%</strong><small>Reschedule or cancel</small></article>
            <article><span>Average Duration</span><strong>{Number(summary.averageDurationMinutes ?? 0).toLocaleString()} mins</strong><small>Average meeting length</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Meetings Scheduled Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Interview Statuses</h3>
              <SVGDonutChart data={statusBreakdown} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function OfferAnalyticsPage() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'offers', filters], queryFn: () => adminApi.analytics('offers', filters) });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};
  const timeline = (data.series as { date: string; value: number }[] | undefined)?.map((item) => ({ label: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }), value: item.value })) ?? [];
  const statusBreakdown = (data.breakdowns?.status as { key: string; count: number }[] | undefined)?.map((item) => ({ label: label(item.key), value: item.count })) ?? [];

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Analytics" title="Offer distribution pipelines" intro="Verify acceptance rates, declined negotiations, and average revisions." />
      <AnalyticsFilterBar onFilterChange={setFilters} />
      {query.isLoading ? <State kind="loading">Calculating offer metrics...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Total Offers Issued</span><strong>{Number(summary.total ?? 0).toLocaleString()}</strong><small>Total templates sent</small></article>
            <article><span>Accepted Offers</span><strong>{Number(summary.accepted ?? 0).toLocaleString()}</strong><small>Candidates joined</small></article>
            <article><span>Acceptance Rate</span><strong>{Number(summary.acceptanceRate ?? 0).toLocaleString()}%</strong><small>Success conversion</small></article>
            <article><span>Average Revisions</span><strong>{Number(summary.averageRevisions ?? 0).toLocaleString()}</strong><small>Negotiation rounds</small></article>
          </section>
          <div className="sys-chart-grid">
            <div className="sys-chart-card">
              <h3>Offers Sent Timeline</h3>
              <SVGLineChart data={timeline} />
            </div>
            <div className="sys-chart-card">
              <h3>Offer States</h3>
              <SVGDonutChart data={statusBreakdown} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}

export function PlatformHealthPage() {
  const query = useQuery({ queryKey: ['system-admin', 'analytics', 'health'], queryFn: () => adminApi.analytics('health', { preset: 'today' }), refetchInterval: 30000 });
  const data = (query.data ?? {}) as any;
  const summary = data.summary ?? {};

  return (
    <main className="sys-page">
      <Header eyebrow="System administration / Diagnostics" title="System pulse & platform health" intro="Review database connection loops, storage reservations, and outbox backlogs." />
      {query.isLoading ? <State kind="loading">Reading system logs...</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : (
        <>
          <section className="sys-pulse" style={{ margin: '24px 0 32px' }}>
            <div><Cpu size={18} /><span><strong>Database State</strong><small>{summary.databaseState}</small></span></div>
            <div><span><strong>Storage Mode</strong><small>{summary.storageProvider}</small></span></div>
            <div><span><strong>Uptime</strong><small>{Number(summary.uptimeSeconds).toLocaleString()} seconds</small></span></div>
            <div><span><strong>Node Version</strong><small>{summary.nodeVersion}</small></span></div>
          </section>
          <section className="sys-metrics">
            <article className="sys-metric--lead"><span>Oldest Outbox Item Age</span><strong>{Number(summary.oldestPendingOutboxAgeSeconds ?? 0).toLocaleString()}s</strong><small>Queue latency</small></article>
            <article><span>Pending outbox events</span><strong>{Number(summary.outboxBacklog ?? 0).toLocaleString()}</strong><small>In-flight notifications</small></article>
            <article><span>Failed outbox tasks</span><strong>{Number(summary.failedOutbox ?? 0).toLocaleString()}</strong><small>Need developer attention</small></article>
            <article><span>Pending provider cleanups</span><strong>{Number(summary.pendingProviderCleanups ?? 0).toLocaleString()}</strong><small>Stale cloud references</small></article>
          </section>
          <div className="sys-detail" style={{ marginTop: '32px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 600 }}>Memory Profiles</h3>
            <dl>
              <div><dt>RSS Memory</dt><dd>{Number(summary.memoryMegabytes?.rss ?? 0).toFixed(2)} MB</dd></div>
              <div><dt>Heap Used</dt><dd>{Number(summary.memoryMegabytes?.heapUsed ?? 0).toFixed(2)} MB</dd></div>
              <div><dt>Storage Uploads Allowed</dt><dd>{summary.uploadsEnabled ? 'Enabled' : 'Disabled'}</dd></div>
            </dl>
          </div>
        </>
      )}
    </main>
  );
}
