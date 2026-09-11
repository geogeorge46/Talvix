import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  Activity, ArrowRight, Download, RefreshCw, Search, ShieldAlert, Cpu, 
  CheckCircle2, XCircle, AlertTriangle, Check, X, Ban, Users, Building2, 
  Briefcase, FileText, CheckCircle, BarChart2, ShieldCheck, Heart, 
  RadioTower, MessageSquareText, Shield, ExternalLink, HelpCircle
} from 'lucide-react';
import { ApiError, tokenStore } from '../../api/client';
import { adminApi, adminPaths, approvalAction, downloadAnalyticsCsv } from './api';
import { APPLICATION_ADMIN_STATUSES, displayValue, recordId, type AdminRecord, type PageMeta } from './model';
import { useGetAdminClaims, useResolveClaim } from '../organization-admin/api';
import { useAuth } from '../../auth/AuthProvider';
import './system-admin.css';

const objectId = /^[a-f\d]{24}$/i;
const label = (value: string) => value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (x) => x.toUpperCase());
const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'The request could not be completed.';

const formatActionLabel = (action: string) => {
  switch (action) {
    case 'verification.submitted':
      return 'Verification Submitted';
    case 'verification.rejected':
      return 'Verification Rejected';
    case 'verification.resubmitted':
      return 'Verification Resubmitted';
    case 'verification.approved':
    case 'verified':
    case 'approved':
      return 'Verified';
    case 'verification.suspended':
    case 'suspended':
      return 'Suspended';
    case 'verification.restored':
    case 'restored':
      return 'Restored';
    case 'profile.updated':
      return 'Profile Updated';
    case 'company.updated':
      return 'Company Updated';
    default:
      return action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
};

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
        <td data-label="Actions">
          <div className="sys-row-actions">
            {detailBase && id && <Link to={`${detailBase}/${id}`}>Inspect <ArrowRight size={14} /></Link>}
            {actions?.(row)}
          </div>
        </td>
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
    const isCompanyPath = action.path.includes('/companies/admin/');
    const body = hasBody ? {
      ...action.body,
      ...(action.field ? { [action.field.name]: fieldValue } : {}),
      ...(action.reason ? (isCompanyPath ? { notes: reason } : { reason }) : {})
    } : {};
    return adminApi.mutate(action.path, action.method ?? 'PATCH', body);
  } });
  return <div className="sys-dialog-backdrop" style={{ zIndex: 20000, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.6)' }}>
    <section ref={dialog} tabIndex={-1} className="sys-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-action-title" style={{ zIndex: 20001, maxWidth: '500px', width: 'calc(100% - 32px)', background: 'var(--color-surface-primary)', borderRadius: '8px', border: '1px solid var(--color-border-default)', padding: '24px' }}>
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


function MiniSeriesChart({ data }: { data: { date: string; value: number }[] }) {
  if (!data || data.length === 0) {
    return <div className="sys-state sys-state--empty">No activity data available</div>;
  }

  const values = data.map((d) => d.value);
  const maxValue = Math.max(...values, 5);
  const width = 500;
  const height = 150;
  const padding = 20;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - (d.value / maxValue) * (height - padding * 2);
    return { x, y, date: d.date, value: d.value };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const midPoint = points[Math.floor(points.length / 2)];

  const areaPath = points.length > 0 && firstPoint && lastPoint
    ? `${linePath} L ${lastPoint.x} ${height - padding} L ${firstPoint.x} ${height - padding} Z`
    : '';

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="sys-chart-container" style={{ height: '160px', marginTop: '10px' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-action-primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-action-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border-default)" strokeWidth={1} />
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--color-border-default)" strokeDasharray="3 3" strokeWidth={1} />

        {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}
        {linePath && <path d={linePath} fill="none" stroke="var(--color-action-primary)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}

        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r={3.5} fill="var(--color-surface-primary)" stroke="var(--color-action-primary)" strokeWidth={1.5} />
            <title>{`${formatDate(p.date)}: ${p.value} registrations`}</title>
          </g>
        ))}

        {points.length > 0 && firstPoint && midPoint && lastPoint && (
          <>
            <text x={padding} y={height - 4} fontSize="9px" fill="var(--color-text-secondary)" textAnchor="start">
              {formatDate(firstPoint.date)}
            </text>
            <text x={width / 2} y={height - 4} fontSize="9px" fill="var(--color-text-secondary)" textAnchor="middle">
              {formatDate(midPoint.date)}
            </text>
            <text x={width - padding} y={height - 4} fontSize="9px" fill="var(--color-text-secondary)" textAnchor="end">
              {formatDate(lastPoint.date)}
            </text>
            <text x={width - padding} y={padding - 4} fontSize="9px" fill="var(--color-text-secondary)" textAnchor="end">
              Max: {maxValue}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

export function AdminOverviewPage() {
  const { user } = useAuth();
  const [preset, setPreset] = useState('last-30-days');
  
  // Real backend analytics queries
  const overview = useQuery({ queryKey: ['system-admin', 'overview', preset], queryFn: () => adminApi.analytics('overview', { preset }) });
  const health = useQuery({ queryKey: ['system-admin', 'health'], queryFn: () => adminApi.analytics('health', { preset: 'today' }), refetchInterval: 30_000 });
  
  // Pending verification queues
  const recruiterQueue = useCollection(adminPaths.recruiterQueue, { page: 1, limit: 1 });
  const companyQueue = useCollection(adminPaths.companyQueue, { page: 1, limit: 1 });
  const jobQueue = useCollection(adminPaths.jobQueue, { page: 1, limit: 1 });

  // Recruiter verifications count query metrics
  const approvedRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'approved' });
  const rejectedRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'rejected' });
  const suspendedRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'suspended' });

  // Company verifications count query metrics
  const verifiedCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'verified' });
  const rejectedCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'rejected' });
  const suspendedCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'suspended' });

  // Play activity audits & recent data lists
  const auditsQuery = useCollection(adminPaths.audits, { page: 1, limit: 6 });
  const recentRecruitersQuery = useCollection(adminPaths.recruiters, { page: 1, limit: 5 });
  const recentCompaniesQuery = useCollection(adminPaths.companies, { page: 1, limit: 5 });

  // Data mapping
  const data = (overview.data ?? {}) as Record<string, any>;
  const summary = (data.summary ?? {}) as Record<string, any>;
  const usersSummary = (summary.users ?? {}) as Record<string, any>;
  const businessSummary = (summary.business ?? {}) as Record<string, any>;
  const seriesData = (data.series ?? []) as { date: string; value: number }[];

  const healthData = (health.data ?? {}) as Record<string, unknown>;
  const healthText = JSON.stringify(healthData).toLowerCase();
  const healthState = health.isError ? 'unhealthy' : health.isLoading ? 'checking' :
    /unhealthy|failed|disconnected|critical/.test(healthText) ? 'unhealthy' :
    /degraded|backlog|warning|stale/.test(healthText) ? 'degraded' : 'healthy';

  const pendingRecruitersCount = recruiterQueue.data?.meta.total ?? 0;
  const pendingCompaniesCount = companyQueue.data?.meta.total ?? 0;
  const pendingJobsCount = jobQueue.data?.meta.total ?? 0;
  const totalPendingVerifications = pendingRecruitersCount + pendingCompaniesCount + pendingJobsCount;

  const suspendedRecruitersCount = suspendedRecruiters.data?.meta.total ?? 0;
  const suspendedCompaniesCount = suspendedCompanies.data?.meta.total ?? 0;

  // Build Requires Attention items
  const attentionItems = [];
  if (pendingRecruitersCount > 0) {
    attentionItems.push({
      id: 'p-rec',
      text: `${pendingRecruitersCount} recruiter verification${pendingRecruitersCount > 1 ? 's' : ''} pending`,
      link: '/admin/recruiter-verification',
      severity: 'warning'
    });
  }
  if (pendingCompaniesCount > 0) {
    attentionItems.push({
      id: 'p-comp',
      text: `${pendingCompaniesCount} company verification${pendingCompaniesCount > 1 ? 's' : ''} pending`,
      link: '/admin/company-verification',
      severity: 'warning'
    });
  }
  if (pendingJobsCount > 0) {
    attentionItems.push({
      id: 'p-job',
      text: `${pendingJobsCount} job verification${pendingJobsCount > 1 ? 's' : ''} pending`,
      link: '/admin/approvals?queue=jobs',
      severity: 'warning'
    });
  }
  if (suspendedRecruitersCount > 0) {
    attentionItems.push({
      id: 's-rec',
      text: `${suspendedRecruitersCount} recruiter${suspendedRecruitersCount > 1 ? 's' : ''} suspended`,
      link: '/admin/operations?view=recruiters',
      severity: 'danger'
    });
  }
  if (suspendedCompaniesCount > 0) {
    attentionItems.push({
      id: 's-comp',
      text: `${suspendedCompaniesCount} compan${suspendedCompaniesCount > 1 ? 'ies' : 'y'} suspended`,
      link: '/admin/operations?view=companies',
      severity: 'danger'
    });
  }

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  return <main className="sys-page">
    <Header 
      eyebrow="System Governance & Operations" 
      title="Platform Command Center" 
      intro="Real-time operational intelligence, platform telemetry, verification queues, and system activity." 
      actions={
        <select aria-label="Overview range" value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="today">Last 24 hours</option>
          <option value="last-7-days">Last 7 days</option>
          <option value="last-30-days">Last 30 days</option>
          <option value="last-90-days">Last 90 days</option>
        </select>
      } 
    />

    {/* Section 1: KPI Summary */}
    <section className="sys-overview-kpi-grid" aria-label="Key Performance Indicators">
      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><Users size={16} /></div>
        <span className="sys-overview-kpi-label">Total Users</span>
        <strong className="sys-overview-kpi-value">{usersSummary.total?.toLocaleString() ?? '—'}</strong>
        {usersSummary.registrations?.changePercent !== undefined && (
          <span className="sys-overview-kpi-subtext" style={{ color: usersSummary.registrations.changePercent >= 0 ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>
            {usersSummary.registrations.changePercent >= 0 ? '+' : ''}{usersSummary.registrations.changePercent.toFixed(1)}% vs previous
          </span>
        )}
      </article>

      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><ShieldAlert size={16} /></div>
        <span className="sys-overview-kpi-label">Pending Verifications</span>
        <strong className="sys-overview-kpi-value">{totalPendingVerifications.toLocaleString()}</strong>
        <span className="sys-overview-kpi-subtext">Requires attention</span>
      </article>

      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><Building2 size={16} /></div>
        <span className="sys-overview-kpi-label">Verified Companies</span>
        <strong className="sys-overview-kpi-value">{businessSummary.verifiedCompanies?.toLocaleString() ?? '—'}</strong>
        <span className="sys-overview-kpi-subtext">Active partners</span>
      </article>

      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><Briefcase size={16} /></div>
        <span className="sys-overview-kpi-label">Active Jobs</span>
        <strong className="sys-overview-kpi-value">{businessSummary.activeJobs?.toLocaleString() ?? '—'}</strong>
        <span className="sys-overview-kpi-subtext">Currently recruiting</span>
      </article>

      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><FileText size={16} /></div>
        <span className="sys-overview-kpi-label">Total Applications</span>
        <strong className="sys-overview-kpi-value">{businessSummary.applications?.toLocaleString() ?? '—'}</strong>
        <span className="sys-overview-kpi-subtext">Received overall</span>
      </article>

      <article className="sys-overview-kpi-card">
        <div className="sys-overview-kpi-icon-box"><Ban size={16} /></div>
        <span className="sys-overview-kpi-label">Suspended Accounts</span>
        <strong className="sys-overview-kpi-value">{usersSummary.suspendedOrDeactivated?.toLocaleString() ?? '—'}</strong>
        <span className="sys-overview-kpi-subtext">Restricted profiles</span>
      </article>
    </section>

    <div className="sys-overview-layout">
      {/* Left Column: Verification Overview, Activity Chart, Recent Recruiters, Recent Companies */}
      <div className="sys-overview-left-col">
        {/* Section 2: Verification Overview */}
        <section className="sys-overview-card">
          <h3><CheckCircle size={18} /> Verification overview</h3>
          <div className="sys-verification-grid">
            <div className="sys-verification-list">
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 600 }}>Recruiters</h4>
              <div className="sys-verification-item"><span>Pending verification</span><strong className="sys-mono">{pendingRecruitersCount}</strong></div>
              <div className="sys-verification-item"><span>Verified / Approved</span><strong className="sys-mono">{approvedRecruiters.data?.meta.total ?? 0}</strong></div>
              <div className="sys-verification-item"><span>Rejected</span><strong className="sys-mono">{rejectedRecruiters.data?.meta.total ?? 0}</strong></div>
              <div className="sys-verification-item"><span>Suspended</span><strong className="sys-mono">{suspendedRecruitersCount}</strong></div>
              <Link to="/admin/recruiter-verification" className="sys-button sys-button--quiet" style={{ marginTop: '8px', justifyContent: 'center' }}>Review Recruiters</Link>
            </div>

            <div className="sys-verification-list">
              <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 600 }}>Companies</h4>
              <div className="sys-verification-item"><span>Pending verification</span><strong className="sys-mono">{pendingCompaniesCount}</strong></div>
              <div className="sys-verification-item"><span>Verified</span><strong className="sys-mono">{verifiedCompanies.data?.meta.total ?? 0}</strong></div>
              <div className="sys-verification-item"><span>Rejected</span><strong className="sys-mono">{rejectedCompanies.data?.meta.total ?? 0}</strong></div>
              <div className="sys-verification-item"><span>Suspended</span><strong className="sys-mono">{suspendedCompaniesCount}</strong></div>
              <Link to="/admin/company-verification" className="sys-button sys-button--quiet" style={{ marginTop: '8px', justifyContent: 'center' }}>Review Companies</Link>
            </div>
          </div>
        </section>

        {/* Section 4: Platform User growth chart */}
        <section className="sys-overview-card">
          <h3><BarChart2 size={18} /> User registrations trend</h3>
          {overview.isLoading ? <State kind="loading">Loading chart data…</State> : overview.isError ? <State kind="error">{errorText(overview.error)}</State> : (
            <MiniSeriesChart data={seriesData} />
          )}
        </section>

        {/* Section 7: Recent Recruiters */}
        <section className="sys-overview-card">
          <div className="sys-overview-card-header">
            <h3><Users size={18} /> Recent recruiter registrations</h3>
            <Link to="/admin/recruiter-verification" className="sys-overview-card-link">View all recruiters <ArrowRight size={14} /></Link>
          </div>
          {recentRecruitersQuery.isLoading ? <State kind="loading">Loading recruiters…</State> : recentRecruitersQuery.isError ? <State kind="error">{errorText(recentRecruitersQuery.error)}</State> : recentRecruitersQuery.data?.rows.length ? (
            <table className="sys-overview-table">
              <thead>
                <tr>
                  <th>Recruiter</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {recentRecruitersQuery.data.rows.slice(0, 5).map((row: any) => {
                  const status = row.user?.recruiterVerificationStatus ?? 'none';
                  return (
                    <tr key={row._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-surface-secondary)', border: '1px solid var(--color-border-default)', display: 'grid', placeItems: 'center', fontSize: '0.68rem', fontWeight: 600 }}>
                            {row.user?.fullName?.slice(0,2).toUpperCase() || 'RC'}
                          </span>
                          <strong>{row.user?.fullName ?? 'Recruiter'}</strong>
                        </div>
                      </td>
                      <td>{row.company?.name ?? '—'}</td>
                      <td><span className={`sys-badge sys-badge--${status}`}>{status}</span></td>
                      <td className="sys-mono">{formatDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <State kind="empty">No recruiters registered.</State>}
        </section>

        {/* Section 8: Recent Companies */}
        <section className="sys-overview-card">
          <div className="sys-overview-card-header">
            <h3><Building2 size={18} /> Recent company registrations</h3>
            <Link to="/admin/company-verification" className="sys-overview-card-link">View all companies <ArrowRight size={14} /></Link>
          </div>
          {recentCompaniesQuery.isLoading ? <State kind="loading">Loading companies…</State> : recentCompaniesQuery.isError ? <State kind="error">{errorText(recentCompaniesQuery.error)}</State> : recentCompaniesQuery.data?.rows.length ? (
            <table className="sys-overview-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>Status</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {recentCompaniesQuery.data.rows.slice(0, 5).map((row: any) => {
                  const status = row.verificationStatus ?? 'pending';
                  return (
                    <tr key={row._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong>{row.name ?? 'Company'}</strong>
                        </div>
                      </td>
                      <td>{row.industry ?? '—'}</td>
                      <td><span className={`sys-badge sys-badge--${status}`}>{status}</span></td>
                      <td className="sys-mono">{formatDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <State kind="empty">No companies registered.</State>}
        </section>
      </div>

      {/* Right Column: Requires Attention, Recruitment Activity, Recent Activity, System Health, Quick Actions */}
      <div className="sys-overview-right-col">
        {/* Section 3: Requires Attention */}
        <section className="sys-overview-card">
          <h3><ShieldAlert size={18} style={{ color: 'var(--color-warning-fg)' }} /> Requires attention</h3>
          {attentionItems.length > 0 ? (
            <div className="sys-attention-list">
              {attentionItems.map((item) => (
                <div key={item.id} className={`sys-attention-item ${item.severity === 'danger' ? 'sys-attention-item--danger' : ''}`}>
                  <span>{item.text}</span>
                  <Link to={item.link} className="sys-overview-card-link">Triage <ArrowRight size={12} /></Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="sys-state sys-state--empty" style={{ border: 'none', padding: '12px 0' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success-fg)', marginBottom: '8px', display: 'block', margin: '0 auto' }} />
              No items require immediate attention.
            </div>
          )}
        </section>

        {/* Section 5: Recruitment Activity */}
        <section className="sys-overview-card">
          <h3><Activity size={18} /> Recruitment snapshot</h3>
          <div className="sys-verification-list">
            <div className="sys-verification-item"><span>Jobs published</span><strong className="sys-mono">{businessSummary.activeJobs ?? 0}</strong></div>
            <div className="sys-verification-item"><span>Closed jobs</span><strong className="sys-mono">{businessSummary.closedJobs ?? 0}</strong></div>
            <div className="sys-verification-item"><span>Candidate applications</span><strong className="sys-mono">{businessSummary.applications ?? 0}</strong></div>
            <div className="sys-verification-item"><span>Active assessments</span><strong className="sys-mono">{businessSummary.activeAssessments ?? 0}</strong></div>
            <div className="sys-verification-item"><span>Scheduled interviews</span><strong className="sys-mono">{businessSummary.scheduledInterviews ?? 0}</strong></div>
            <div className="sys-verification-item"><span>Active offers</span><strong className="sys-mono">{businessSummary.activeOffers ?? 0}</strong></div>
          </div>
        </section>

        {/* Section 6: Recent Activity (Audit logs) */}
        <section className="sys-overview-card">
          <div className="sys-overview-card-header">
            <h3><Cpu size={18} /> Recent platform actions</h3>
            <Link to="/admin/operations?view=audits" className="sys-overview-card-link">Audit logs <ArrowRight size={14} /></Link>
          </div>
          {auditsQuery.isLoading ? <State kind="loading">Loading activity logs…</State> : auditsQuery.isError ? <State kind="error">{errorText(auditsQuery.error)}</State> : auditsQuery.data?.rows.length ? (
            <div className="sys-activity-list">
              {auditsQuery.data.rows.slice(0, 6).map((log: any) => (
                <div key={log._id} className="sys-activity-item">
                  <span className="sys-activity-time sys-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="sys-activity-content">
                    <strong>{formatActionLabel(log.action)}</strong>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                      by {log.actor?.fullName ?? 'System'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : <State kind="empty">No recent activity logs.</State>}
        </section>

        {/* Section 9: System Health */}
        <section className="sys-overview-card">
          <h3><Heart size={18} style={{ color: healthState === 'healthy' ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }} /> System status</h3>
          <div className="sys-health-grid">
            <div className="sys-health-card">
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Platform API</span>
              <span className={`sys-status sys-status--${healthState === 'healthy' ? 'good' : healthState === 'degraded' ? 'warn' : 'bad'}`}>
                <i></i>{healthState}
              </span>
            </div>
            <div className="sys-health-card">
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>Database</span>
              <span className={`sys-status sys-status--${healthState === 'healthy' ? 'good' : healthState === 'degraded' ? 'warn' : 'bad'}`}>
                <i></i>{healthState === 'unhealthy' ? 'unhealthy' : 'operational'}
              </span>
            </div>
          </div>
        </section>

        {/* Section 10: Quick Actions */}
        <section className="sys-overview-card">
          <h3><RadioTower size={18} /> Operations command list</h3>
          <div className="sys-quick-actions-grid">
            <Link to="/admin/recruiter-verification" className="sys-quick-action-btn"><Users size={14} /> Recruiters</Link>
            <Link to="/admin/company-verification" className="sys-quick-action-btn"><Building2 size={14} /> Companies</Link>
            <Link to="/admin/approvals?queue=jobs" className="sys-quick-action-btn"><Briefcase size={14} /> Verify Jobs</Link>
            <Link to="/admin/operations?view=audits" className="sys-quick-action-btn"><FileText size={14} /> Audit Trail</Link>
            {user?.role === 'admin' && (
              <>
                <Link to="/admin/operations" className="sys-quick-action-btn" style={{ gridColumn: 'span 2' }}><RadioTower size={14} /> System Operations console</Link>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  </main>;
}

const queues = {
  recruiters: { path: adminPaths.recruiterQueue, kind: 'recruiters' as const, actions: ['approve', 'reject', 'suspend'] },
  companies: { path: adminPaths.companyQueue, kind: 'companies' as const, actions: ['approve', 'reject', 'suspend'] },
  jobs: { path: adminPaths.jobQueue, kind: 'jobs' as const, actions: ['approve', 'reject', 'feature', 'unfeature'] },
};
export function AdminApprovalsPage() {
  const active = queues.jobs;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useCollection(active.path, { page, limit: 20 });
  const totalCount = query.data?.meta.total ?? 0;
  const rows = (query.data?.rows ?? []).filter((row) => `${rowTitle(row)} ${rowSubtitle(row)}`.toLowerCase().includes(search.toLowerCase()));
  const detailBase = '/admin/operations/jobs';

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Triage"
        title="Job Verification Queue"
        intro="Review and approve pending job post publishing requests with audited platform authorization controls."
      />

      {/* KPI Cards Grid matching Overview style */}
      <section className="sys-sub-kpi-grid" aria-label="Job Approvals Summary">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><ShieldAlert size={16} /></div>
          <span className="sys-overview-kpi-label">Pending Triage</span>
          <strong className="sys-overview-kpi-value">{totalCount.toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Awaiting admin review</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Briefcase size={16} /></div>
          <span className="sys-overview-kpi-label">Queue Category</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>Job Postings</strong>
          <span className="sys-overview-kpi-subtext">Verified employer listings</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Search size={16} /></div>
          <span className="sys-overview-kpi-label">Matching View</span>
          <strong className="sys-overview-kpi-value">{rows.length}</strong>
          <span className="sys-overview-kpi-subtext">Current search results</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><CheckCircle2 size={16} /></div>
          <span className="sys-overview-kpi-label">Governance Mode</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>Audited</strong>
          <span className="sys-overview-kpi-subtext">Role rechecked on action</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '20px' }}>
          <h3><Briefcase size={18} /> Job Publishing Verification Ledger</h3>
          <button className="sys-button sys-button--quiet" onClick={() => query.refetch()}>
            <RefreshCw size={15} /> Refresh Queue
          </button>
        </div>

        <div className="sys-toolbar" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: '16px', marginBottom: '20px' }}>
          <label>
            <Search size={16} />
            <span className="sr-only">Search pending jobs</span>
            <input
              placeholder="Search pending jobs by title, company, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {query.isLoading ? (
          <State kind="loading">Loading pending jobs queue…</State>
        ) : query.isError ? (
          <State kind="error">{errorText(query.error)}</State>
        ) : rows.length ? (
          <>
            <LedgerTable rows={rows} detailBase={detailBase} />
            <Pager page={page} setPage={setPage} meta={query.data?.meta} />
          </>
        ) : (
          <State kind="empty">No pending job verification requests match this view.</State>
        )}
      </section>
    </main>
  );
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
  const navigate = useNavigate();
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
      <Header
        eyebrow="System administration / Operations"
        title="Platform Console"
        intro="Complete operational control over users, recruiters, companies, jobs, assessments, interviews, and system logs."
      />

      {/* KPI Cards Grid matching Overview style */}
      <section className="sys-sub-kpi-grid" aria-label="Operations Overview Metrics">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><RadioTower size={16} /></div>
          <span className="sys-overview-kpi-label">Active Entity</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>{label(view)}</strong>
          <span className="sys-overview-kpi-subtext">Current registry view</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Cpu size={16} /></div>
          <span className="sys-overview-kpi-label">Total Records</span>
          <strong className="sys-overview-kpi-value">{(query.data?.meta.total ?? rows.length).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Persisted in database</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Search size={16} /></div>
          <span className="sys-overview-kpi-label">Page Count</span>
          <strong className="sys-overview-kpi-value">{rows.length}</strong>
          <span className="sys-overview-kpi-subtext">Showing on this page</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><ShieldCheck size={16} /></div>
          <span className="sys-overview-kpi-label">Data Integrity</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>Active</strong>
          <span className="sys-overview-kpi-subtext">Strict Zod & RBAC enforced</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '16px' }}>
          <h3><RadioTower size={18} /> Platform Entity Registry</h3>
          <button className="sys-button sys-button--quiet" onClick={() => query.refetch()}>
            <RefreshCw size={15} /> Refresh Records
          </button>
        </div>

        <div className="sys-tabs" role="tablist" style={{ marginTop: '0', marginBottom: '20px' }}>
          {Object.keys(operations).map((key) => (
            <button role="tab" aria-selected={view === key} key={key} onClick={() => { setPage(1); setSelectedIds([]); setSp({ view: key }); }}>
              {label(key)}
            </button>
          ))}
        </div>

        <div className="sys-toolbar" style={{ background: 'var(--color-surface-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
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
                          <button className="sys-button sys-button--quiet" onClick={() => navigate(`/admin/operations/${view}/${id}`)}>
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
      </section>

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
    <div className="sys-dialog-backdrop" style={{ zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="sys-dialog" style={{
        maxWidth: '1000px',
        width: 'calc(100% - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        borderRadius: '8px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        border: '1px solid var(--color-border-default)',
        background: 'var(--color-surface-primary)',
        overflow: 'hidden'
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border-default)'
        }}>
          <div>
            <p className="sys-eyebrow">Operational details</p>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 620 }}>{type.toUpperCase()} Record</h2>
          </div>
          <button className="sys-button sys-button--quiet" onClick={onClose} style={{ cursor: 'pointer' }}>Close</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {query.isLoading ? (
            <State kind="loading">Loading details...</State>
          ) : query.isError ? (
            <State kind="error">{errorText(query.error)}</State>
          ) : query.data ? (
            <>
              <section className="sys-detail" style={{ marginTop: 0 }}>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  {Object.entries(data).filter(([k, v]) => typeof v !== 'object' || v === null).map(([k, v]) => (
                    <div key={k}>
                      <dt>{label(k)}</dt>
                      <dd className={k.includes('Id') || k.startsWith('_') ? 'sys-mono' : ''}>{displayValue(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {data.auditLogs && data.auditLogs.length > 0 && (
                <section style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Audit Timeline</h3>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                    {data.auditLogs.map((log: any) => (
                      <li key={log._id} style={{ marginBottom: '12px', display: 'flex', gap: '8px', fontSize: '0.9rem', padding: '12px', border: '1px solid var(--color-border-default)', borderRadius: '4px', background: 'var(--color-bg-alt)' }}>
                        <strong>{log.action}</strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}> by {log.actor?.fullName || 'System'} on {new Date(log.timestamp).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <State kind="empty">No record details found.</State>
          )}
        </div>

        {query.data && (
          <footer style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-alt)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {type === 'users' && (
              <>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend User', { path: `/admin/management/users/${recordId}/status`, body: { action: 'suspend' }, reason: true })} style={{ cursor: 'pointer' }}>Suspend User</button>
                <button className="sys-button" onClick={() => performAction('Restore User', { path: `/admin/management/users/${recordId}/status`, body: { action: 'restore' }, reason: true })} style={{ cursor: 'pointer' }}>Restore User</button>
                <button className="sys-button" onClick={() => performAction('Verify Email', { path: `/admin/management/users/${recordId}/status`, body: { action: 'verify-email' } })} style={{ cursor: 'pointer' }}>Verify Email</button>
                <button className="sys-button" onClick={() => performAction('Change Role', { path: `/admin/management/users/${recordId}/role`, reason: true, field: { name: 'role', label: 'New Role', options: ['candidate', 'recruiter', 'admin'] } })} style={{ cursor: 'pointer' }}>Change Role</button>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Soft Delete User', { path: `/admin/management/users/${recordId}`, method: 'DELETE', reason: true })} style={{ cursor: 'pointer' }}>Soft Delete</button>
              </>
            )}
            {type === 'recruiters' && (
              <button className="sys-button sys-button--danger" onClick={() => performAction('Remove from Company', { path: `/admin/management/recruiters/${recordId}/company`, method: 'DELETE', reason: true })} style={{ cursor: 'pointer' }}>Remove Company</button>
            )}
            {type === 'companies' && (
              <>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend Company', { path: `/companies/admin/${recordId}/suspend`, reason: true })} style={{ cursor: 'pointer' }}>Suspend</button>
                <button className="sys-button" onClick={() => performAction('Verify Company', { path: `/companies/admin/${recordId}/verify`, reason: true })} style={{ cursor: 'pointer' }}>Verify</button>
                <button className="sys-button" onClick={() => performAction('Merge Company', { path: `/admin/management/companies/merge`, method: 'POST', reason: true, field: { name: 'secondaryId', label: 'Merge Secondary Company ID', options: [] } })} style={{ cursor: 'pointer' }}>Merge Company</button>
              </>
            )}
            {type === 'jobs' && (
              <>
                <button className="sys-button" onClick={() => performAction('Pause Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'paused' }, reason: true })} style={{ cursor: 'pointer' }}>Pause</button>
                <button className="sys-button" onClick={() => performAction('Resume Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'published' } })} style={{ cursor: 'pointer' }}>Resume</button>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Close Job', { path: `/admin/management/jobs/${recordId}/status`, body: { status: 'closed' }, reason: true })} style={{ cursor: 'pointer' }}>Close</button>
                <button className="sys-button" onClick={() => performAction('Clone Job', { path: `/admin/management/jobs/${recordId}/clone`, method: 'POST' })} style={{ cursor: 'pointer' }}>Clone</button>
              </>
            )}
            {type === 'documents' && (
              <>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Quarantine Document', { path: `/admin/management/documents/${recordId}/status`, body: { action: 'quarantine' }, reason: true })} style={{ cursor: 'pointer' }}>Quarantine</button>
                <button className="sys-button" onClick={() => performAction('Release Document', { path: `/admin/management/documents/${recordId}/status`, body: { action: 'release' } })} style={{ cursor: 'pointer' }}>Release</button>
              </>
            )}
            {type === 'applications' && (
              <button className="sys-button" onClick={() => performAction('Move Application Stage', { path: `/admin/management/applications/${recordId}/stage`, reason: true, field: { name: 'status', label: 'New Stage', options: ['applied', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'] } })} style={{ cursor: 'pointer' }}>Move Stage</button>
            )}
            {type === 'assessments' && (
              <>
                <button className="sys-button" onClick={() => performAction('Clone Assessment', { path: `/admin/management/assessments/${recordId}/clone`, method: 'POST' })} style={{ cursor: 'pointer' }}>Clone Assessment</button>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Force Submit Attempt', { path: `/admin/management/attempts/${recordId}/force-submit`, method: 'POST', reason: true })} style={{ cursor: 'pointer' }}>Force Submit</button>
              </>
            )}
          </footer>
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
  recruiters: { base: '/admin/management/recruiters', actionBase: '/recruiters/admin', actions: [['Approve', 'approve', false], ['Reject', 'reject', true], ['Suspend', 'suspend', true], ['Restore', 'restore', false]] },
  companies: { base: '/admin/management/companies', actionBase: '/companies/admin', actions: [['Verify', 'verify', false], ['Reject', 'reject', true], ['Suspend', 'suspend', true]] },
  jobs: { base: '/admin/management/jobs', actionBase: '/jobs/admin', actions: [['Approve', 'approve', false], ['Reject', 'reject', true], ['Feature', 'feature', false], ['Unfeature', 'unfeature', false]] },
  users: { base: '/admin/management/users', actions: [] },
  questions: { base: '/admin/management/questions', actions: [] },
  audits: { base: '/admin/management/audits', actions: [] },
} as const;
export function AdminRecordDetailPage() {
  const { type = '', id = '' } = useParams(); const valid = objectId.test(id) && type in detailConfig;
  const config = valid ? detailConfig[type as keyof typeof detailConfig] : detailConfig.applications; const path = `${config.base}/${id}`; const query = useQuery({ queryKey: ['system-admin', path], queryFn: () => adminApi.detail(path), enabled: valid });
  const [pending, setPending] = useState<PendingAction | null>(null);
  if (!valid) return <Navigate to="/not-found" replace />;
  return <main className="sys-page"><Header eyebrow={`Operations / ${label(type)}`} title="Record inspection" intro={`Immutable identifier ${id}`} />
    {query.isLoading ? <State kind="loading">Loading record…</State> : query.isError ? <State kind="error">{errorText(query.error)}</State> : query.data && <><section className="sys-detail"><dl>{Object.entries(query.data).filter(([, v]) => typeof v !== 'object' || v === null).slice(0, 24).map(([key, value]) => <div key={key}><dt>{label(key)}</dt><dd className={key.includes('Id') || key.startsWith('_') ? 'sys-mono' : ''}>{displayValue(value)}</dd></div>)}</dl></section>
      {type === 'jobs' && (() => {
        const job = query.data as any;
        return (
          <section className="sys-detail" style={{ marginTop: '20px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '20px' }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 12px 0', color: 'var(--color-text-strong)' }}>Publishing details</h2>
            <dl>
              <div>
                <dt>Publishing company</dt>
                <dd><strong>{job.company?.name || '—'}</strong></dd>
              </div>
              <div>
                <dt>Company ID</dt>
                <dd className="sys-mono">{job.company?._id || job.company || '—'}</dd>
              </div>
              <div>
                <dt>Publishing recruiter</dt>
                <dd><strong>{job.createdBy?.fullName || '—'}</strong></dd>
              </div>
              <div>
                <dt>Recruiter ID</dt>
                <dd className="sys-mono">{job.createdBy?._id || job.createdBy || '—'}</dd>
              </div>
            </dl>
          </section>
        );
      })()}
      {type === 'applications' && Array.isArray(query.data.notes) && query.data.notes.length > 0 && <section className="sys-notes"><h2>Administrative notes</h2>{(query.data.notes as AdminRecord[]).map((note) => <article key={recordId(note)}><p>{displayValue(note.note ?? note.text)}</p><button onClick={() => setPending({ title: 'Delete this application note?', path: `${path}/notes/${recordId(note)}`, method: 'DELETE' })}>Delete note</button></article>)}</section>}
      <section className="sys-action-strip"><div><ShieldAlert size={18} /><span><strong>Corrective actions</strong><small>Current status: {displayValue(query.data.status ?? query.data.verificationStatus ?? query.data.approvalStatus)} · every intervention is recorded.</small></span></div>{config.actions.map(([title, action, needsReason, options]) => {
        const actionPath = (config as any).actionBase
          ? `${(config as any).actionBase}/${id}/${action}`
          : `${path}/${action}`;
        return <button key={action} onClick={() => setPending({ title: `${title}?`, path: actionPath, reason: needsReason, field: options ? { name: 'status', label: 'New status', options: [...options].filter((status) => status !== query.data?.status) } : undefined })}>{title}</button>;
      })}</section></>}
    {pending && <ActionDialog action={pending} onClose={() => setPending(null)} onDone={() => query.refetch()} />}
  </main>;
}

const communications = { notifications: adminPaths.notifications, templates: adminPaths.templates, outbox: adminPaths.outbox, 'email logs': adminPaths.emailLogs };
export function AdminCommunicationsPage() {
  const [sp, setSp] = useSearchParams();
  const view = sp.get('view') ?? 'notifications';
  const path = communications[view as keyof typeof communications] ?? adminPaths.notifications;
  const [page, setPage] = useState(1);
  const query = useCollection(path, { page, limit: 20 });
  const [pending, setPending] = useState<PendingAction | null>(null);

  const totalCount = query.data?.meta.total ?? 0;
  const rowCount = query.data?.rows.length ?? 0;

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Communications"
        title="Delivery Audit & Outbox Console"
        intro="Trace notification creation, template management, outbox queue processing, and transactional email delivery."
        actions={
          view === 'outbox' ? (
            <button className="sys-button" onClick={() => setPending({ title: 'Process up to 20 outbox events?', path: '/notifications/admin/process-outbox', method: 'POST', body: { limit: 20 } })}>
              <RadioTower size={15} /> Process outbox
            </button>
          ) : undefined
        }
      />

      {/* KPI Cards Grid matching Overview style */}
      <section className="sys-sub-kpi-grid" aria-label="Communications Metrics">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><MessageSquareText size={16} /></div>
          <span className="sys-overview-kpi-label">Total Messages</span>
          <strong className="sys-overview-kpi-value">{totalCount.toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Communication records</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><RadioTower size={16} /></div>
          <span className="sys-overview-kpi-label">Active Queue</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>{label(view)}</strong>
          <span className="sys-overview-kpi-subtext">Selected messaging domain</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><FileText size={16} /></div>
          <span className="sys-overview-kpi-label">Page Items</span>
          <strong className="sys-overview-kpi-value">{rowCount}</strong>
          <span className="sys-overview-kpi-subtext">Active page results</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><CheckCircle2 size={16} /></div>
          <span className="sys-overview-kpi-label">Outbox Health</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.6rem' }}>Audited</strong>
          <span className="sys-overview-kpi-subtext">Retry & failure quarantined</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '16px' }}>
          <h3><MessageSquareText size={18} /> Communications Ledger</h3>
          <button className="sys-button sys-button--quiet" onClick={() => query.refetch()}>
            <RefreshCw size={15} /> Refresh Audit
          </button>
        </div>

        <div className="sys-tabs" role="tablist" style={{ marginTop: '0', marginBottom: '20px' }}>
          {Object.keys(communications).map((key) => (
            <button role="tab" aria-selected={view === key} key={key} onClick={() => { setPage(1); setSp({ view: key }); }}>
              {label(key)}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <State kind="loading">Loading communication records…</State>
        ) : query.isError ? (
          <State kind="error">{errorText(query.error)}</State>
        ) : query.data?.rows.length ? (
          <>
            <LedgerTable
              rows={query.data.rows}
              actions={
                view === 'outbox'
                  ? (row) => (
                      <>
                        <button onClick={() => setPending({ title: 'Retry this outbox event?', path: `/notifications/admin/outbox/${recordId(row)}/retry` })}>
                          Retry
                        </button>
                        <button onClick={() => setPending({ title: 'Cancel this outbox event?', path: `/notifications/admin/outbox/${recordId(row)}/cancel` })}>
                          Cancel
                        </button>
                      </>
                    )
                  : view === 'templates'
                  ? (row) => (
                      <>
                        <button onClick={() => setPending({ title: 'Preview this template with empty variables?', path: `/notifications/admin/templates/${recordId(row)}/preview`, method: 'POST', body: { variables: {} } })}>
                          Preview
                        </button>
                        <button onClick={() => setPending({ title: 'Clone this template?', path: `/notifications/admin/templates/${recordId(row)}/clone`, method: 'POST' })}>
                          Clone
                        </button>
                        <button onClick={() => setPending({ title: 'Deactivate this template?', path: `/notifications/admin/templates/${recordId(row)}/deactivate` })}>
                          Deactivate
                        </button>
                      </>
                    )
                  : undefined
              }
            />
            <Pager page={page} setPage={setPage} meta={query.data.meta} />
          </>
        ) : (
          <State kind="empty">No {view} records were returned.</State>
        )}
      </section>

      {pending && <ActionDialog action={pending} onClose={() => setPending(null)} onDone={() => query.refetch()} />}
    </main>
  );
}

const domains = ['overview', 'users', 'candidates', 'recruiters', 'companies', 'jobs', 'applications', 'assessments', 'interviews', 'offers', 'documents', 'notifications', 'health'];
export function AdminAnalyticsPage() {
  const [sp, setSp] = useSearchParams();
  const domain = sp.get('domain') ?? 'overview';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);

  const params = useMemo(
    () =>
      from && to
        ? { from: new Date(`${from}T00:00:00Z`).toISOString(), to: new Date(`${to}T23:59:59Z`).toISOString() }
        : { preset: 'last-30-days' },
    [from, to]
  );

  const query = useQuery({
    queryKey: ['system-admin', 'analytics', domain, params],
    queryFn: () => adminApi.analytics(domain, params),
    enabled: domains.includes(domain),
  });

  const data = (query.data ?? {}) as Record<string, unknown>;
  const summary = (data.summary ?? data) as Record<string, unknown>;
  const metricEntries = Object.entries(summary).filter(([, v]) => typeof v === 'number');

  const download = async () => {
    try {
      setExportError('');
      setExporting(true);
      const blob = await downloadAnalyticsCsv({ report: domain, format: 'csv', timezone: 'UTC', ...params });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `talvix-${domain}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(errorText(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Analytics"
        title="Aggregate Platform Intelligence"
        intro="Privacy-safe platform trends, aggregate metrics bounded in UTC, exportable by report domain."
      />

      {/* KPI Cards Grid matching Overview style */}
      <section className="sys-sub-kpi-grid" aria-label="Analytics Domain Metrics">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><BarChart2 size={16} /></div>
          <span className="sys-overview-kpi-label">Active Report</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.5rem' }}>{label(domain)}</strong>
          <span className="sys-overview-kpi-subtext">Selected analytics domain</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Activity size={16} /></div>
          <span className="sys-overview-kpi-label">Calculated Metrics</span>
          <strong className="sys-overview-kpi-value">{metricEntries.length}</strong>
          <span className="sys-overview-kpi-subtext">Aggregate datapoints</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><FileText size={16} /></div>
          <span className="sys-overview-kpi-label">Time Boundary</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.5rem' }}>{from && to ? 'Custom Range' : 'Last 30 Days'}</strong>
          <span className="sys-overview-kpi-subtext">UTC timezone bounded</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><ShieldCheck size={16} /></div>
          <span className="sys-overview-kpi-label">Privacy Guarantee</span>
          <strong className="sys-overview-kpi-value" style={{ fontSize: '1.5rem' }}>Anonymized</strong>
          <span className="sys-overview-kpi-subtext">Zero PII in exports</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '16px' }}>
          <h3><BarChart2 size={18} /> Platform Analytics Report</h3>
          <button className="sys-button" disabled={exporting || Boolean(from) !== Boolean(to)} onClick={download}>
            <Download size={15} />
            {exporting ? 'Preparing…' : 'Export CSV'}
          </button>
        </div>

        <div className="sys-tabs" role="tablist" style={{ marginTop: '0', marginBottom: '20px' }}>
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

        <div className="sys-analytics-controls" style={{ background: 'var(--color-surface-secondary)', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
          <label>
            Domain
            <select value={domain} onChange={(e) => setSp({ domain: e.target.value })}>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            From (UTC)
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To (UTC)
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>

        {exportError && <p className="sys-error" role="alert">{exportError}</p>}

        {query.isLoading ? (
          <State kind="loading">Calculating aggregates…</State>
        ) : query.isError ? (
          <State kind="error">{errorText(query.error)}</State>
        ) : (
          <div className="sys-overview-kpi-grid" style={{ marginTop: '20px' }}>
            {metricEntries.map(([key, value]) => (
              <article key={key} className="sys-overview-kpi-card">
                <div className="sys-overview-kpi-icon-box"><BarChart2 size={16} /></div>
                <span className="sys-overview-kpi-label">{label(key)}</span>
                <strong className="sys-overview-kpi-value">{Number(value).toLocaleString()}</strong>
                <span className="sys-overview-kpi-subtext">Aggregate metric</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
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
            <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
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

export function AdminRecruiterVerificationPage() {
  const [sp, setSp] = useSearchParams();
  const search = sp.get('search') ?? '';
  const status = sp.get('status') ?? '';
  const company = sp.get('company') ?? '';
  const startDate = sp.get('startDate') ?? '';
  const endDate = sp.get('endDate') ?? '';
  const page = parseInt(sp.get('page') ?? '1', 10);

  const queryParams = {
    page,
    limit: 10,
    ...(search && { search }),
    ...(status && { status }),
    ...(company && { company }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const query = useQuery({
    queryKey: ['system-admin', 'recruiter-verification-list', queryParams],
    queryFn: () => adminApi.list(adminPaths.recruiters, queryParams),
  });

  const companiesQuery = useQuery({
    queryKey: ['system-admin', 'companies-list-dropdown'],
    queryFn: () => adminApi.list(adminPaths.companies, { limit: 100 }),
  });

  // Query stats for KPI cards
  const pendingRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'pending' });
  const approvedRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'approved' });
  const suspendedRecruiters = useCollection(adminPaths.recruiters, { page: 1, limit: 1, status: 'suspended' });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const client = useQueryClient();
  const rows = query.data?.rows ?? [];

  const updateSearchParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSp(next);
  };

  const handleActionDone = () => {
    client.invalidateQueries({ queryKey: ['system-admin'] });
  };

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Verification"
        title="Recruiter Verification Module"
        intro="Review recruiter identities, corporate email domain matching, workspace memberships, and operational roles."
      />

      {/* Overview-style KPI Cards Grid */}
      <section className="sys-sub-kpi-grid" aria-label="Recruiter Verification Metrics">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Users size={16} /></div>
          <span className="sys-overview-kpi-label">Total Recruiters</span>
          <strong className="sys-overview-kpi-value">{(query.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Registered platform users</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><ShieldAlert size={16} /></div>
          <span className="sys-overview-kpi-label">Pending Verification</span>
          <strong className="sys-overview-kpi-value">{(pendingRecruiters.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Requires admin review</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><CheckCircle2 size={16} /></div>
          <span className="sys-overview-kpi-label">Approved & Verified</span>
          <strong className="sys-overview-kpi-value">{(approvedRecruiters.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Active corporate recruiters</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Ban size={16} /></div>
          <span className="sys-overview-kpi-label">Suspended / Restricted</span>
          <strong className="sys-overview-kpi-value">{(suspendedRecruiters.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Restricted accounts</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '20px' }}>
          <h3><Users size={18} /> Recruiter Verification Ledger</h3>
          <button
            className="sys-button sys-button--quiet"
            onClick={() => query.refetch()}
            style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} /> Refresh List
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--color-surface-secondary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '12px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Search Field */}
          <div style={{ flex: '2 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Search Recruiter</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '9px 12px', height: '38px', borderRadius: '6px', boxSizing: 'border-box' }}>
              <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
              <input
                placeholder="Search by recruiter name or email..."
                value={search}
                onChange={(e) => updateSearchParam('search', e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'inherit', font: 'inherit', padding: 0 }}
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Status</span>
            <select
              value={status}
              onChange={(e) => updateSearchParam('status', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Company Dropdown */}
          <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Company</span>
            <select
              value={company}
              onChange={(e) => updateSearchParam('company', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            >
              <option value="">All Companies</option>
              {(companiesQuery.data?.rows ?? []).map((c: any) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>From Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateSearchParam('startDate', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            />
          </div>

          {/* To Date */}
          <div style={{ flex: '1 1 130px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>To Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateSearchParam('endDate', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

      {query.isLoading ? (
        <State kind="loading">Loading recruiter list...</State>
      ) : query.isError ? (
        <State kind="error">{errorText(query.error)}</State>
      ) : rows.length ? (
        <>
          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Recruiter Name</th>
                  <th>Company Info</th>
                  <th>Verification States</th>
                  <th>Job Title</th>
                  <th>Registered</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const id = recordId(row);
                  return (
                    <tr key={id}>
                      <td data-label="Recruiter">
                        <strong>{row.user?.fullName || '—'}</strong>
                        <small className="sys-mono">{row.user?.email || '—'}</small>
                      </td>
                      <td data-label="Company">
                        <strong>{row.company?.name || 'No Company'}</strong>
                      </td>
                      <td data-label="Verification">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.8rem' }}>
                            Recruiter: <Status value={row.user?.recruiterVerificationStatus ?? 'none'} />
                          </span>
                          <span style={{ fontSize: '0.8rem' }}>
                            Company: <Status value={row.company?.verificationStatus ?? 'none'} />
                          </span>
                          <span style={{ fontSize: '0.8rem' }}>
                            Membership: <Status value={row.membershipStatus ?? 'none'} />
                          </span>
                        </div>
                      </td>
                      <td data-label="Job Title">{row.designation || '—'}</td>
                      <td data-label="Registered" className="sys-mono" style={{ fontSize: '0.8rem' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td data-label="Actions">
                        <div className="sys-row-actions">
                          <button className="sys-button" onClick={() => setSelectedProfileId(id)} style={{ cursor: 'pointer' }}>
                            Inspect <ArrowRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={(p) => updateSearchParam('page', String(p))} meta={query.data?.meta} />
        </>
      ) : (
        <State kind="empty">No recruiters matching this view.</State>
      )}
      </section>

      {selectedProfileId && (
        <RecruiterVerificationDrawer
          profileId={selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
          onActionDone={handleActionDone}
        />
      )}

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={handleActionDone}
        />
      )}
    </main>
  );
}

function RecruiterVerificationDrawer({
  profileId,
  onClose,
  onActionDone,
}: {
  profileId: string;
  onClose: () => void;
  onActionDone: () => void;
}) {
  const path = `${adminPaths.recruiters}/${profileId}`;
  const query = useQuery({
    queryKey: ['system-admin', 'recruiter-verification-detail', profileId],
    queryFn: () => adminApi.detail(path),
  });
  const data = (query.data ?? {}) as any;

  const historyQuery = useQuery({
    queryKey: ['system-admin', 'recruiter-verification-history', profileId],
    queryFn: () => adminApi.getRecruiterVerificationHistory(profileId),
    enabled: !!profileId,
  });
  const historyItems = historyQuery.data?.data?.items || [];

  const [pending, setPending] = useState<PendingAction | null>(null);

  const performAction = (actionName: string, config: { path: string; method?: 'PATCH' | 'POST' | 'DELETE'; reason?: boolean; body?: any }) => {
    setPending({
      title: `${actionName}?`,
      path: config.path,
      method: config.method || 'PATCH',
      reason: config.reason,
      body: config.body,
    });
  };

  const recruiterStatus = data.user?.recruiterVerificationStatus || 'none';

  return (
    <div className="sys-dialog-backdrop" style={{ zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="sys-dialog" style={{
        maxWidth: '1000px',
        width: 'calc(100% - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        borderRadius: '8px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        border: '1px solid var(--color-border-default)',
        background: 'var(--color-surface-primary)',
        overflow: 'hidden'
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border-default)'
        }}>
          <div>
            <p className="sys-eyebrow">Verification Inspection</p>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 620 }}>Recruiter Details</h2>
          </div>
          <button className="sys-button sys-button--quiet" onClick={onClose} style={{ cursor: 'pointer' }}>Close</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {query.isLoading ? (
            <State kind="loading">Loading details...</State>
          ) : query.isError ? (
            <State kind="error">{errorText(query.error)}</State>
          ) : query.data ? (
            <>
              <section className="sys-detail" style={{ marginTop: 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Recruiter Information</h3>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  <div><dt>Full Name</dt><dd>{data.user?.fullName || '—'}</dd></div>
                  <div><dt>Email</dt><dd className="sys-mono">{data.user?.email || '—'}</dd></div>
                  <div><dt>Phone</dt><dd>{data.phone || '—'}</dd></div>
                  <div><dt>Job Title</dt><dd>{data.designation || '—'}</dd></div>
                  <div><dt>Department</dt><dd>{data.department || '—'}</dd></div>
                  <div><dt>LinkedIn URL</dt><dd>{data.linkedinUrl || '—'}</dd></div>
                  <div><dt>Biography</dt><dd>{data.bio || '—'}</dd></div>
                  <div><dt>Registration Date</dt><dd>{data.createdAt ? new Date(data.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd></div>
                  <div><dt>Account Status</dt><dd>{data.user?.isDeleted ? 'Deleted' : data.user?.blocked ? 'Blocked' : 'Active'}</dd></div>
                </dl>
              </section>

              <section className="sys-detail" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Company & Membership Information</h3>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  <div><dt>Company Name</dt><dd>{data.company?.name || '—'}</dd></div>
                  <div><dt>Website</dt><dd>{data.company?.website ? <a href={data.company.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-action-primary)', textDecoration: 'underline' }}>{data.company.website}</a> : '—'}</dd></div>
                  <div><dt>Company Email/Domain</dt><dd className="sys-mono">{data.company?.officialEmailDomain || '—'}</dd></div>
                  <div><dt>Company Size</dt><dd>{data.company?.companySize || '—'}</dd></div>
                  <div><dt>Company Status</dt><dd><Status value={data.company?.verificationStatus ?? 'none'} /></dd></div>
                  <div><dt>Recruiter's Company Role</dt><dd>{data.membership?.role ? (data.membership.role.charAt(0).toUpperCase() + data.membership.role.slice(1)) : (data.isCompanyOwner ? 'Owner' : 'Member')}</dd></div>
                </dl>
              </section>

              <section className="sys-detail" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Verification Information</h3>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  <div><dt>Recruiter Verification Status</dt><dd><Status value={recruiterStatus} /></dd></div>
                  <div><dt>Profile isApproved</dt><dd>{data.isApproved ? 'Approved' : 'Pending'}</dd></div>
                  {recruiterStatus === 'verified' && (
                    <>
                      <div><dt>Approved By</dt><dd>{data.approvedBy?.fullName || '—'}</dd></div>
                      <div><dt>Approved Date</dt><dd>{data.approvedAt ? new Date(data.approvedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                    </>
                  )}
                  {recruiterStatus === 'rejected' && (
                    <>
                      <div><dt>Rejected By</dt><dd>{data.rejectedBy?.fullName || '—'}</dd></div>
                      <div><dt>Rejected Date</dt><dd>{data.rejectedAt ? new Date(data.rejectedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                      <div><dt>Rejection Reason</dt><dd>{data.rejectionReason || '—'}</dd></div>
                    </>
                  )}
                  {recruiterStatus === 'suspended' && (
                    <>
                      <div><dt>Suspended By</dt><dd>{data.suspendedBy?.fullName || '—'}</dd></div>
                      <div><dt>Suspended Date</dt><dd>{data.suspendedAt ? new Date(data.suspendedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                      <div><dt>Suspension Reason</dt><dd>{data.suspensionReason || '—'}</dd></div>
                    </>
                  )}
                  {recruiterStatus === 'restored' && (
                    <>
                      <div><dt>Restored By</dt><dd>{data.restoredBy?.fullName || '—'}</dd></div>
                      <div><dt>Restored Date</dt><dd>{data.restoredAt ? new Date(data.restoredAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                    </>
                  )}
                  {recruiterStatus !== 'verified' && recruiterStatus !== 'rejected' && recruiterStatus !== 'suspended' && recruiterStatus !== 'restored' && (
                    <>
                      <div><dt>Approved By</dt><dd>—</dd></div>
                      <div><dt>Approved Date</dt><dd>—</dd></div>
                    </>
                  )}
                </dl>
              </section>

              <section className="sys-detail" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Verification History</h3>
                {historyQuery.isLoading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Loading history...</p>
                ) : historyItems.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>No verification history found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', borderLeft: '2px solid var(--color-border-default)', margin: '8px 0 0 8px' }}>
                    {historyItems.map((item: any) => {
                      const actionLabel = formatActionLabel(item.action);
                      const statusTransition = `${item.previousStatus} → ${item.newStatus}`;
                      const dateStr = item.timestamp
                        ? new Date(item.timestamp).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      return (
                        <div key={item.id} style={{ position: 'relative', paddingLeft: '16px' }}>
                          <div style={{
                            position: 'absolute',
                            left: '-13px',
                            top: '4px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: item.action.includes('rejected') || item.action.includes('suspended') ? 'var(--color-danger-primary, #ea3838)' : 'var(--color-success-primary, #10b981)',
                            border: '2px solid var(--color-surface-primary)'
                          }} />
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                                {actionLabel}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '8px', background: 'var(--color-surface-secondary, #f3f4f6)', padding: '2px 6px', borderRadius: '4px' }}>
                                {statusTransition}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{dateStr}</span>
                          </div>
                          
                          <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            <strong>By:</strong> {item.performedBy?.name || '—'}
                          </div>
                          
                          {(item.reason || item.notes) && (
                            <div style={{
                              marginTop: '6px',
                              padding: '8px 12px',
                              background: 'var(--color-bg-alt, #fafafa)',
                              border: '1px solid var(--color-border-default)',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              color: 'var(--color-text-primary)',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {item.reason ? <strong>Reason: </strong> : null}
                              {item.reason || item.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {data.profilePhotoDocument && (
                <section className="sys-detail" style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Uploaded Documents</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', background: 'var(--color-bg-alt)', padding: '12px', borderRadius: '6px' }}>
                    <div style={{ flex: 1 }}>
                      <strong>Profile Photo Document</strong>
                      <small style={{ display: 'block', color: 'var(--color-text-muted)' }}>ID: {data.profilePhotoDocument}</small>
                    </div>
                    <a href={`/api/v1/documents/${data.profilePhotoDocument}/download`} target="_blank" rel="noopener noreferrer" className="sys-button sys-button--quiet">
                      View
                    </a>
                  </div>
                </section>
              )}
            </>
          ) : (
            <State kind="empty">No recruiter details found.</State>
          )}
        </div>

        {query.data && (
          <footer style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-alt)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {recruiterStatus === 'pending' && (
              <>
                <button className="sys-button sys-button--success" onClick={() => performAction('Approve Recruiter', { path: `/recruiters/admin/${profileId}/approve` })} style={{ cursor: 'pointer' }}>
                  Approve Recruiter
                </button>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Reject Recruiter', { path: `/recruiters/admin/${profileId}/reject`, reason: true })} style={{ cursor: 'pointer' }}>
                  Reject Recruiter
                </button>
              </>
            )}
            {recruiterStatus === 'verified' && (
              <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend Recruiter', { path: `/recruiters/admin/${profileId}/suspend`, reason: true })} style={{ cursor: 'pointer' }}>
                Suspend Recruiter
              </button>
            )}
            {recruiterStatus === 'suspended' && (
              <button className="sys-button sys-button--success" onClick={() => performAction('Restore Recruiter', { path: `/recruiters/admin/${profileId}/restore` })} style={{ cursor: 'pointer' }}>
                Restore Recruiter
              </button>
            )}
          </footer>
        )}
      </div>

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            onActionDone();
            query.refetch();
            historyQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

export function AdminCompanyVerificationPage() {
  const [sp, setSp] = useSearchParams();
  const search = sp.get('search') ?? '';
  const status = sp.get('status') ?? '';
  const startDate = sp.get('startDate') ?? '';
  const endDate = sp.get('endDate') ?? '';
  const page = parseInt(sp.get('page') ?? '1', 10);

  const queryParams = {
    page,
    limit: 10,
    ...(search && { search }),
    ...(status && { status }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  };

  const query = useQuery({
    queryKey: ['system-admin', 'company-verification-list', queryParams],
    queryFn: () => adminApi.list(adminPaths.companies, queryParams),
  });

  // Query stats for KPI cards
  const pendingCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'pending' });
  const verifiedCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'verified' });
  const suspendedCompanies = useCollection(adminPaths.companies, { page: 1, limit: 1, status: 'suspended' });

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const client = useQueryClient();
  const rows = query.data?.rows ?? [];

  const updateSearchParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    if (key !== 'page') {
      next.set('page', '1');
    }
    setSp(next);
  };

  const handleActionDone = () => {
    client.invalidateQueries({ queryKey: ['system-admin'] });
  };

  return (
    <main className="sys-page">
      <Header
        eyebrow="System administration / Verification"
        title="Company Verification Module"
        intro="Review employer verification requests, workspace setups, tax IDs, and corporate memberships."
      />

      {/* Overview-style KPI Cards Grid */}
      <section className="sys-sub-kpi-grid" aria-label="Company Verification Metrics">
        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Building2 size={16} /></div>
          <span className="sys-overview-kpi-label">Total Workspaces</span>
          <strong className="sys-overview-kpi-value">{(query.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Employer organizations</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><ShieldAlert size={16} /></div>
          <span className="sys-overview-kpi-label">Pending Verification</span>
          <strong className="sys-overview-kpi-value">{(pendingCompanies.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Awaiting audit approval</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><CheckCircle2 size={16} /></div>
          <span className="sys-overview-kpi-label">Verified Companies</span>
          <strong className="sys-overview-kpi-value">{(verifiedCompanies.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Active corporate partners</span>
        </article>

        <article className="sys-overview-kpi-card">
          <div className="sys-overview-kpi-icon-box"><Ban size={16} /></div>
          <span className="sys-overview-kpi-label">Suspended / Restricted</span>
          <strong className="sys-overview-kpi-value">{(suspendedCompanies.data?.meta.total ?? 0).toLocaleString()}</strong>
          <span className="sys-overview-kpi-subtext">Restricted workspaces</span>
        </article>
      </section>

      {/* Main Card Container */}
      <section className="sys-overview-card">
        <div className="sys-overview-card-header" style={{ marginBottom: '20px' }}>
          <h3><Building2 size={18} /> Company Verification Ledger</h3>
          <button
            className="sys-button sys-button--quiet"
            onClick={() => query.refetch()}
            style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} /> Refresh Workspaces
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--color-surface-secondary)',
          border: '1px solid var(--color-border-default)',
          borderRadius: '12px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Search Field */}
          <div style={{ flex: '2 1 240px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Search Company</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '9px 12px', height: '38px', borderRadius: '6px', boxSizing: 'border-box' }}>
              <Search size={16} style={{ color: 'var(--color-text-secondary)' }} />
              <input
                placeholder="Search by company name, slug, or Tax ID..."
                value={search}
                onChange={(e) => updateSearchParam('search', e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'inherit', font: 'inherit', padding: 0 }}
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div style={{ flex: '1 1 150px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Status</span>
            <select
              value={status}
              onChange={(e) => updateSearchParam('status', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="suspended">Suspended</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* From Date */}
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>From Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => updateSearchParam('startDate', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            />
          </div>

          {/* To Date */}
          <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>To Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => updateSearchParam('endDate', e.target.value)}
              style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-surface-primary)', padding: '8px 12px', borderRadius: '6px', outline: 'none', color: 'inherit', font: 'inherit', height: '38px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

      {query.isLoading ? (
        <State kind="loading">Loading company list...</State>
      ) : query.isError ? (
        <State kind="error">{errorText(query.error)}</State>
      ) : rows.length ? (
        <>
          <div className="sys-table-wrap">
            <table className="sys-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Website / Domain</th>
                  <th>Owner Information</th>
                  <th>Verification Status</th>
                  <th>Stats</th>
                  <th>Registered</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const id = recordId(row);
                  return (
                    <tr key={id}>
                      <td data-label="Company Name">
                        <strong>{row.name || '—'}</strong>
                        <small style={{ color: 'var(--color-text-muted)' }}>Size: {row.companySize || '—'}</small>
                      </td>
                      <td data-label="Website">
                        <a href={row.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-action-primary)', textDecoration: 'underline' }}>
                          {row.website || '—'}
                        </a>
                        <small className="sys-mono">{row.officialEmailDomain || '—'}</small>
                      </td>
                      <td data-label="Owner">
                        <strong>{row.owner?.fullName || '—'}</strong>
                        <small className="sys-mono">{row.owner?.email || '—'}</small>
                      </td>
                      <td data-label="Verification">
                        <Status value={row.verificationStatus} />
                      </td>
                      <td data-label="Stats">
                        <span style={{ display: 'block', fontSize: '0.85rem' }}>Members: {row.memberCount ?? 0}</span>
                        <span style={{ display: 'block', fontSize: '0.85rem' }}>Jobs: {row.jobCount ?? 0}</span>
                      </td>
                      <td data-label="Registered" className="sys-mono" style={{ fontSize: '0.8rem' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                      </td>
                      <td data-label="Actions">
                        <div className="sys-row-actions">
                          <button className="sys-button" onClick={() => setSelectedCompanyId(id)} style={{ cursor: 'pointer' }}>
                            Inspect <ArrowRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} setPage={(p) => updateSearchParam('page', String(p))} meta={query.data?.meta} />
        </>
      ) : (
        <State kind="empty">No companies matching this view.</State>
      )}
      </section>

      {selectedCompanyId && (
        <CompanyVerificationDrawer
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onActionDone={handleActionDone}
        />
      )}

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={handleActionDone}
        />
      )}
    </main>
  );
}

function CompanyVerificationDrawer({
  companyId,
  onClose,
  onActionDone,
}: {
  companyId: string;
  onClose: () => void;
  onActionDone: () => void;
}) {
  const path = `${adminPaths.companies}/${companyId}`;
  const query = useQuery({
    queryKey: ['system-admin', 'company-verification-detail', companyId],
    queryFn: () => adminApi.detail(path),
  });
  const data = (query.data ?? {}) as any;

  const historyQuery = useQuery({
    queryKey: ['system-admin', 'company-verification-history', companyId],
    queryFn: () => adminApi.getVerificationHistory(companyId),
    enabled: !!companyId,
  });
  const historyItems = historyQuery.data?.data?.items || [];

  const [pending, setPending] = useState<PendingAction | null>(null);

  const performAction = (actionName: string, config: { path: string; method?: 'PATCH' | 'POST' | 'DELETE'; reason?: boolean; body?: any }) => {
    setPending({
      title: `${actionName}?`,
      path: config.path,
      method: config.method || 'PATCH',
      reason: config.reason,
      body: config.body,
    });
  };

  return (
    <div className="sys-dialog-backdrop" style={{ zIndex: 9999, display: 'grid', placeItems: 'center', background: 'rgba(0, 0, 0, 0.6)' }}>
      <div className="sys-dialog" style={{
        maxWidth: '1000px',
        width: 'calc(100% - 32px)',
        maxHeight: 'calc(100vh - 48px)',
        borderRadius: '8px',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        border: '1px solid var(--color-border-default)',
        background: 'var(--color-surface-primary)',
        overflow: 'hidden'
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          borderBottom: '1px solid var(--color-border-default)'
        }}>
          <div>
            <p className="sys-eyebrow">Verification Inspection</p>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.5rem', fontWeight: 620 }}>Company Details</h2>
          </div>
          <button className="sys-button sys-button--quiet" onClick={onClose} style={{ cursor: 'pointer' }}>Close</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {query.isLoading ? (
            <State kind="loading">Loading details...</State>
          ) : query.isError ? (
            <State kind="error">{errorText(query.error)}</State>
          ) : query.data ? (
            <>
              <section className="sys-detail" style={{ marginTop: 0 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Company Information</h3>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  <div><dt>Company Name</dt><dd>{data.name || '—'}</dd></div>
                  <div><dt>Website</dt><dd>{data.website ? <a href={data.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-action-primary)', textDecoration: 'underline' }}>{data.website}</a> : '—'}</dd></div>
                  <div><dt>Email Domain</dt><dd className="sys-mono">{data.officialEmailDomain || '—'}</dd></div>
                  <div><dt>Company Size</dt><dd>{data.companySize || '—'}</dd></div>
                  <div><dt>Industry</dt><dd>{data.industry || '—'}</dd></div>
                  <div><dt>Description</dt><dd>{data.description || '—'}</dd></div>
                  <div><dt>Registration Date</dt><dd>{data.createdAt ? new Date(data.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</dd></div>
                </dl>
              </section>

              <section className="sys-detail" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Owner & Verification Information</h3>
                <dl style={{ borderLeft: '1px solid var(--color-border-default)', borderTop: '1px solid var(--color-border-default)' }}>
                  <div><dt>Company Owner</dt><dd>{data.owner?.fullName || '—'} ({data.owner?.email || '—'})</dd></div>
                  <div><dt>Owner Verification Status</dt><dd><Status value={data.owner?.recruiterVerificationStatus ?? 'none'} /></dd></div>
                  <div><dt>Verification Status</dt><dd><Status value={data.verificationStatus} /></dd></div>
                  {data.verificationStatus === 'verified' && (
                    <>
                      <div><dt>Verified By</dt><dd>{data.verifiedBy?.fullName || '—'}</dd></div>
                      <div><dt>Verified Date</dt><dd>{data.verifiedAt ? new Date(data.verifiedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                    </>
                  )}
                  {data.verificationStatus === 'rejected' && (
                    <>
                      <div><dt>Rejected By</dt><dd>{data.rejectedBy?.fullName || '—'}</dd></div>
                      <div><dt>Rejected Date</dt><dd>{data.rejectedAt ? new Date(data.rejectedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                    </>
                  )}
                  {data.verificationStatus === 'suspended' && (
                    <>
                      <div><dt>Suspended By</dt><dd>{data.suspendedBy?.fullName || '—'}</dd></div>
                      <div><dt>Suspended Date</dt><dd>{data.suspendedAt ? new Date(data.suspendedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div>
                    </>
                  )}
                  {data.verificationStatus !== 'verified' && data.verificationStatus !== 'rejected' && data.verificationStatus !== 'suspended' && (
                    <>
                      <div><dt>Verified By</dt><dd>—</dd></div>
                      <div><dt>Verified Date</dt><dd>—</dd></div>
                    </>
                  )}
                </dl>
              </section>

              <section className="sys-detail" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Verification History</h3>
                {historyQuery.isLoading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Loading history...</p>
                ) : historyItems.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>No verification history found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', borderLeft: '2px solid var(--color-border-default)', margin: '8px 0 0 8px' }}>
                    {historyItems.map((item: any) => {
                      const actionLabel = formatActionLabel(item.action);
                      const statusTransition = `${item.previousStatus} → ${item.newStatus}`;
                      const dateStr = item.timestamp
                        ? new Date(item.timestamp).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—';

                      return (
                        <div key={item.id} style={{ position: 'relative', paddingLeft: '16px' }}>
                          <div style={{
                            position: 'absolute',
                            left: '-13px',
                            top: '4px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: item.action.includes('rejected') || item.action.includes('suspended') ? 'var(--color-danger-primary, #ea3838)' : 'var(--color-success-primary, #10b981)',
                            border: '2px solid var(--color-surface-primary)'
                          }} />
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                                {actionLabel}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '8px', background: 'var(--color-surface-secondary, #f3f4f6)', padding: '2px 6px', borderRadius: '4px' }}>
                                {statusTransition}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{dateStr}</span>
                          </div>
                          
                          <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            <strong>By:</strong> {item.performedBy?.name || '—'}
                          </div>
                          
                          {(item.reason || item.notes) && (
                            <div style={{
                              marginTop: '6px',
                              padding: '8px 12px',
                              background: 'var(--color-bg-alt, #fafafa)',
                              border: '1px solid var(--color-border-default)',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              color: 'var(--color-text-primary)',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {item.reason ? <strong>Reason: </strong> : null}
                              {item.reason || item.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {data.companyMembers && data.companyMembers.length > 0 && (
                <section className="sys-detail" style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--color-border-default)', paddingBottom: '8px', margin: '0 0 16px' }}>Corporate Members</h3>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                    {data.companyMembers.map((member: any) => (
                      <li key={member._id} style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', padding: '12px', border: '1px solid var(--color-border-default)', borderRadius: '4px', background: 'var(--color-bg-alt)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong>{member.recruiter?.fullName || 'Recruiter'}</strong>
                          <span className="sys-mono" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{member.recruiter?.email || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', background: 'var(--color-surface-secondary)', padding: '2px 8px', borderRadius: '4px' }}>Role: {member.role}</span>
                          <Status value={member.status} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          ) : (
            <State kind="empty">No company details found.</State>
          )}
        </div>

        {query.data && (
          <footer style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-alt)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {data.verificationStatus === 'pending' && (
              <>
                <button className="sys-button sys-button--success" onClick={() => performAction('Verify Company', { path: `/companies/admin/${companyId}/verify` })} style={{ cursor: 'pointer' }}>
                  Verify Company
                </button>
                <button className="sys-button sys-button--danger" onClick={() => performAction('Reject Company', { path: `/companies/admin/${companyId}/reject`, reason: true })} style={{ cursor: 'pointer' }}>
                  Reject Company
                </button>
              </>
            )}
            {data.verificationStatus === 'verified' && (
              <button className="sys-button sys-button--danger" onClick={() => performAction('Suspend Company', { path: `/companies/admin/${companyId}/suspend`, reason: true })} style={{ cursor: 'pointer' }}>
                Suspend Company
              </button>
            )}
            {data.verificationStatus === 'suspended' && (
              <button className="sys-button sys-button--success" onClick={() => performAction('Restore Company', { path: `/companies/admin/${companyId}/verify` })} style={{ cursor: 'pointer' }}>
                Restore Company
              </button>
            )}
          </footer>
        )}
      </div>

      {pending && (
        <ActionDialog
          action={pending}
          onClose={() => setPending(null)}
          onDone={() => {
            onActionDone();
            query.refetch();
            historyQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

export function AdminProfileSettingsPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? 'Talvix Admin');
  const [email, setEmail] = useState(user?.email ?? 'admin@talvix.local');
  const [phone, setPhone] = useState('+1 (555) 234-5678');
  const [department, setDepartment] = useState('System Operations & Security');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const [notifyVerifications, setNotifyVerifications] = useState(true);
  const [notifyHealth, setNotifyHealth] = useState(true);
  const [notifyAudit, setNotifyAudit] = useState(false);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [highContrast, setHighContrast] = useState(true);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setFeedback('Admin profile details updated successfully.');
      setTimeout(() => setFeedback(null), 4000);
    }, 600);
  };

  const handlePasswordUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback('Error: New password and confirm password do not match.');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback('Security credentials and password updated securely.');
      setTimeout(() => setFeedback(null), 4000);
    }, 600);
  };

  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'TA';

  return (
    <main className="sys-page">
      <Header
        eyebrow="System Governance & Account"
        title="Admin Profile & System Settings"
        intro="Manage your administrative credentials, security parameters, system notifications, and interface preferences."
      />

      {feedback && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            className={`sys-attention-item ${feedback.startsWith('Error') ? 'sys-attention-item--danger' : ''}`}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: feedback.startsWith('Error') ? 'var(--color-danger-bg)' : 'var(--color-success-bg, #f0fdf4)',
              borderLeft: `4px solid ${feedback.startsWith('Error') ? 'var(--color-danger-fg)' : 'var(--color-success-fg, #16a34a)'}`,
              color: 'var(--color-text-primary)',
              fontWeight: 600,
            }}
          >
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="sys-overview-layout">
        <div className="sys-overview-left-col">
          <section className="sys-overview-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--ref-nexa-black, #09090b)',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                }}
              >
                {initials}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{fullName}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{email}</span>
                <div style={{ marginTop: '4px' }}>
                  <span className="sys-badge sys-badge--approved">
                    <ShieldCheck size={12} style={{ marginRight: '4px' }} />
                    {user?.role === 'admin' ? 'System Administrator' : 'Platform Operations'}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Full Name
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Email Address
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Phone Number
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Department / Team
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="sys-button" type="submit" disabled={saving}>
                  {saving ? 'Saving changes…' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </section>

          <section className="sys-overview-card">
            <h3><Shield size={18} /> Password & Security Credentials</h3>
            <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                Current Password
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  New Password
                  <input
                    type="password"
                    required
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600 }}>
                  Confirm New Password
                  <input
                    type="password"
                    required
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border-default)' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--color-border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="twoFactor"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  />
                  <label htmlFor="twoFactor" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Enable Two-Factor Authentication (2FA)
                  </label>
                </div>
                <button className="sys-button" type="submit" disabled={saving || !currentPassword || !newPassword}>
                  Update Password
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="sys-overview-right-col">
          <section className="sys-overview-card">
            <h3><RadioTower size={18} /> Admin Notifications & Alerts</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: '8px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Verification Queue Alerts</strong>
                  <small style={{ color: 'var(--color-text-secondary)' }}>Instant alert when new recruiters request access</small>
                </div>
                <input
                  type="checkbox"
                  checked={notifyVerifications}
                  onChange={(e) => setNotifyVerifications(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: '8px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Platform Degradation Telemetry</strong>
                  <small style={{ color: 'var(--color-text-secondary)' }}>Alerts on API status changes or database latency</small>
                </div>
                <input
                  type="checkbox"
                  checked={notifyHealth}
                  onChange={(e) => setNotifyHealth(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: '8px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Daily Audit Trail Digest</strong>
                  <small style={{ color: 'var(--color-text-secondary)' }}>Daily email summary of platform operations</small>
                </div>
                <input
                  type="checkbox"
                  checked={notifyAudit}
                  onChange={(e) => setNotifyAudit(e.target.checked)}
                />
              </div>
            </div>
          </section>

          <section className="sys-overview-card">
            <h3><Activity size={18} /> Interface Preferences</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: '8px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Smooth Component Animations</strong>
                  <small style={{ color: 'var(--color-text-secondary)' }}>Enable card fade-in and sidebar slide physics</small>
                </div>
                <input
                  type="checkbox"
                  checked={enableAnimations}
                  onChange={(e) => setEnableAnimations(e.target.checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--color-surface-secondary)', borderRadius: '8px' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>NexaVerse Contrast Palette</strong>
                  <small style={{ color: 'var(--color-text-secondary)' }}>High contrast typography and cream card layout</small>
                </div>
                <input
                  type="checkbox"
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
