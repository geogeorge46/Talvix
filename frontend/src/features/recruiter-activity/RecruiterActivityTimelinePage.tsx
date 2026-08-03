import { useState } from 'react';
import {
  History,
  User,
  Activity,
  Calendar,
  Layers,
  Laptop,
  Globe,
  Trash2,
} from 'lucide-react';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from '../../design-system';
import { useRecruiterActivityTimelineQuery } from './api';
import { useCompany } from '../organization-admin/api';

const actionOptions = [
  { value: '', label: 'All Actions' },
  { value: 'company.create', label: 'Company Created' },
  { value: 'company.update', label: 'Company Updated' },
  { value: 'job.create', label: 'Job Created' },
  { value: 'job.publish', label: 'Job Published' },
  { value: 'job.close', label: 'Job Closed' },
  { value: 'application.submit', label: 'Application Submitted' },
  { value: 'application.status.update', label: 'Application Stage Changed' },
  { value: 'interview.schedule', label: 'Interview Scheduled' },
  { value: 'offer.send', label: 'Offer Sent' },
  { value: 'offer.accept', label: 'Offer Accepted' },
  { value: 'recruiter.invite', label: 'Recruiter Invited' },
];

export function RecruiterActivityTimelinePage() {
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [candidateFilter, setCandidateFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  // Get active team members list for dropdown
  const qCompany = useCompany(true, true);
  const teamOptions = [
    { value: '', label: 'All Team Members' },
    ...(qCompany.data?.team || []).map((m) => ({
      value: m.id || '',
      label: m.fullName || m.email || 'Unknown Member',
    })),
  ];

  // Build query string
  const params = new URLSearchParams();
  if (userFilter) params.set('user', userFilter);
  if (actionFilter) params.set('actionType', actionFilter);
  if (jobFilter) params.set('job', jobFilter);
  if (candidateFilter) params.set('candidate', candidateFilter);
  if (fromDate) params.set('from', fromDate);
  if (toDate) params.set('to', toDate);
  params.set('page', String(page));
  params.set('limit', '20');

  const qTimeline = useRecruiterActivityTimelineQuery(params.toString());

  const handleClearFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setJobFilter('');
    setCandidateFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const formatPayload = (val: any) => {
    if (!val) return 'No context data available.';
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader
        title="Activity Log & Timeline"
        description="Comprehensive audit logs of recruiter operations, candidate state transitions, and administrative actions."
      />

      <Card heading="Filter History" headingLevel={2}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem' }}>
          <Select
            label="Actor"
            value={userFilter}
            options={teamOptions}
            onChange={(e) => {
              setUserFilter(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Action Type"
            value={actionFilter}
            options={actionOptions}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Job ID</span>
            <input
              type="text"
              value={jobFilter}
              onChange={(e) => {
                setJobFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. 60f727…"
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Candidate ID</span>
            <input
              type="text"
              value={candidateFilter}
              onChange={(e) => {
                setCandidateFilter(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. 60f727…"
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border-subtle)' }}
            />
          </label>
          <div>
            <Button variant="quiet" onClick={handleClearFilters} leadingIcon={<Trash2 />}>
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      <Card heading="Audit Logs" headingLevel={2}>
        {qTimeline.isLoading ? (
          <LoadingState label="Loading activity logs" />
        ) : qTimeline.isError ? (
          <ErrorState
            detail="Failed to load activity logs from audit repository."
            retry={() => void qTimeline.refetch()}
          />
        ) : qTimeline.data?.data?.items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {qTimeline.data.data.items.map((log: any) => (
              <div
                key={log.id}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} style={{ color: 'var(--color-text-accent)' }} />
                    <strong style={{ fontSize: '1rem', textTransform: 'uppercase' }}>
                      {log.action.replaceAll('_', ' ').replaceAll('.', ' · ')}
                    </strong>
                  </div>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>Performed by:</span>
                    <strong>{log.user ? `${log.user.fullName} (${log.user.email})` : 'System'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>IP Address:</span>
                    <strong>{log.ipAddress === 'Hidden' ? 'Hidden (Admin only)' : log.ipAddress}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>Device:</span>
                    <span title={log.device}>{log.device.length > 30 ? `${log.device.slice(0, 30)}…` : log.device}</span>
                  </div>
                </div>

                {log.relatedEntity && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--color-text-accent)', fontSize: '0.85rem' }}>
                      View payload change data
                    </summary>
                    <pre
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: 'var(--color-bg-subtle)',
                        borderRadius: '4px',
                        overflowX: 'auto',
                        fontSize: '0.8rem',
                      }}
                    >
                      {formatPayload(log.relatedEntity)}
                    </pre>
                  </details>
                )}
              </div>
            ))}

            {qTimeline.data.data.pagination && qTimeline.data.data.pagination.pages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span style={{ alignSelf: 'center' }}>
                  Page {page} of {qTimeline.data.data.pagination.pages}
                </span>
                <Button
                  disabled={page >= qTimeline.data.data.pagination.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="No activity recorded"
            description="No logs matching the selected filters were found."
          />
        )}
      </Card>
    </main>
  );
}
