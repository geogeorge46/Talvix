import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, Download, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { ApiError } from '../../api/client';
import { adminApi, adminPaths, approvalAction, downloadAnalyticsCsv } from './api';
import { APPLICATION_ADMIN_STATUSES, displayValue, recordId, type AdminRecord, type PageMeta } from './model';
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
  return <main className="sys-page">
    <Header eyebrow="System administration / Overview" title="Platform command center" intro="A UTC-bounded operational ledger for platform health, volume, and queues." actions={<select aria-label="Overview range" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="today">Last 24 hours</option><option value="last-7-days">Last 7 days</option><option value="last-30-days">Last 30 days</option><option value="last-90-days">Last 90 days</option></select>} />
    <section className="sys-pulse" aria-labelledby="pulse-title"><div><Activity size={18} /><span><strong id="pulse-title">Platform pulse</strong><small>Live operational scan · UTC</small></span></div>
      <Link to="/admin/analytics?domain=health"><Status value={healthState} /></Link>
      <Link to="/admin/approvals?queue=recruiters">Recruiters · {recruiterQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <Link to="/admin/approvals?queue=companies">Companies · {companyQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <Link to="/admin/approvals?queue=jobs">Jobs · {jobQueue.data?.meta.total ?? '—'} <ArrowRight size={14} /></Link>
      <time className="sys-mono">Updated {health.dataUpdatedAt ? new Date(health.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</time>
    </section>
    {overview.isLoading ? <State kind="loading">Reading platform metrics…</State> : overview.isError ? <State kind="error">{errorText(overview.error)}</State> :
      <section className="sys-metrics" aria-label="Platform totals">{metrics.length ? metrics.map(([key, value], index) => <article key={key} className={index === 0 ? 'sys-metric--lead' : ''}><span>{label(key)}</span><strong>{Number(value).toLocaleString()}</strong><small>Within selected range</small></article>) : <State kind="empty">No aggregate metrics were returned for this range.</State>}</section>}
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
  applications: { path: adminPaths.applications, detail: '/admin/operations/applications' },
  assessments: { path: adminPaths.assignments, detail: '/admin/operations/assessments' },
  interviews: { path: adminPaths.interviews, detail: '/admin/operations/interviews' },
  offers: { path: adminPaths.offers, detail: '/admin/operations/offers' },
  documents: { path: adminPaths.documents, detail: '/admin/operations/documents' },
};
export function AdminOperationsPage() {
  const [sp, setSp] = useSearchParams(); const view = (sp.get('view') ?? 'applications') as keyof typeof operations; const active = operations[view] ?? operations.applications;
  const [page, setPage] = useState(1); const [lookupType, setLookupType] = useState<'attempts' | 'schedules' | 'feedback'>('attempts'); const [lookupId, setLookupId] = useState('');
  const query = useCollection(active.path, { page, limit: 20 });
  return <main className="sys-page"><Header eyebrow="System administration / Operations" title="Corrective operations" intro="Inspect cross-tenant records and use only backend-supported interventions." />
    <div className="sys-tabs" role="tablist">{Object.keys(operations).map((key) => <button role="tab" aria-selected={view === key} key={key} onClick={() => { setPage(1); setSp({ view: key }); }}>{label(key)}</button>)}</div>
    {query.isLoading ? <State kind="loading">Loading {view}…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : query.data?.rows.length ? <><LedgerTable rows={query.data.rows} detailBase={active.detail} /><Pager page={page} setPage={setPage} meta={query.data.meta} /></> : <State kind="empty">No {view} records were returned.</State>}
    <section className="sys-lookup"><div><p className="sys-eyebrow">Specialist correction</p><h2>Open a linked operational record</h2><p>Use an identifier from an assignment or interview process to inspect attempts, schedules, or feedback.</p></div><label>Record type<select value={lookupType} onChange={(e) => setLookupType(e.target.value as typeof lookupType)}><option value="attempts">Assessment attempt</option><option value="schedules">Interview schedule</option><option value="feedback">Interview feedback</option></select></label><label>Record ID<input className="sys-mono" value={lookupId} onChange={(e) => setLookupId(e.target.value.trim())} placeholder="24-character ID" /></label>{objectId.test(lookupId) ? <Link className="sys-button" to={`/admin/operations/${lookupType}/${lookupId}`}>Inspect record</Link> : <button className="sys-button" disabled>Inspect record</button>}</section>
  </main>;
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
  const params = useMemo(() => from && to ? { from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59Z`).toISOString() } : { preset: '30d' }, [from, to]);
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
    <section className="sys-analytics-controls"><label>Domain<select value={domain} onChange={(e) => setSp({ domain: e.target.value })}>{domains.map((d) => <option key={d}>{d}</option>)}</select></label><label>From (UTC)<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To (UTC)<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label><button className="sys-button" disabled={exporting || Boolean(from) !== Boolean(to)} onClick={download}><Download size={15} />{exporting ? 'Preparing…' : 'Export CSV'}</button></section>
    {exportError && <p className="sys-error" role="alert">{exportError}</p>}
    {query.isLoading ? <State kind="loading">Calculating aggregates…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : <section className="sys-metrics">{Object.entries(summary).filter(([, v]) => typeof v === 'number').map(([key, value]) => <article key={key}><span>{label(key)}</span><strong>{Number(value).toLocaleString()}</strong><small>Aggregate count</small></article>)}</section>}
  </main>;
}
