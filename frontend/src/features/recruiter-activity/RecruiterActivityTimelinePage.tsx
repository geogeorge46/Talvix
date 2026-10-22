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
  { value: 'team.join', label: 'Team Member Joined' },
  { value: 'team.update', label: 'Team Member Updated' },
  { value: 'team.remove', label: 'Team Member Removed' },
  { value: 'job.create', label: 'Job Created' },
  { value: 'job.update', label: 'Job Updated' },
  { value: 'job.submit', label: 'Job Submitted' },
  { value: 'job.approve', label: 'Job Approved' },
  { value: 'job.pause', label: 'Job Paused' },
  { value: 'job.resume', label: 'Job Resumed' },
  { value: 'job.close', label: 'Job Closed' },
  { value: 'job.archive', label: 'Job Archived' },
  { value: 'application.status_update', label: 'Application Stage Changed' },
  { value: 'application.assign_recruiters', label: 'Recruiter Assigned' },
  { value: 'application.tag_update', label: 'Application Tagged' },
  { value: 'application.archive', label: 'Application Archived' },
  { value: 'interview.created', label: 'Interview Scheduled' },
  { value: 'interview.rescheduled', label: 'Interview Rescheduled' },
  { value: 'interview.cancelled', label: 'Interview Cancelled' },
  { value: 'interview.completed', label: 'Interview Completed' },
  { value: 'offer.create', label: 'Offer Created' },
  { value: 'offer.update', label: 'Offer Updated' },
  { value: 'offer.send', label: 'Offer Sent' },
  { value: 'offer.approve', label: 'Offer Approved' },
  { value: 'offer.reject', label: 'Offer Rejected' },
  { value: 'offer.withdraw', label: 'Offer Withdrawn' },
  { value: 'offer.cancel', label: 'Offer Cancelled' },
  { value: 'offer.onboarding_started', label: 'Onboarding Started' },
  { value: 'offer.completed', label: 'Offer Completed' },
  { value: 'recruiter.verification.submitted', label: 'Verification Submitted' },
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
      value: m.recruiterId || m.id || '',
      label: m.fullName
        ? `${m.fullName} (${m.email || m.accountRole || m.role})`
        : m.email || 'Team Member',
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

  const timelineData = (
    qTimeline.data?.items ? qTimeline.data : qTimeline.data?.data
  ) as
    | {
        items: any[];
        pagination?: {
          page: number;
          limit: number;
          total: number;
          pages: number;
        };
      }
    | undefined;
  const items = timelineData?.items ?? [];
  const pagination = timelineData?.pagination;

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

  const describeActivity = (log: any): {
    title: string;
    subtitle?: string;
    chips: { label: string; value: string }[];
  } => {
    const action = String(log.action || '').toLowerCase();
    const data = log.relatedEntity || {};
    const chips: { label: string; value: string }[] = [];

    const getVal = (key: string) => {
      const v = data[key] ?? data.newValue?.[key] ?? data.oldValue?.[key];
      if (v !== undefined && v !== null && typeof v !== 'object') return String(v);
      return '';
    };

    const title = getVal('title') || getVal('jobTitle') || getVal('name');
    const status = getVal('status') || getVal('stage') || getVal('newStatus') || getVal('to');
    const prevStatus = getVal('previousStatus') || getVal('previousStage') || getVal('from');
    const candidateName = getVal('candidateName') || getVal('candidate');
    const reason = getVal('reason') || getVal('note');
    const category = getVal('category');
    const role = getVal('role');

    if (title) chips.push({ label: 'Title', value: title });
    if (prevStatus && status) {
      chips.push({ label: 'Transition', value: `${prevStatus} → ${status}` });
    } else if (status) {
      chips.push({ label: 'Status', value: status });
    }
    if (candidateName) chips.push({ label: 'Candidate', value: candidateName });
    if (category) chips.push({ label: 'Category', value: category.replaceAll('-', ' ') });
    if (role) chips.push({ label: 'Role', value: role.replaceAll('_', ' ') });
    if (reason) chips.push({ label: 'Reason', value: reason });

    if (action.includes('company.create')) {
      return {
        title: title ? `Created organization workspace "${title}"` : 'Organization workspace initialized',
        subtitle: 'Company workspace was created and administrative access was configured.',
        chips,
      };
    }
    if (action.includes('company.update')) {
      return {
        title: title ? `Updated profile for "${title}"` : 'Updated company workspace profile',
        subtitle: 'Organization details, industry, website, or verification settings were updated.',
        chips,
      };
    }
    if (action.includes('job.create')) {
      return {
        title: title ? `Created job posting "${title}"` : 'Created new job posting',
        subtitle: status ? `Job initialized with status "${status}".` : 'New requisition created in draft stage.',
        chips,
      };
    }
    if (action.includes('job.publish') || (action.includes('job') && status === 'published')) {
      return {
        title: title ? `Published job "${title}"` : 'Published job posting',
        subtitle: 'Job posting is now published and accepting candidate applications.',
        chips,
      };
    }
    if (action.includes('job.close') || (action.includes('job') && status === 'closed')) {
      return {
        title: title ? `Closed job "${title}"` : 'Closed job posting',
        subtitle: 'Requisition was closed to candidate submissions.',
        chips,
      };
    }
    if (action.includes('job.update') || action.includes('job.status')) {
      return {
        title: title ? `Updated job "${title}"` : 'Updated job configuration',
        subtitle: status ? `Status updated to "${status}".` : 'Job details, requirements, or settings were modified.',
        chips,
      };
    }
    if (action.includes('application.status') || action.includes('application.stage')) {
      const stageDesc = prevStatus && status ? `from ${prevStatus} to ${status}` : status ? `to ${status}` : '';
      return {
        title: candidateName ? `Moved ${candidateName}'s application ${stageDesc}` : `Updated candidate pipeline stage ${stageDesc}`,
        subtitle: 'Candidate recruitment workflow stage transition.',
        chips,
      };
    }
    if (action.includes('application.create') || action.includes('application.submit')) {
      return {
        title: candidateName ? `Received application from ${candidateName}` : 'New candidate application received',
        subtitle: title ? `Applied for position: ${title}` : 'Candidate applied to open requisition.',
        chips,
      };
    }
    if (action.includes('interview.schedule') || action.includes('interview.scheduled') || action.includes('interview.create')) {
      return {
        title: 'Scheduled candidate interview round',
        subtitle: 'Interview session scheduled with recruiter or hiring team.',
        chips,
      };
    }
    if (action.includes('interview.feedback') || action.includes('interview.score')) {
      return {
        title: 'Submitted interview feedback and scoring',
        subtitle: 'Evaluator scorecard or assessment feedback recorded.',
        chips,
      };
    }
    if (action.includes('offer.create') || action.includes('offer.draft')) {
      return {
        title: 'Drafted candidate job offer',
        subtitle: 'Compensation package and offer terms prepared for review.',
        chips,
      };
    }
    if (action.includes('offer.approve') || action.includes('offer.approved')) {
      return {
        title: 'Approved employment offer',
        subtitle: 'Internal compensation and hiring team approvals completed.',
        chips,
      };
    }
    if (action.includes('offer.send') || action.includes('offer.sent')) {
      return {
        title: 'Extended job offer to candidate',
        subtitle: 'Formal employment offer delivered to the candidate.',
        chips,
      };
    }
    if (action.includes('offer.accept') || action.includes('offer.accepted')) {
      return {
        title: 'Candidate accepted job offer',
        subtitle: 'Offer accepted; candidate is moving toward onboarding.',
        chips,
      };
    }
    if (action.includes('offer.decline') || action.includes('offer.declined')) {
      return {
        title: 'Candidate declined job offer',
        subtitle: reason ? `Declined reason: ${reason}` : 'Offer was declined by candidate.',
        chips,
      };
    }
    if (action.includes('document.upload') || action.includes('document.create')) {
      return {
        title: title ? `Uploaded document: "${title}"` : 'Candidate document uploaded',
        subtitle: category ? `Category: ${category.replaceAll('-', ' ')}` : 'File submitted into candidate record.',
        chips,
      };
    }
    if (action.includes('document.verify') || action.includes('document.approve')) {
      return {
        title: title ? `Verified document: "${title}"` : 'Document verified by recruiter',
        subtitle: 'Document verification passed administrative review.',
        chips,
      };
    }
    if (action.includes('document.reject')) {
      return {
        title: title ? `Rejected document: "${title}"` : 'Document rejected by reviewer',
        subtitle: reason ? `Reason: ${reason}` : 'Document was flagged or rejected.',
        chips,
      };
    }
    if (action.includes('member.invite') || action.includes('invite')) {
      return {
        title: 'Invited team member to organization',
        subtitle: role ? `Assigned role: ${role}` : 'Workspace invitation issued.',
        chips,
      };
    }
    if (action.includes('member.join') || action.includes('member.add')) {
      return {
        title: 'Team member joined organization',
        subtitle: 'New collaborator active in company workspace.',
        chips,
      };
    }

    const readable = action.replace(/[_.]+/g, ' ');
    const formatted = readable.charAt(0).toUpperCase() + readable.slice(1);
    return {
      title: formatted,
      subtitle: status ? `Status: ${status}` : undefined,
      chips,
    };
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
        ) : items.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((log: any) => {
              const desc = describeActivity(log);
              return (
                <div
                  key={log.id}
                  style={{
                    padding: '1.25rem',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    backgroundColor: 'var(--color-bg-card, #ffffff)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <Activity size={18} style={{ color: 'var(--color-text-accent)' }} />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'var(--color-bg-subtle, #f3f4f6)',
                            color: 'var(--color-text-subtle, #6b7280)',
                          }}
                        >
                          {log.action.replaceAll('_', ' ').replaceAll('.', ' · ')}
                        </span>
                        {log.count > 1 && (
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '0.15rem 0.45rem',
                              borderRadius: '9999px',
                              backgroundColor: '#e0e7ff',
                              color: '#3730a3',
                            }}
                          >
                            {log.count} events
                          </span>
                        )}
                      </div>
                      <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {desc.title}
                      </h3>
                      {desc.subtitle && (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted, #4b5563)' }}>
                          {desc.subtitle}
                        </p>
                      )}
                    </div>
                    <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {desc.chips.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                      {desc.chips.map((chip, idx) => (
                        <span
                          key={idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-bg-subtle, #f9fafb)',
                            border: '1px solid var(--color-border-subtle, #e5e7eb)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <span style={{ color: 'var(--color-text-subtle, #6b7280)', fontWeight: 500 }}>{chip.label}:</span>
                          <strong style={{ color: 'var(--color-text-primary, #111827)' }}>{chip.value}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>Actor:</span>
                      <strong>{log.user ? `${log.user.fullName} (${log.user.email})` : 'System'}</strong>
                    </div>
                    {log.ipAddress && log.ipAddress !== 'Unknown' && (
                      <div>
                        <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>IP Address:</span>
                        <strong>{log.ipAddress === 'Hidden' ? 'Hidden (Admin only)' : log.ipAddress}</strong>
                      </div>
                    )}
                    {log.device && log.device !== 'Unknown' && (
                      <div>
                        <span style={{ color: 'var(--color-text-subtle)', marginRight: '0.5rem' }}>Device:</span>
                        <span title={log.device}>{log.device.length > 30 ? `${log.device.slice(0, 30)}…` : log.device}</span>
                      </div>
                    )}
                  </div>

                  {log.relatedEntity && (
                    <details style={{ marginTop: '0.25rem' }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--color-text-accent)', fontSize: '0.85rem' }}>
                        View technical JSON payload
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
              );
            })}

            {pagination && pagination.pages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'center' }}>
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span style={{ alignSelf: 'center' }}>
                  Page {page} of {pagination.pages}
                </span>
                <Button
                  disabled={page >= pagination.pages}
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
