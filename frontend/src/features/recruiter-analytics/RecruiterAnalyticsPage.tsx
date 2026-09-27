import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  History,
  Sparkles,
  TrendingUp,
  Users,
  Save,
  Download,
  Trash2,
  CheckCircle2,
  Building2,
  Filter,
  Layers,
  ArrowRight,
  Eye,
  UserCheck,
  Check,
  X,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from '../../design-system';
import { apiRequest } from '../../api/client';
import { useRecruiterAnalyticsQuery } from './api';
import './recruiter-analytics.css';

export function RecruiterAnalyticsPage() {
  const navigate = useNavigate();
  const q = useRecruiterAnalyticsQuery();

  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>('');
  const [newViewName, setNewViewName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedRange, setSelectedRange] = useState('30');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch saved views
  useEffect(() => {
    apiRequest<{ views: any[] }>('/analytics/saved-views')
      .then((res) => {
        if (res?.views) {
          setSavedViews(res.views);
          const def = res.views.find((v) => v.isDefault);
          if (def) {
            setSelectedViewId(def._id);
            setSelectedDept(def.filters?.department || '');
            setSelectedRange(def.filters?.range || '30');
          }
        }
      })
      .catch((err) => console.error('Failed to load saved views:', err));
  }, []);

  const handleSelectView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (!viewId) {
      setSelectedDept('');
      setSelectedRange('30');
      return;
    }
    const view = savedViews.find((v) => v._id === viewId);
    if (view) {
      setSelectedDept(view.filters?.department || '');
      setSelectedRange(view.filters?.range || '30');
    }
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const body = {
      name: newViewName.trim(),
      filters: { department: selectedDept, range: selectedRange },
      isDefault: savedViews.length === 0,
    };
    apiRequest<any>('/analytics/saved-views', { method: 'POST', body })
      .then((res) => {
        if (res?.view) {
          setSavedViews([res.view, ...savedViews]);
          setSelectedViewId(res.view._id);
          setNewViewName('');
          setShowSaveDialog(false);
          setToastMessage({ type: 'success', text: `Saved view "${res.view.name}" successfully.` });
        }
      })
      .catch((err) => setToastMessage({ type: 'error', text: err.message || 'Failed to save view.' }));
  };

  const handleDeleteView = (viewId: string) => {
    apiRequest(`/analytics/saved-views/${viewId}`, { method: 'DELETE' })
      .then(() => {
        const view = savedViews.find((v) => v._id === viewId);
        setSavedViews(savedViews.filter((v) => v._id !== viewId));
        if (selectedViewId === viewId) setSelectedViewId('');
        setToastMessage({ type: 'success', text: `Deleted view "${view?.name || 'Preset'}".` });
      })
      .catch((err) => console.error(err));
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    apiRequest('/analytics/recruiter/export', {
      method: 'POST',
      body: {
        reportType: selectedViewId
          ? savedViews.find((v) => v._id === selectedViewId)?.name
          : 'General Recruitment',
        format,
      },
    })
      .then(() => {
        setToastMessage({
          type: 'success',
          text: `Export queued successfully! You will be notified when your ${format.toUpperCase()} report is ready.`,
        });
      })
      .catch((err) => setToastMessage({ type: 'error', text: err.message || 'Failed to trigger export.' }));
  };

  if (q.isLoading) return <LoadingState label="Loading recruiter analytics" />;
  if (q.isError) {
    return (
      <ErrorState
        detail="Recruiter analytics metrics are unavailable."
        retry={() => void q.refetch()}
      />
    );
  }

  const analyticsData = q.data?.data || q.data || {};
  const { hiringFunnel, performanceMetrics, jobPerformance, assessmentAnalytics } = analyticsData;

  return (
    <main className="ats-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      <PageHeader
        title="Recruitment Analytics"
        description="Aggregate pipeline funnel performance, team productivity, and candidate matching metrics."
        secondaryActions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Select
              aria-label="Saved Views"
              value={selectedViewId}
              options={[
                { value: '', label: 'Default Filters' },
                ...savedViews.map((v) => ({ value: v._id, label: v.name + (v.isDefault ? ' (Default)' : '') })),
              ]}
              onChange={(e) => handleSelectView(e.target.value)}
            />
            {selectedViewId && (
              <Button
                variant="secondary"
                size="compact"
                onClick={() => handleDeleteView(selectedViewId)}
                style={{ height: '36px', color: '#ef4444', borderColor: '#fee2e2' }}
              >
                <Trash2 size={14} style={{ marginRight: '4px' }} /> Delete View
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(true)}
              style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
            >
              <Save size={14} style={{ marginRight: '4px' }} /> Save View
            </Button>
          </div>
        }
        primaryAction={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="secondary"
              onClick={() => handleExport('csv')}
              style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
            >
              <Download size={14} style={{ marginRight: '4px' }} /> Export CSV
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
            >
              <Download size={14} style={{ marginRight: '4px' }} /> Export PDF
            </Button>
          </div>
        }
      />

      {toastMessage && (
        <Alert tone={toastMessage.type === 'success' ? 'success' : 'danger'}>
          {toastMessage.text}
        </Alert>
      )}

      {showSaveDialog && (
        <Card heading="Save Current Filter Preset" headingLevel={2}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="e.g. Engineering Hiring, Last 30 Days"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              style={{
                flex: 1,
                height: '38px',
                padding: '0 12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
              }}
            />
            <Button onClick={handleSaveView}>Save View</Button>
            <Button variant="quiet" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Date and Department Filtering Toolbar */}
      <div className="ats-board-controls" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
            <CalendarDays size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>Date Range:</span>
            <Select
              aria-label="Date range filter"
              value={selectedRange}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
              onChange={(e) => setSelectedRange(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px' }}>
            <Building2 size={16} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>Department:</span>
            <Select
              aria-label="Department filter"
              value={selectedDept}
              options={[
                { value: '', label: 'All Departments' },
                { value: 'engineering', label: 'Engineering' },
                { value: 'sales', label: 'Sales & Marketing' },
                { value: 'hr', label: 'Human Resources' },
                { value: 'product', label: 'Product & Design' },
              ]}
              onChange={(e) => setSelectedDept(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 5-Card Metrics Summary Grid */}
      <div className="ats-metrics-grid">
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box"><History size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--info">Speed</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Time to Hire</span>
            <span className="ats-metric-card__val">
              {performanceMetrics?.averageTimeToHire ?? 0} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Days</span>
            </span>
            <span className="ats-metric-card__sub">Application to offer accept</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#6366f1' }}><Users size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">Volume</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Apps per Job</span>
            <span className="ats-metric-card__val">
              {performanceMetrics?.averageApplicationsPerJob ?? 0}
            </span>
            <span className="ats-metric-card__sub">Avg candidates per role</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#10b981' }}><Sparkles size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--success">Conversion</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Offer Accept Rate</span>
            <span className="ats-metric-card__val">
              {performanceMetrics?.offerAcceptanceRate ?? 0}%
            </span>
            <span className="ats-metric-card__sub">Candidates accepting offers</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#f59e0b' }}><CalendarDays size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--warning">Activity</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Interviews Booked</span>
            <span className="ats-metric-card__val">
              {performanceMetrics?.recruiterProductivity ?? 0}
            </span>
            <span className="ats-metric-card__sub">Completed recruiter rounds</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#0284c7' }}><TrendingUp size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--info">Quality</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Interview Pass Rate</span>
            <span className="ats-metric-card__val">
              {performanceMetrics?.interviewSuccessRate ?? 0}%
            </span>
            <span className="ats-metric-card__sub">Rounds with positive recommendation</span>
          </div>
        </div>
      </div>

      {/* Hiring Funnel Progression Section */}
      <div className="ats-table-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Hiring Funnel Progression
            </h2>
            <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
              Stages ever reached across all candidates in selected period
            </span>
          </div>
          <span className="job-code-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
            UTC Bounded · Aggregate
          </span>
        </div>

        <div className="rec-analytics-funnel-grid" style={{ gap: '12px' }}>
          {[
            { label: 'Jobs Published', count: hiringFunnel?.jobsPublished ?? 0, color: '#0284c7', pct: null },
            { label: 'Applications', count: hiringFunnel?.applications ?? 0, color: '#3b82f6', pct: '100%' },
            { label: 'Screened', count: hiringFunnel?.screened ?? 0, color: '#6366f1', pct: `${Math.round(((hiringFunnel?.screened ?? 0) / (hiringFunnel?.applications || 1)) * 100)}%` },
            { label: 'Assessed', count: hiringFunnel?.assessmentCompleted ?? 0, color: '#8b5cf6', pct: `${Math.round(((hiringFunnel?.assessmentCompleted ?? 0) / (hiringFunnel?.applications || 1)) * 100)}%` },
            { label: 'Interviewed', count: hiringFunnel?.interviewed ?? 0, color: '#ec4899', pct: `${Math.round(((hiringFunnel?.interviewed ?? 0) / (hiringFunnel?.applications || 1)) * 100)}%` },
            { label: 'Offers Sent', count: hiringFunnel?.offers ?? 0, color: '#f59e0b', pct: `${Math.round(((hiringFunnel?.offers ?? 0) / (hiringFunnel?.applications || 1)) * 100)}%` },
            { label: 'Hired', count: hiringFunnel?.hired ?? 0, color: '#10b981', pct: `${Math.round(((hiringFunnel?.hired ?? 0) / (hiringFunnel?.applications || 1)) * 100)}%` },
          ].map((stage) => (
            <div
              key={stage.label}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <strong style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
                  {stage.count}
                </strong>
                {stage.pct && (
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: stage.color,
                      background: `${stage.color}15`,
                      padding: '2px 6px',
                      borderRadius: '9999px',
                    }}
                  >
                    {stage.pct}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78125rem', fontWeight: 600, color: '#64748b' }}>
                {stage.label}
              </span>
              <div style={{ height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div
                  style={{
                    height: '100%',
                    background: stage.color,
                    width: stage.pct ? stage.pct : '100%',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Job Performance Tables Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <div className="ats-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Most Viewed Jobs
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Top listing impressions</span>
          </div>
          <div className="job-table-wrapper">
            <table className="job-modern-table" aria-label="Most viewed jobs">
              <thead>
                <tr>
                  <th>JOB TITLE & ID</th>
                  <th style={{ textAlign: 'center' }}>VIEWS</th>
                  <th style={{ textAlign: 'center' }}>APPLICATIONS</th>
                  <th style={{ textAlign: 'right' }}>CONVERSION</th>
                </tr>
              </thead>
              <tbody>
                {jobPerformance?.mostViewedJobs?.length ? (
                  jobPerformance.mostViewedJobs.map((job: any) => {
                    const codeBadge = `#JOB-${job._id.slice(-6).toUpperCase()}`;
                    const convPct = job.viewsCount > 0 ? Math.round((job.applicationsCount / job.viewsCount) * 100) : 0;
                    return (
                      <tr key={job._id} className="job-table-row">
                        <td className="job-entity-cell">
                          <div className="job-entity-icon">
                            <BriefcaseBusiness size={18} />
                          </div>
                          <div className="job-entity-info">
                            <strong className="job-entity-title">{job.title}</strong>
                            <span className="job-code-badge">{codeBadge}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                          {job.viewsCount}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#0284c7' }}>
                          {job.applicationsCount}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="job-status-pill job-status-pill--info">
                            <span className="job-status-dot job-status-dot--info" />
                            {convPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                      No job view metrics recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ats-table-card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Most Applied Jobs
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Top candidate application volume</span>
          </div>
          <div className="job-table-wrapper">
            <table className="job-modern-table" aria-label="Most applied jobs">
              <thead>
                <tr>
                  <th>JOB TITLE & ID</th>
                  <th style={{ textAlign: 'center' }}>APPLICATIONS</th>
                  <th style={{ textAlign: 'center' }}>VIEWS</th>
                  <th style={{ textAlign: 'right' }}>CONVERSION</th>
                </tr>
              </thead>
              <tbody>
                {jobPerformance?.mostAppliedJobs?.length ? (
                  jobPerformance.mostAppliedJobs.map((job: any) => {
                    const codeBadge = `#JOB-${job._id.slice(-6).toUpperCase()}`;
                    const convPct = job.viewsCount > 0 ? Math.round((job.applicationsCount / job.viewsCount) * 100) : 0;
                    return (
                      <tr key={job._id} className="job-table-row">
                        <td className="job-entity-cell">
                          <div className="job-entity-icon">
                            <BriefcaseBusiness size={18} />
                          </div>
                          <div className="job-entity-info">
                            <strong className="job-entity-title">{job.title}</strong>
                            <span className="job-code-badge">{codeBadge}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#0284c7' }}>
                          {job.applicationsCount}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                          {job.viewsCount}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="job-status-pill job-status-pill--success">
                            <span className="job-status-dot job-status-dot--success" />
                            {convPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px' }}>
                      No candidate applications recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assessment Analytics & AI Match Score Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <Card heading="Assessment Completion & Pass Rate" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Completion Rate</span>
                <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{assessmentAnalytics?.assessmentCompletionRate ?? 0}%</strong>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#0284c7', width: `${assessmentAnalytics?.assessmentCompletionRate ?? 0}%` }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Average Percentage Score</span>
                <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{assessmentAnalytics?.averageScores ?? 0}%</strong>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#6366f1', width: `${assessmentAnalytics?.averageScores ?? 0}%` }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Candidates Pass Rate</span>
                <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>{assessmentAnalytics?.passRate ?? 0}%</strong>
              </div>
              <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#10b981', width: `${assessmentAnalytics?.passRate ?? 0}%` }} />
              </div>
            </div>
          </div>
        </Card>

        <Card heading="AI Match Score Distribution" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            {assessmentAnalytics?.aiMatchScoreDistribution?.map((band: any) => {
              const maxCount = Math.max(1, ...(assessmentAnalytics?.aiMatchScoreDistribution?.map((b: any) => b.count) || [1]));
              const barWidthPct = Math.min(100, Math.round((band.count / maxCount) * 100));

              return (
                <div key={band.band} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '80px', fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                    {band.band}
                  </span>
                  <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barWidthPct}%`,
                        height: '100%',
                        background: band.band.includes('90') ? '#10b981' : band.band.includes('70') ? '#0284c7' : band.band.includes('50') ? '#f59e0b' : '#64748b',
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <strong style={{ width: '40px', textAlign: 'right', fontSize: '0.875rem', color: '#0f172a' }}>
                    {band.count}
                  </strong>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </main>
  );
}
