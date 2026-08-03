import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  LoadingState,
  MetricCard,
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

  // Fetch saved views
  useEffect(() => {
    apiRequest<{ views: any[] }>('/analytics/saved-views')
      .then(res => {
        if (res?.views) {
          setSavedViews(res.views);
          const def = res.views.find(v => v.isDefault);
          if (def) {
            setSelectedViewId(def._id);
            setSelectedDept(def.filters?.department || '');
            setSelectedRange(def.filters?.range || '30');
          }
        }
      })
      .catch(err => console.error('Failed to load views:', err));
  }, []);

  const handleSelectView = (viewId: string) => {
    setSelectedViewId(viewId);
    if (!viewId) {
      setSelectedDept('');
      setSelectedRange('30');
      return;
    }
    const view = savedViews.find(v => v._id === viewId);
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
      isDefault: savedViews.length === 0
    };
    apiRequest<any>('/analytics/saved-views', { method: 'POST', body })
      .then(res => {
        if (res?.view) {
          setSavedViews([res.view, ...savedViews]);
          setSelectedViewId(res.view._id);
          setNewViewName('');
          setShowSaveDialog(false);
        }
      })
      .catch(err => alert(err.message || 'Failed to save view'));
  };

  const handleDeleteView = (viewId: string) => {
    apiRequest(`/analytics/saved-views/${viewId}`, { method: 'DELETE' })
      .then(() => {
        setSavedViews(savedViews.filter(v => v._id !== viewId));
        if (selectedViewId === viewId) {
          setSelectedViewId('');
        }
      })
      .catch(err => console.error(err));
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    apiRequest('/analytics/recruiter/export', {
      method: 'POST',
      body: {
        reportType: selectedViewId ? savedViews.find(v => v._id === selectedViewId)?.name : 'General Recruitment',
        format
      }
    })
      .then(() => {
        alert(`Export queued successfully. You will receive a notification when the ${format.toUpperCase()} file is ready for download.`);
      })
      .catch(err => alert(err.message || 'Failed to trigger export'));
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

  const { hiringFunnel, performanceMetrics, jobPerformance, assessmentAnalytics } = q.data?.data || {};

  return (
    <main className="rec-analytics-page" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader
        title="Recruitment Analytics"
        description="Deep insights into pipeline funnel performance, team productivity, and candidate matching metrics."
        secondaryActions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Select
              label="Saved Views"
              value={selectedViewId}
              options={[
                { value: '', label: 'Default Filters' },
                ...savedViews.map(v => ({ value: v._id, label: v.name + (v.isDefault ? ' (Default)' : '') }))
              ]}
              onChange={(e) => handleSelectView(e.target.value)}
            />
            {selectedViewId && (
              <Button variant="danger" size="compact" leadingIcon={<Trash2 />} onClick={() => handleDeleteView(selectedViewId)}>
                Delete View
              </Button>
            )}
            <Button variant="secondary" leadingIcon={<Save />} onClick={() => setShowSaveDialog(true)}>
              Save Current View
            </Button>
          </div>
        }
        primaryAction={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button leadingIcon={<Download />} onClick={() => handleExport('csv')}>Export CSV</Button>
            <Button leadingIcon={<Download />} onClick={() => handleExport('pdf')}>Export PDF</Button>
          </div>
        }
      />

      {showSaveDialog && (
        <div style={{ padding: '1rem', border: '1px solid var(--color-border-accent)', borderRadius: '8px', background: 'var(--color-bg-surface || #ffffff)' }}>
          <Card heading="Save Current Filter Preset" headingLevel={2}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1rem' }}>
              <input
                type="text"
                placeholder="e.g. Engineering Hiring, Last 30 Days"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--color-border-subtle)', borderRadius: '4px' }}
              />
              <Button onClick={handleSaveView}>Save View</Button>
              <Button variant="quiet" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Date and Department Filtering controls */}
      <div style={{ padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', background: 'var(--color-bg-surface || #ffffff)' }}>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Date range filter</label>
            <Select
              value={selectedRange}
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
              onChange={(e) => setSelectedRange(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Department filter</label>
            <Select
              value={selectedDept}
              options={[
                { value: '', label: 'All Departments' },
                { value: 'engineering', label: 'Engineering' },
                { value: 'sales', label: 'Sales & Marketing' },
                { value: 'hr', label: 'Human Resources' }
              ]}
              onChange={(e) => setSelectedDept(e.target.value)}
            />
          </div>
        </div>
      </div>

      <section aria-label="Funnel Overview">
        <Card heading="Hiring Funnel Metrics" headingLevel={2}>
          <div className="funnel-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.jobsPublished ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Jobs Published</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.applications ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Applications</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.screened ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Screened</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.assessmentCompleted ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Assessed</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.interviewed ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Interviewed</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block' }}>{hiringFunnel?.offers ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Offers Sent</small>
            </div>
            <div className="funnel-stage" style={{ textAlign: 'center', padding: '1rem', border: '1px solid var(--color-border-subtle)', borderRadius: '8px', background: 'var(--color-bg-accent-subtle)' }}>
              <strong style={{ fontSize: '1.5rem', display: 'block', color: 'var(--color-text-accent)' }}>{hiringFunnel?.hired ?? 0}</strong>
              <small style={{ color: 'var(--color-text-subtle)' }}>Hired</small>
            </div>
          </div>
        </Card>
      </section>

      <section aria-label="Performance Cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
        <MetricCard
          label="Time to Hire"
          value={`${performanceMetrics?.averageTimeToHire ?? 0} Days`}
          icon={<History />}
        />
        <MetricCard
          label="Apps per Job"
          value={performanceMetrics?.averageApplicationsPerJob ?? 0}
          icon={<Users />}
        />
        <MetricCard
          label="Offer Accept Rate"
          value={`${performanceMetrics?.offerAcceptanceRate ?? 0}%`}
          icon={<Sparkles />}
        />
        <MetricCard
          label="Interviews Booked"
          value={performanceMetrics?.recruiterProductivity ?? 0}
          icon={<CalendarDays />}
        />
        <MetricCard
          label="Interview Pass Rate"
          value={`${performanceMetrics?.interviewSuccessRate ?? 0}%`}
          icon={<TrendingUp />}
        />
      </section>

      <section aria-label="Job Statistics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <Card heading="Most Viewed Jobs" headingLevel={2}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0' }}>Job Title</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Views</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Applications</th>
              </tr>
            </thead>
            <tbody>
              {jobPerformance?.mostViewedJobs?.length ? (
                jobPerformance.mostViewedJobs.map((job: any) => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.75rem 0' }}>{job.title}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>{job.viewsCount}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>{job.applicationsCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem 0', color: 'var(--color-text-subtle)' }}>No viewed jobs.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <Card heading="Most Applied Jobs" headingLevel={2}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem 0' }}>Job Title</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Applications</th>
                <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Views</th>
              </tr>
            </thead>
            <tbody>
              {jobPerformance?.mostAppliedJobs?.length ? (
                jobPerformance.mostAppliedJobs.map((job: any) => (
                  <tr key={job._id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '0.75rem 0' }}>{job.title}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>{job.applicationsCount}</td>
                    <td style={{ padding: '0.75rem 0', textAlign: 'center' }}>{job.viewsCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: '1rem 0', color: 'var(--color-text-subtle)' }}>No applications yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-label="Assessment Analytics" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <Card heading="Assessment Completion & Performance" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Completion Rate</span>
              <strong>{assessmentAnalytics?.assessmentCompletionRate ?? 0}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Average Percentage Score</span>
              <strong>{assessmentAnalytics?.averageScores ?? 0}%</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Candidates Pass Rate</span>
              <strong>{assessmentAnalytics?.passRate ?? 0}%</strong>
            </div>
          </div>
        </Card>

        <Card heading="AI Match Score Distribution" headingLevel={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            {assessmentAnalytics?.aiMatchScoreDistribution?.map((band: any) => (
              <div key={band.band} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '80px', fontSize: '0.9rem' }}>{band.band}</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--color-bg-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, (band.count / Math.max(1, hiringFunnel?.applications ?? 1)) * 100)}%`,
                    height: '100%',
                    background: 'var(--color-bg-accent)'
                  }} />
                </div>
                <strong style={{ width: '40px', textAlign: 'right' }}>{band.count}</strong>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}
