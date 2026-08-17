import { useEffect, useState, useRef, type FormEvent } from 'react';
import {
  Link,
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
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  LoadingState,
  PageHeader,
  Pagination,
  Select,
  StatusTag,
  TextArea,
  TextField,
  useToast,
} from '../../design-system';
import { apiRequest, tokenStore } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  useApplication,
  useApplicationMutation,
  useApplications,
  useApplicationTimeline,
  useCandidateProfile,
  useCandidateProfileMutation,
  useCandidateProfilePhoto,
  useJob,
  useJobs,
  useNotificationMutation,
  useNotification,
  useNotificationPreferenceMutation,
  useNotificationPreferences,
  useNotifications,
  useSafeCandidateAssignments,
  useSafeCandidateInterviews,
  useSafeCandidateOffers,
} from './api';
import type { CandidateProfile } from './model';
import { UploadControl } from '../offers-documents';
import {
  Sparkles,
  ChevronRight,
  User,
  FileText,
  Briefcase,
  ClipboardCheck,
  Calendar,
  Award,
  Bell,
} from 'lucide-react';
import './candidate-portal.css';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(value),
      )
    : 'Not provided';
const withdrawable = new Set([
  'submitted',
  'under-review',
  'shortlisted',
  'assessment-pending',
  'interview-scheduled',
]);

export function CandidateDashboardPage() {
  const profile = useCandidateProfile(),
    apps = useApplications('page=1&limit=5');
  const assessments = useSafeCandidateAssignments();
  const interviews = useSafeCandidateInterviews();
  const offers = useSafeCandidateOffers();
  const notifications = useNotifications('page=1&limit=5&read=false');
  const actions = [
    ...(assessments.data ?? [])
      .filter(
        (a) =>
          ['assigned', 'available', 'in-progress'].includes(a.status) &&
          a.expiresAt,
      )
      .map((a) => ({
        label: `Complete ${a.title}`,
        detail: `Due ${date(a.expiresAt)}`,
        at: a.expiresAt,
        href: `/candidate/assessments/${a.id}`,
      })),
    ...(interviews.data ?? []).flatMap((process) =>
      process.rounds
        .filter(
          (round) =>
            round.schedule &&
            (!round.schedule.candidateResponse ||
              round.schedule.candidateResponse === 'pending'),
        )
        .map((round) => ({
          label: `Respond to ${round.name || 'interview'}`,
          detail: `Scheduled ${date(round.schedule?.startTime)}`,
          at: round.schedule?.startTime ?? '',
          href: `/candidate/interviews/${process.id}`,
        })),
    ),
    ...(offers.data ?? [])
      .filter((offer) => ['sent', 'viewed', 'revised'].includes(offer.status))
      .map((offer) => ({
        label: `Review ${offer.title}`,
        detail: offer.expiresAt
          ? `Respond by ${date(offer.expiresAt)}`
          : 'Response requested',
        at: offer.expiresAt ?? '9999',
        href: `/candidate/offers/${offer.id}`,
      })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nextAction = actions[0];
  return (
    <div className="candidate-page">
      <PageHeader
        title="Candidate workspace"
        description="Keep your search moving, one clear next step at a time."
      />
      
      {/* Premium Hero Next Best Action */}
      <section className="candidate-hero-premium" aria-label="Next best action">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} className="hero-badge-icon" />
            <span>NEXT BEST ACTION</span>
          </div>
          <h2 className="hero-heading">
            {nextAction?.label ??
              (!profile.data?.headline
                ? 'Complete your candidate headline'
                : 'No urgent deadline')}
          </h2>
          <p className="hero-subtext">
            {nextAction?.detail ??
              (!profile.data?.headline
                ? 'Help recruiters understand the work you want to do.'
                : 'You have no assessment, interview, or offer response due right now.')}
          </p>
        </div>
        <Link
          className="hero-action-btn"
          to={
            nextAction?.href ??
            (!profile.data?.headline
              ? '/candidate/profile'
              : '/candidate/applications')
          }
        >
          <span>
            {nextAction
              ? 'Open action'
              : !profile.data?.headline
                ? 'Complete profile'
                : 'View applications'}
          </span>
          <ChevronRight size={16} />
        </Link>
      </section>

      {/* Top 3 Column Cards Summary */}
      <div className="candidate-grid-3">
        <div className="candidate-dashboard-card">
          <div className="card-icon-wrapper color-profile">
            <User size={20} />
          </div>
          <div className="card-body">
            <h3>Profile</h3>
            {profile.isPending ? (
              <LoadingState label="Loading profile" />
            ) : profile.isError ? (
              <ErrorState title="Profile unavailable" detail={message(profile.error)} />
            ) : (
              <div className="profile-summary-text">
                <span className="profile-headline">{profile.data?.headline || 'Headline needed'}</span>
                <span className="profile-visibility-badge">
                  Visibility: {profile.data?.profileVisibility}
                </span>
              </div>
            )}
            <Link className="card-link" to="/candidate/profile">Edit profile →</Link>
          </div>
        </div>

        <div className="candidate-dashboard-card">
          <div className="card-icon-wrapper color-apps">
            <FileText size={20} />
          </div>
          <div className="card-body">
            <h3>Applications</h3>
            {apps.isPending ? (
              <LoadingState label="Loading applications" />
            ) : apps.isError ? (
              <ErrorState title="Applications unavailable" detail={message(apps.error)} />
            ) : (
              <div className="apps-summary-text">
                <strong className="summary-number">{apps.data?.total || 0}</strong>
                <span className="summary-label">Applications in your workspace</span>
              </div>
            )}
            <Link className="card-link" to="/candidate/applications">View all →</Link>
          </div>
        </div>

        <div className="candidate-dashboard-card">
          <div className="card-icon-wrapper color-work">
            <Briefcase size={20} />
          </div>
          <div className="card-body">
            <h3>Quick links</h3>
            <p className="card-description">Access your dedicated recruiting workspaces instantly.</p>
            <div className="candidate-pills">
              <Link className="pill-link" to="/candidate/assessments">Assessments</Link>
              <Link className="pill-link" to="/candidate/interviews">Interviews</Link>
              <Link className="pill-link" to="/candidate/offers">Offers</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Applications Section */}
      <section className="dashboard-section">
        <h2 className="section-title">Recent applications</h2>
        {apps.data?.items.length ? (
          <div className="applications-table-wrapper">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Job details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {apps.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong className="table-job-title">{a.jobTitle || 'Application'}</strong>
                        <span className="table-company">{a.companyName}</span>
                      </div>
                    </td>
                    <td>
                      <StatusTag>{a.status}</StatusTag>
                    </td>
                    <td>
                      <Link className="table-action-link" to={`/candidate/applications/${a.id}`}>
                        Open details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !apps.isPending && (
            <EmptyState
              title="No applications yet"
              description="Explore open jobs and apply when you find the right fit."
              action={
                <Link className="candidate-button-link" to="/candidate/jobs">
                  Browse jobs
                </Link>
              }
            />
          )
        )}
      </section>

      {/* Deadlines and Activity Grid (Aligned 4 Columns) */}
      <section className="dashboard-section" aria-labelledby="candidate-deadlines-title">
        <h2 id="candidate-deadlines-title" className="section-title">Deadlines and activity</h2>
        <div className="candidate-grid-4">
          <DomainSummaryCard
            title="Assessments"
            href="/candidate/assessments"
            pending={assessments.isPending}
            error={assessments.error}
            count={assessments.data?.length}
            icon={<ClipboardCheck size={20} />}
            themeClass="theme-assessments"
          />
          <DomainSummaryCard
            title="Interviews"
            href="/candidate/interviews"
            pending={interviews.isPending}
            error={interviews.error}
            count={interviews.data?.length}
            icon={<Calendar size={20} />}
            themeClass="theme-interviews"
          />
          <DomainSummaryCard
            title="Offers"
            href="/candidate/offers"
            pending={offers.isPending}
            error={offers.error}
            count={offers.data?.length}
            icon={<Award size={20} />}
            themeClass="theme-offers"
          />
          <DomainSummaryCard
            title="Unread updates"
            href="/candidate/notifications"
            pending={notifications.isPending}
            error={notifications.error}
            count={notifications.data?.total}
            icon={<Bell size={20} />}
            themeClass="theme-updates"
          />
        </div>
      </section>
    </div>
  );
}

interface DomainSummaryCardProps {
  title: string;
  href: string;
  pending: boolean;
  error: unknown;
  count: number | undefined;
  icon: React.ReactNode;
  themeClass: string;
}

function DomainSummaryCard({
  title,
  href,
  pending,
  error,
  count,
  icon,
  themeClass,
}: DomainSummaryCardProps) {
  return (
    <div className={`domain-summary-card ${themeClass}`}>
      <div className="card-header-row">
        <div className="domain-icon-box">{icon}</div>
        <h3>{title}</h3>
      </div>
      <div className="card-count-box">
        {pending ? (
          <LoadingState label={`Loading ${title.toLowerCase()}`} />
        ) : error ? (
          <p className="error-text" role="status">Temporarily unavailable</p>
        ) : (
          <span className="domain-count">{count ?? 0}</span>
        )}
      </div>
      <Link className="domain-action-btn" to={href}>
        Open {title.toLowerCase()}
      </Link>
    </div>
  );
}

export function CandidateProfilePage() {
  const { user } = useAuth();
  const q = useCandidateProfile(),
    mutation = useCandidateProfileMutation();
  const photo = useCandidateProfilePhoto();
  const [confirm, setConfirm] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [validationError, setValidationError] = useState('');
  if (q.isPending) return <LoadingState label="Loading profile" />;
  if (q.isError)
    return <ErrorState title="Profile unavailable" detail={message(q.error)} />;
  const p = q.data;

  const currentCurrency = p.expectedSalary?.currency ?? 'INR';
  const currencyOptions = [
    { value: 'INR', label: 'INR (₹)' },
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'CAD', label: 'CAD (C$)' },
    { value: 'AUD', label: 'AUD (A$)' },
    { value: 'SGD', label: 'SGD (S$)' },
    { value: 'AED', label: 'AED (د.إ)' },
  ];
  if (!currencyOptions.some(o => o.value === currentCurrency)) {
    currencyOptions.push({ value: currentCurrency, label: currentCurrency });
  }

  const currentJobTypesVal = p.preferredJobTypes.join(', ');
  const jobTypeOptions = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'full-time, part-time', label: 'Full-time & Part-time' },
    { value: 'full-time, part-time, contract', label: 'Full-time, Part-time & Contract' },
    { value: 'full-time, part-time, contract, internship, freelance', label: 'All Job Types' },
  ];
  if (currentJobTypesVal && !jobTypeOptions.some(o => o.value === currentJobTypesVal)) {
    jobTypeOptions.push({ value: currentJobTypesVal, label: currentJobTypesVal });
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');
    const f = new FormData(e.currentTarget);
    const phoneVal = String(f.get('phone')).trim();
    if (phoneVal && !/^[+()\-\s\d]{7,20}$/.test(phoneVal)) {
      setValidationError('Phone number must contain only numbers, spaces, hyphens, parentheses, or + and be between 7 and 20 characters.');
      return;
    }

    const headlineVal = String(f.get('headline')).trim();
    if (headlineVal.length > 150) {
      setValidationError('Professional headline must not exceed 150 characters.');
      return;
    }

    const bioVal = String(f.get('bio')).trim();
    if (bioVal.length > 3000) {
      setValidationError('Bio must not exceed 3000 characters.');
      return;
    }

    const availabilityVal = String(f.get('availability'));
    const noticePeriodDaysVal = String(f.get('noticePeriodDays'));
    if (availabilityVal === 'notice-period') {
      const days = Number(noticePeriodDaysVal);
      if (!noticePeriodDaysVal || Number.isNaN(days) || days < 0) {
        setValidationError('Notice period days is required and must be a positive number.');
        return;
      }
    }

    const minSalaryVal = String(f.get('salaryMinimum'));
    const maxSalaryVal = String(f.get('salaryMaximum'));
    if (minSalaryVal || maxSalaryVal) {
      const min = Number(minSalaryVal);
      const max = Number(maxSalaryVal);
      if (minSalaryVal && (Number.isNaN(min) || min < 0)) {
        setValidationError('Minimum salary must be a positive number.');
        return;
      }
      if (maxSalaryVal && (Number.isNaN(max) || max < 0)) {
        setValidationError('Maximum salary must be a positive number.');
        return;
      }
      if (minSalaryVal && maxSalaryVal && min > max) {
        setValidationError('Minimum salary cannot exceed maximum salary.');
        return;
      }
    }

    const visibility = String(f.get('profileVisibility'));
    const body = {
      headline: headlineVal,
      bio: bioVal,
      phone: phoneVal || undefined,
      location: {
        city: String(f.get('city')),
        state: String(f.get('state')),
        country: String(f.get('country')),
      },
      dateOfBirth: String(f.get('dateOfBirth')) || undefined,
      gender: String(f.get('gender')) || undefined,
      socialLinks: {
        github: String(f.get('github')) || undefined,
        linkedin: String(f.get('linkedin')) || undefined,
        portfolio: String(f.get('portfolio')) || undefined,
      },
      preferredRoles: String(f.get('preferredRoles'))
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      preferredLocations: String(f.get('preferredLocations'))
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      preferredJobTypes: String(f.get('preferredJobTypes'))
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      ...(minSalaryVal && maxSalaryVal
        ? {
            expectedSalary: {
              minimum: Number(minSalaryVal),
              maximum: Number(maxSalaryVal),
              currency: String(f.get('salaryCurrency')).toUpperCase(),
            },
          }
        : { expectedSalary: null }),
      availability: availabilityVal || undefined,
      ...(availabilityVal === 'notice-period'
        ? { noticePeriodDays: Number(noticePeriodDaysVal) }
        : {}),
      profileVisibility: visibility,
    };
    if (visibility !== p.profileVisibility) {
      setPendingProfile(body);
      setConfirm(true);
      return;
    }
    mutation.mutate({ body });
  };
  return (
    <div className="candidate-page">
      <PageHeader
        title="Candidate profile"
        description="The professional information recruiters may see according to your visibility setting."
      />
      <Alert title="Visibility explained">
        Public means discoverable to authenticated Talvix recruiters and
        administrators—not the open web. Talvix does not support per-section
        privacy.
      </Alert>

      {/* Two-Column Grid Layout */}
      <div className="profile-layout-grid">
        
        {/* Left Column - Avatar & Core Uploads */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* User profile preview card */}
          <div className="tvx-card tvx-card--bordered" style={{ padding: '24px', textAlign: 'center', background: 'var(--color-surface-1)', borderRadius: '12px' }}>
            {photo.data?.url ? (
              <img 
                src={photo.data.url} 
                alt="Profile" 
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '1px solid var(--color-border-default)',
                  margin: '0 auto 16px auto',
                  display: 'block',
                }}
              />
            ) : (
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--color-info-bg)',
                color: 'var(--color-info-fg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                fontSize: '32px',
                fontWeight: 'bold',
              }}>
                {user?.fullName ? user.fullName[0]?.toUpperCase() : 'U'}
              </div>
            )}
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '600', color: 'var(--color-text-strong)' }}>{user?.fullName || 'User Profile'}</h3>
            <span style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>{p.headline || 'No headline set'}</span>
            <StatusTag tone={p.profileVisibility === 'public' ? 'success' : p.profileVisibility === 'recruiters-only' ? 'info' : 'neutral'}>
              {p.profileVisibility === 'public' ? 'Public' : p.profileVisibility === 'recruiters-only' ? 'Recruiters-Only' : 'Private'}
            </StatusTag>
          </div>

          {/* Privacy & Visibility Settings Card */}
          <div className="tvx-card tvx-card--bordered" style={{ padding: '24px', background: 'var(--color-surface-1)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: 'var(--color-text-strong)' }}>Visibility settings</h3>
            <FormField label="Configure search discoverability">
              {({ id, ...control }) => (
                <Select
                  id={id}
                  {...control}
                  form="profile-form"
                  name="profileVisibility"
                  defaultValue={p.profileVisibility}
                  options={[
                    { value: 'public', label: 'Public within Talvix' },
                    { value: 'recruiters-only', label: 'Recruiters only' },
                    { value: 'private', label: 'Private' },
                  ]}
                />
              )}
            </FormField>
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4', marginTop: '12px', marginBottom: 0 }}>
              Adjusting this will determine whether recruiters can discover your profile when doing outbound searches on Talvix.
            </p>
          </div>

          {/* Profile Photo */}
          <div className="tvx-card tvx-card--bordered" style={{ padding: '24px', background: 'var(--color-surface-1)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: 'var(--color-text-strong)' }}>Profile photo</h3>
            {photo.isPending ? (
              <LoadingState label="Loading profile photo" />
            ) : photo.data ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {photo.data.url ? (
                    <img 
                      src={photo.data.url} 
                      alt="Profile Thumbnail" 
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border-default)' }} 
                    />
                  ) : (
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-info-bg)', color: 'var(--color-info-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {user?.fullName ? user.fullName[0]?.toUpperCase() : 'U'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-strong)' }}>
                      {photo.data.displayName || 'photo.jpg'}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Status: {photo.data.status}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="danger"
                    size="compact"
                    onClick={async () => {
                      try {
                        await apiRequest('/documents/me/profile-photo', { method: 'DELETE' });
                        q.refetch();
                        photo.refetch();
                      } catch (e) {
                        console.error('Failed to delete photo', e);
                      }
                    }}
                  >
                    Delete photo
                  </Button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>No profile photo uploaded.</p>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <UploadControl
                entityType="candidate-profile"
                entityId={p.id}
                category="profile-photo"
                path={photo.data ? '/documents/me/profile-photo/replace' : '/documents/me/profile-photo'}
                onDone={() => {
                  q.refetch();
                  photo.refetch();
                }}
              />
            </div>
            
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: '1.4', margin: 0 }}>
              Profile photos use the private specialized document contract. You can upload and replace them directly from here.
            </p>
          </div>

          {/* Resume Card */}
          <div className="tvx-card tvx-card--bordered" style={{ padding: '24px', background: 'var(--color-surface-1)', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600', color: 'var(--color-text-strong)' }}>Resume document</h3>
            {p.resume ? (
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--color-surface-2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)' }}>
                <FileText size={24} style={{ color: 'var(--color-success-fg)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-strong)' }}>
                    {p.resume.displayName || 'resume.pdf'}
                  </strong>
                  <a href={p.resume.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--color-action-primary)', textDecoration: 'underline' }}>
                    View uploaded resume
                  </a>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--color-warning-bg)', borderRadius: '8px', border: '1px solid var(--color-warning-border)', color: 'var(--color-warning-fg)', fontSize: '12px' }}>
                No resume uploaded. A resume is required to apply for most jobs.
              </div>
            )}
            <UploadControl
              entityType="candidate-profile"
              entityId={p.id}
              category="resume"
              path={p.resumeDocument ? '/documents/me/resume/replace' : '/documents/me/resume'}
              onDone={() => {
                q.refetch();
              }}
            />
          </div>
        </div>

        {/* Right Column - Editor Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="tvx-card tvx-card--bordered" style={{ padding: '28px', background: 'var(--color-surface-1)', borderRadius: '12px' }}>
            <form id="profile-form" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px', color: 'var(--color-text-strong)' }}>Personal Summary</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <FormField label="Professional headline">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        name="headline"
                        defaultValue={p.headline}
                      />
                    )}
                  </FormField>
                  <FormField label="About you">
                    {({ id, ...control }) => (
                      <TextArea id={id} {...control} name="bio" defaultValue={p.bio} />
                    )}
                  </FormField>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '20px 0 16px 0', fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px', color: 'var(--color-text-strong)' }}>Contact & Demographics</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>
                  <FormField label="Phone number">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="phone" defaultValue={p.phone} />
                    )}
                  </FormField>
                </div>
                
                <div className="candidate-form-grid">
                  <FormField label="City">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="city" placeholder="City" defaultValue={p.location.city} />
                    )}
                  </FormField>
                  <FormField label="State">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="state" placeholder="State" defaultValue={p.location.state} />
                    )}
                  </FormField>
                  <FormField label="Country">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="country" placeholder="Country" defaultValue={p.location.country} />
                    )}
                  </FormField>
                  <FormField label="Date of birth">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="dateOfBirth" type="date" defaultValue={p.dateOfBirth?.slice(0, 10)} />
                    )}
                  </FormField>
                  <FormField label="Gender">
                    {({ id, ...control }) => (
                      <Select
                        id={id}
                        {...control}
                        name="gender"
                        placeholder="Gender"
                        defaultValue={p.gender ?? ''}
                        options={[
                          'female',
                          'male',
                          'non-binary',
                          'prefer-not-to-say',
                        ].map((value) => ({ value, label: value }))}
                      />
                    )}
                  </FormField>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '20px 0 16px 0', fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px', color: 'var(--color-text-strong)' }}>Online Presence</h3>
                <div className="candidate-form-grid">
                  <FormField label="GitHub Profile">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="github" type="url" placeholder="https://github.com/..." defaultValue={p.socialLinks.github} />
                    )}
                  </FormField>
                  <FormField label="LinkedIn Profile">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="linkedin" type="url" placeholder="https://linkedin.com/in/..." defaultValue={p.socialLinks.linkedin} />
                    )}
                  </FormField>
                  <FormField label="Portfolio URL">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="portfolio" type="url" placeholder="https://..." defaultValue={p.socialLinks.portfolio} />
                    )}
                  </FormField>
                </div>
              </div>

              <div>
                <h3 style={{ margin: '20px 0 16px 0', fontSize: '16px', fontWeight: '600', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '8px', color: 'var(--color-text-strong)' }}>Job Preferences & Compensation</h3>
                <div className="candidate-form-grid" style={{ marginBottom: '12px' }}>
                  <FormField label="Preferred roles">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="preferredRoles" placeholder="e.g. Frontend Engineer, Product Manager" defaultValue={p.preferredRoles.join(', ')} />
                    )}
                  </FormField>
                  <FormField label="Preferred locations">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="preferredLocations" placeholder="e.g. Remote, Bangalore" defaultValue={p.preferredLocations.join(', ')} />
                    )}
                  </FormField>
                  <FormField label="Preferred job types">
                    {({ id, ...control }) => (
                      <Select
                        id={id}
                        {...control}
                        name="preferredJobTypes"
                        placeholder="Choose job type"
                        defaultValue={currentJobTypesVal || 'full-time'}
                        options={jobTypeOptions}
                      />
                    )}
                  </FormField>
                </div>
                
                <div className="candidate-form-grid">
                  <FormField label="Expected salary min">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="salaryMinimum" type="number" min="0" defaultValue={p.expectedSalary?.minimum} />
                    )}
                  </FormField>
                  <FormField label="Expected salary max">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="salaryMaximum" type="number" min="0" defaultValue={p.expectedSalary?.maximum} />
                    )}
                  </FormField>
                  <FormField label="Salary currency">
                    {({ id, ...control }) => (
                      <Select
                        id={id}
                        {...control}
                        name="salaryCurrency"
                        placeholder="Currency"
                        defaultValue={p.expectedSalary?.currency ?? 'INR'}
                        options={currencyOptions}
                      />
                    )}
                  </FormField>
                  <FormField label="Availability">
                    {({ id, ...control }) => (
                      <Select
                        id={id}
                        {...control}
                        name="availability"
                        placeholder="Availability"
                        defaultValue={p.availability ?? ''}
                        options={['immediately', 'notice-period', 'unavailable'].map(
                          (value) => ({ value, label: value }),
                        )}
                      />
                    )}
                  </FormField>
                  <FormField label="Notice period days">
                    {({ id, ...control }) => (
                      <TextField id={id} {...control} name="noticePeriodDays" type="number" min="0" max="365" defaultValue={p.noticePeriodDays} />
                    )}
                  </FormField>
                </div>
              </div>

              {(validationError || mutation.isError) && (
                <Alert tone="danger" title="Profile was not saved">
                  {validationError || message(mutation.error)}
                </Alert>
              )}

              <FormActions>
                <Button type="submit" loading={mutation.isPending}>
                  Save profile details
                </Button>
              </FormActions>
            </form>
          </div>
        </div>
      </div>

      <ProfileCollections profile={p} />
      
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Change profile visibility?"
        description="This changes who can discover your complete profile. Review the visibility explanation before continuing."
        confirmLabel="Change visibility"
        onConfirm={() => {
          if (pendingProfile) mutation.mutate({ body: pendingProfile });
          setPendingProfile(null);
          setConfirm(false);
        }}
      />
    </div>
  );
}
type ProfileItem =
  | CandidateProfile['skills'][number]
  | CandidateProfile['experience'][number]
  | CandidateProfile['education'][number]
  | CandidateProfile['projects'][number]
  | CandidateProfile['certifications'][number];
function ProfileItemContent({
  item,
  path,
}: {
  item: ProfileItem;
  path: string;
}) {
  if (path === 'skills') {
    const skill = item as CandidateProfile['skills'][number];
    return (
      <div className="candidate-item-content">
        <strong>{skill.name}</strong>
        <div className="candidate-item-meta">
          <Badge variant="accent">{skill.proficiency}</Badge>
          {skill.yearsOfExperience > 0 && (
            <span>· {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'} experience</span>
          )}
        </div>
      </div>
    );
  }
  if (path === 'experience') {
    const experience = item as CandidateProfile['experience'][number];
    return (
      <div className="candidate-item-content">
        <strong>{experience.title}</strong>
        <div className="candidate-item-meta">
          <span>{experience.company}</span>
          {experience.startDate && (
            <span>
              · {experience.startDate} — {experience.currentlyWorking ? 'Present' : experience.endDate || ''}
            </span>
          )}
        </div>
      </div>
    );
  }
  if (path === 'education') {
    const education = item as CandidateProfile['education'][number];
    return (
      <div className="candidate-item-content">
        <strong>{education.degree}</strong>
        <div className="candidate-item-meta">
          <span>{education.institution}</span>
          {education.startYear && (
            <span>
              · {education.startYear} — {education.currentlyStudying ? 'Present' : education.endYear || ''}
            </span>
          )}
        </div>
      </div>
    );
  }
  if (path === 'projects') {
    const project = item as CandidateProfile['projects'][number];
    return (
      <div className="candidate-item-content">
        <strong>{project.title}</strong>
        {project.description && <p className="candidate-item-desc">{project.description}</p>}
      </div>
    );
  }
  if (path === 'certifications') {
    const certification = item as CandidateProfile['certifications'][number];
    return (
      <div className="candidate-item-content">
        <strong>{certification.name}</strong>
        <div className="candidate-item-meta">
          <span>{certification.issuingOrganization}</span>
          {certification.expirationDate && <span>· Expires {certification.expirationDate}</span>}
        </div>
      </div>
    );
  }
  return null;
}

function ProfileCollections({
  profile,
}: {
  profile: ReturnType<typeof useCandidateProfile>['data'];
}) {
  const mutation = useCandidateProfileMutation();
  const [remove, setRemove] = useState<{ path: string; label: string } | null>(
    null,
  );
  const [editor, setEditor] = useState<{ kind: string; id?: string } | null>(
    null,
  );
  if (!profile) return null;
  const groups = [
    ['Skills', profile.skills, 'skills'],
    ['Experience', profile.experience, 'experience'],
    ['Education', profile.education, 'education'],
    ['Projects', profile.projects, 'projects'],
    ['Certifications', profile.certifications, 'certifications'],
  ] as const;
  return (
    <>
      {groups.map(([label, items, path]) => (
        <Card key={path}>
          <div className="candidate-section-heading">
            <h2>{label}</h2>
            <Badge>{items.length}</Badge>
            <Button
              variant="secondary"
              onClick={() => setEditor({ kind: path })}
            >
              Add {label.toLowerCase()}
            </Button>
          </div>
          {items.length ? (
            <ul className="candidate-collection">
              {items.map((item) => (
                <li key={item.id}>
                  <ProfileItemContent item={item} path={path} />
                  <Button
                    variant="quiet"
                    onClick={() => setEditor({ kind: path, id: item.id })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() =>
                      setRemove({
                        path: `/candidates/me/${path}/${item.id}`,
                        label,
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No {label.toLowerCase()} added.</p>
          )}
        </Card>
      ))}
      {editor && (
        <CollectionEditor
          kind={editor.kind}
          id={editor.id}
          data={
            groups
              .find((group) => group[2] === editor.kind)?.[1]
              .find((item) => item.id === editor.id) as
              Record<string, unknown> | undefined
          }
          onClose={() => setEditor(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(remove)}
        onOpenChange={(open) => !open && setRemove(null)}
        title={`Remove ${remove?.label.toLowerCase()} entry?`}
        description="This cannot be undone."
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={() => {
          if (remove) mutation.mutate({ path: remove.path, method: 'DELETE' });
          setRemove(null);
        }}
      />
    </>
  );
}

function CollectionEditor({
  kind,
  id,
  onClose,
  data,
}: {
  kind: string;
  id: string | undefined;
  onClose: () => void;
  data: Record<string, unknown> | undefined;
}) {
  const mutation = useCandidateProfileMutation();
  const [current, setCurrent] = useState(
    Boolean(data?.currentlyWorking ?? data?.currentlyStudying),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      value = (name: string) => String(f.get(name) ?? '').trim();
    let body: Record<string, unknown>;
    if (kind === 'skills')
      body = {
        name: value('name'),
        proficiency: value('proficiency'),
        yearsOfExperience: Number(value('yearsOfExperience') || 0),
      };
    else if (kind === 'experience')
      body = {
        company: value('company'),
        title: value('title'),
        startDate: value('startDate'),
        currentlyWorking: f.get('current') === 'on',
        ...(f.get('current') === 'on' ? {} : { endDate: value('endDate') }),
        employmentType: value('employmentType') || undefined,
        location: value('location') || undefined,
        description: value('description') || undefined,
        skills: value('skills')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      };
    else if (kind === 'education')
      body = {
        institution: value('institution'),
        degree: value('degree'),
        startYear: Number(value('startYear')),
        currentlyStudying: f.get('current') === 'on',
        ...(f.get('current') === 'on'
          ? {}
          : { endYear: Number(value('endYear')) || undefined }),
        fieldOfStudy: value('fieldOfStudy') || undefined,
        grade: value('grade') || undefined,
        description: value('description') || undefined,
      };
    else if (kind === 'projects')
      body = {
        title: value('title'),
        description: value('description'),
        technologies: [],
        githubUrl: value('githubUrl') || undefined,
        liveUrl: value('liveUrl') || undefined,
        startDate: value('startDate') || undefined,
        endDate: value('endDate') || undefined,
      };
    else
      body = {
        name: value('name'),
        issuingOrganization: value('issuingOrganization'),
        issueDate: value('issueDate') || undefined,
        expirationDate: value('expirationDate') || undefined,
        credentialId: value('credentialId') || undefined,
        credentialUrl: value('credentialUrl') || undefined,
      };
    mutation.mutate(
      {
        path: `/candidates/me/${kind}${id ? `/${id}` : ''}`,
        method: id ? 'PATCH' : 'POST',
        body,
      },
      { onSuccess: onClose },
    );
  };
  return (
    <Card>
      <div className="candidate-section-heading">
        <h2>
          {id ? 'Edit' : 'Add'} {kind}
        </h2>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <form className="candidate-editor" onSubmit={submit}>
        {kind === 'skills' && (
          <>
            <label htmlFor="collection-skill-name">
              Skill name
              <TextField
                id="collection-skill-name"
                name="name"
                aria-label="Skill name"
                required
                maxLength={100}
                defaultValue={String(data?.name ?? '')}
              />
            </label>
            <label htmlFor="collection-proficiency">
              Proficiency
              <Select
                id="collection-proficiency"
                name="proficiency"
                options={['beginner', 'intermediate', 'advanced', 'expert'].map(
                  (value) => ({ value, label: value }),
                )}
                defaultValue={String(data?.proficiency ?? 'intermediate')}
              />
            </label>
            <label htmlFor="collection-years">
              Years of experience
              <TextField
                id="collection-years"
                name="yearsOfExperience"
                type="number"
                min="0"
                max="60"
                defaultValue={String(data?.yearsOfExperience ?? 0)}
              />
            </label>
          </>
        )}
        {kind === 'experience' && (
          <>
            <label htmlFor="collection-company">
              Company
              <TextField
                id="collection-company"
                name="company"
                required
                maxLength={200}
                defaultValue={String(data?.company ?? '')}
              />
            </label>
            <label htmlFor="collection-role-title">
              Title
              <TextField
                id="collection-role-title"
                name="title"
                required
                maxLength={150}
                defaultValue={String(data?.title ?? '')}
              />
            </label>
            <label htmlFor="collection-start-date">
              Start date
              <TextField
                id="collection-start-date"
                name="startDate"
                type="date"
                required
                defaultValue={String(data?.startDate ?? '').slice(0, 10)}
              />
            </label>
            <label>
              <input
                name="current"
                type="checkbox"
                checked={current}
                onChange={(event) => setCurrent(event.target.checked)}
              />{' '}
              I currently work here
            </label>
            <TextField
              name="endDate"
              aria-label="Experience end date"
              type="date"
              disabled={current}
              defaultValue={String(data?.endDate ?? '').slice(0, 10)}
            />
            <Select
              name="employmentType"
              aria-label="Experience employment type"
              placeholder="Employment type"
              options={[
                'internship',
                'full-time',
                'part-time',
                'contract',
                'freelance',
              ].map((value) => ({ value, label: value }))}
            />
            <TextField
              name="location"
              aria-label="Experience location"
              maxLength={150}
            />
            <TextArea
              name="description"
              aria-label="Experience description"
              maxLength={2000}
            />
            <TextField
              name="skills"
              aria-label="Experience skills"
              placeholder="Comma separated"
            />
          </>
        )}
        {kind === 'education' && (
          <>
            <label htmlFor="collection-institution">
              Institution
              <TextField
                id="collection-institution"
                name="institution"
                required
                maxLength={200}
                defaultValue={String(data?.institution ?? '')}
              />
            </label>
            <label htmlFor="collection-degree">
              Degree
              <TextField
                id="collection-degree"
                name="degree"
                required
                maxLength={150}
                defaultValue={String(data?.degree ?? '')}
              />
            </label>
            <label htmlFor="collection-start-year">
              Start year
              <TextField
                id="collection-start-year"
                name="startYear"
                type="number"
                min="1950"
                max="2031"
                required
                defaultValue={String(data?.startYear ?? '')}
              />
            </label>
            <label>
              <input
                name="current"
                type="checkbox"
                checked={current}
                onChange={(event) => setCurrent(event.target.checked)}
              />{' '}
              I currently study here
            </label>
            <TextField
              name="endYear"
              aria-label="Education end year"
              type="number"
              min="1950"
              max="2036"
              disabled={current}
              defaultValue={String(data?.endYear ?? '')}
            />
            <TextField
              name="fieldOfStudy"
              aria-label="Field of study"
              maxLength={150}
            />
            <TextField name="grade" aria-label="Grade" maxLength={50} />
            <TextArea
              name="description"
              aria-label="Education description"
              maxLength={1000}
            />
          </>
        )}
        {kind === 'projects' && (
          <>
            <label htmlFor="collection-project-title">
              Project title
              <TextField
                id="collection-project-title"
                name="title"
                required
                maxLength={200}
                defaultValue={String(data?.title ?? '')}
              />
            </label>
            <label htmlFor="collection-project-description">
              Description
              <TextArea
                id="collection-project-description"
                name="description"
                maxLength={2000}
                defaultValue={String(data?.description ?? '')}
              />
            </label>
            <TextField
              name="githubUrl"
              aria-label="Project GitHub URL"
              type="url"
            />
            <TextField
              name="liveUrl"
              aria-label="Project live URL"
              type="url"
            />
            <TextField
              name="startDate"
              aria-label="Project start date"
              type="date"
            />
            <TextField
              name="endDate"
              aria-label="Project end date"
              type="date"
            />
          </>
        )}
        {kind === 'certifications' && (
          <>
            <label htmlFor="collection-cert-name">
              Certification name
              <TextField
                id="collection-cert-name"
                name="name"
                required
                maxLength={200}
                defaultValue={String(data?.name ?? '')}
              />
            </label>
            <label htmlFor="collection-cert-org">
              Issuing organization
              <TextField
                id="collection-cert-org"
                name="issuingOrganization"
                required
                maxLength={200}
                defaultValue={String(data?.issuingOrganization ?? '')}
              />
            </label>
            <label htmlFor="collection-cert-date">
              Issue date
              <TextField
                id="collection-cert-date"
                name="issueDate"
                type="date"
                defaultValue={String(data?.issueDate ?? '').slice(0, 10)}
              />
            </label>
            <TextField
              name="expirationDate"
              aria-label="Certification expiration date"
              type="date"
            />
            <TextField
              name="credentialId"
              aria-label="Credential identifier"
              maxLength={200}
            />
            <TextField
              name="credentialUrl"
              aria-label="Credential URL"
              type="url"
            />
          </>
        )}
        {mutation.isError && (
          <Alert tone="danger" title="Entry not saved">
            {message(mutation.error)}
          </Alert>
        )}
        <FormActions>
          <Button type="submit" loading={mutation.isPending}>
            {id ? 'Save changes' : 'Add entry'}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}

export function CandidateJobsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString() || 'page=1&limit=20';
  const q = useJobs(query);
  return (
    <div className="candidate-page">
      <PageHeader
        title="Find jobs"
        description="Search currently published opportunities."
      />
      <form
        className="candidate-search"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next = new URLSearchParams({ page: '1', limit: '20' });
          for (const key of [
            'search',
            'skills',
            'company',
            'location',
            'employmentType',
            'workMode',
            'minimumSalary',
            'maximumExperience',
            'postedWithin',
            'sort',
          ]) {
            const value = String(f.get(key) ?? '').trim();
            if (value) next.set(key, value);
          }
          setParams(next);
        }}
      >
        <TextField
          name="search"
          aria-label="Search jobs"
          placeholder="Role, skill or keyword"
          defaultValue={params.get('search') ?? ''}
        />
        <Select
          name="skills"
          aria-label="Required skill"
          placeholder="Any skill"
          defaultValue={params.get('skills') ?? ''}
          options={[
            'javascript',
            'typescript',
            'react',
            'node.js',
            'express',
            'mongodb',
            'python',
            'java',
            'c++',
            'aws',
            'docker',
            'sql',
            'css',
            'html',
            'git',
          ].map((value) => ({ value, label: value }))}
        />
        <TextField
          name="company"
          aria-label="Company identifier"
          placeholder="Company ID"
          defaultValue={params.get('company') ?? ''}
        />
        <TextField
          name="location"
          aria-label="Job location"
          placeholder="Location"
          defaultValue={params.get('location') ?? ''}
        />
        <Select
          name="employmentType"
          aria-label="Employment type"
          placeholder="Any employment type"
          defaultValue={params.get('employmentType') ?? ''}
          options={[
            'internship',
            'full-time',
            'part-time',
            'contract',
            'freelance',
          ].map((value) => ({ value, label: value }))}
        />
        <TextField
          name="minimumSalary"
          aria-label="Minimum salary"
          type="number"
          min="0"
          placeholder="Minimum salary"
          defaultValue={params.get('minimumSalary') ?? ''}
        />
        <TextField
          name="maximumExperience"
          aria-label="Maximum experience"
          type="number"
          min="0"
          max="60"
          placeholder="Maximum experience"
          defaultValue={params.get('maximumExperience') ?? ''}
        />
        <TextField
          name="postedWithin"
          aria-label="Posted within days"
          type="number"
          min="1"
          max="3650"
          placeholder="Posted within days"
          defaultValue={params.get('postedWithin') ?? ''}
        />
        <Select
          name="workMode"
          aria-label="Work mode"
          placeholder="Any work mode"
          defaultValue={params.get('workMode') ?? ''}
          options={['onsite', 'hybrid', 'remote'].map((value) => ({
            value,
            label: value,
          }))}
        />
        <Select
          name="sort"
          aria-label="Sort jobs"
          defaultValue={params.get('sort') ?? 'newest'}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'salary-high', label: 'Salary high to low' },
            { value: 'salary-low', label: 'Salary low to high' },
            { value: 'relevance', label: 'Relevance' },
            { value: 'deadline', label: 'Closing soon' },
          ]}
        />
        <Button type="submit">Search</Button>
      </form>
      {q.isPending ? (
        <LoadingState label="Loading jobs" />
      ) : q.isError ? (
        <ErrorState title="Jobs unavailable" detail={message(q.error)} />
      ) : q.data.items.length ? (
        <ul className="candidate-job-list">
          {q.data.items.map((job) => (
            <li key={job.id}>
              <div>
                <span className="candidate-eyebrow">
                  {job.workMode || job.employmentType || 'Opportunity'}
                </span>
                <h2>
                  <Link to={`/candidate/jobs/${job.id}`} style={{ color: 'var(--color-primary-strong)', textDecoration: 'underline' }}>{job.title}</Link>
                </h2>
                <p>
                  {job.companyName} · {job.location || 'Location flexible'}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
                {job.closingDate && <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Closes {date(job.closingDate)}</span>}
                <Link to={`/candidate/jobs/${job.id}`}>
                  <Button>Apply now</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No matching jobs"
          description="Try a broader search or clear your filters."
        />
      )}
      {q.data && q.data.pages > 1 && (
        <Pagination
          page={q.data.page}
          totalPages={q.data.pages}
          onPageChange={(page) => {
            const next = new URLSearchParams(params);
            next.set('page', String(page));
            setParams(next);
          }}
          ariaLabel="Job result pages"
          loading={q.isFetching}
        />
      )}
    </div>
  );
}
export function CandidateJobDetailPage() {
  const { jobId = '' } = useParams();
  const q = useJob(jobId);
  const profile = useCandidateProfile();
  const mutation = useApplicationMutation();
  const [confirm, setConfirm] = useState(false);
  const draftKey = `talvix:candidate:application:${jobId}`;
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey) ?? '{}') as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  });
  useEffect(
    () => localStorage.setItem(draftKey, JSON.stringify(draft)),
    [draft, draftKey],
  );
  if (q.isPending) return <LoadingState label="Loading job" />;
  if (q.isError)
    return <ErrorState title="Job unavailable" detail={message(q.error)} />;
  const job = q.data;
  return (
    <div className="candidate-page">
      <PageHeader
        title={job.title}
        description={`${job.companyName} · ${job.location || 'Location flexible'}`}
      />
      <div className="candidate-detail-grid">
        <Card>
          <div className="candidate-job-meta">
            <StatusTag>{job.status || 'Open'}</StatusTag>
            {job.employmentType && <span>{job.employmentType}</span>}
            {job.workMode && <span>{job.workMode}</span>}
          </div>
          <p className="candidate-copy">
            {job.description ||
              'The organization has not provided a public description.'}
          </p>
          {job.closingDate && (
            <Alert title="Closing date">
              Applications close {date(job.closingDate)}.
            </Alert>
          )}
        </Card>
        <aside>
          <Card>
            <h2>Ready to apply?</h2>
            <p>
              Keep your profile and resume current. The server makes the final
              eligibility decision.
            </p>
            {job.resumeRequired && (
              <div style={{ marginTop: '12px', marginBottom: '16px', padding: '12px', border: '1px dashed var(--color-border)', borderRadius: '6px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '8px' }}>Resume required</h3>
                {profile.isPending ? (
                  <LoadingState label="Checking profile resume..." />
                ) : profile.isError ? (
                  <p style={{ color: 'var(--color-danger)' }}>Could not check profile resume status.</p>
                ) : profile.data?.resumeDocument || profile.data?.resume?.url ? (
                  <div>
                    <p style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✓ Resume ready: <strong>{profile.data.resume?.displayName || 'resume.pdf'}</strong>
                    </p>
                    <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                      You can replace it in your <Link to="/candidate/profile" style={{ textDecoration: 'underline' }}>Profile</Link>.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: 'var(--color-warning)', marginBottom: '8px', fontSize: '0.85rem' }}>
                      A resume is required to apply for this job. Please upload one here:
                    </p>
                    <UploadControl
                      entityType="candidate-profile"
                      entityId={profile.data?.id}
                      category="resume"
                      path="/documents/me/resume"
                      onDone={() => {
                        void profile.refetch();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setConfirm(true);
              }}
            >
              <FormField
                label="Cover letter"
                hint="Optional, up to 5,000 characters"
              >
                {({ id, ...control }) => (
                  <TextArea
                    id={id}
                    {...control}
                    maxLength={5000}
                    value={draft.coverLetter ?? ''}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        coverLetter: event.target.value,
                      }))
                    }
                  />
                )}
              </FormField>
              {job.questions.map((question) => (
                <FormField
                  key={question.id}
                  label={question.question}
                  required={question.required}
                >
                  {({ id, ...control }) => (
                    <TextArea
                      id={id}
                      {...control}
                      required={question.required}
                      value={draft[question.id] ?? ''}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
              ))}
               <Button type="submit" disabled={mutation.isPending || (job.resumeRequired && !profile.isPending && !(profile.data?.resumeDocument || profile.data?.resume?.url))}>
                Apply now
              </Button>
            </form>
            {mutation.isSuccess && (
              <Alert tone="success" title="Application submitted">
                Your application is now in your workspace.
              </Alert>
            )}
            {mutation.isError && (
              <Alert tone="danger" title="Application not submitted">
                {message(mutation.error)}
              </Alert>
            )}
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit this application?"
        description="Your current candidate profile and submitted answers will be used."
        confirmLabel="Submit application"
        onConfirm={() => {
          mutation.mutate(
            {
              path: '/applications',
              body: {
                jobId: job.id,
                ...(draft.coverLetter
                  ? { coverLetter: draft.coverLetter }
                  : {}),
                answers: job.questions
                  .filter((question) => draft[question.id])
                  .map((question) => ({
                    questionId: question.id,
                    answer: draft[question.id],
                  })),
              },
            },
            { onSuccess: () => localStorage.removeItem(draftKey) },
          );
          setConfirm(false);
        }}
      />
    </div>
  );
}

export function CandidateApplicationsPage() {
  const q = useApplications();
  return (
    <div className="candidate-page">
      <PageHeader
        title="Applications"
        description="A private record of roles you have applied for."
      />
      {q.isPending ? (
        <LoadingState label="Loading applications" />
      ) : q.isError ? (
        <ErrorState
          title="Applications unavailable"
          detail={message(q.error)}
        />
      ) : q.data.items.length ? (
        <ul className="candidate-list">
          {q.data.items.map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.jobTitle || 'Application'}</strong>
                <span>
                  {a.companyName} · Applied {date(a.appliedAt)}
                </span>
              </div>
              <StatusTag>{a.status}</StatusTag>
              <Link to={`/candidate/applications/${a.id}`}>Details</Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No applications"
          description="Applications you submit will appear here."
          action={
            <Link className="candidate-button-link" to="/candidate/jobs">
              Browse jobs
            </Link>
          }
        />
      )}
    </div>
  );
}
export function CandidateApplicationDetailPage() {
  const { applicationId = '' } = useParams();
  const q = useApplication(applicationId),
    timeline = useApplicationTimeline(applicationId),
    mutation = useApplicationMutation();
  const [confirm, setConfirm] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  if (q.isPending) return <LoadingState label="Loading application" />;
  if (q.isError)
    return (
      <ErrorState title="Application unavailable" detail={message(q.error)} />
    );
  const a = q.data;
  return (
    <div className="candidate-page">
      <PageHeader
        title={a.jobTitle || 'Application detail'}
        description={a.companyName}
      />
      <div className="candidate-detail-grid">
        <Card>
          <h2>Current stage</h2>
          <StatusTag>{a.status}</StatusTag>
          <p>Submitted {date(a.appliedAt)}</p>
          <div className="candidate-inline-links">
            <Link to={`/candidate/documents/applications/${a.id}`}>
              Application documents
            </Link>
          </div>
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                path: `/applications/me/${a.id}/refresh-snapshot`,
              })
            }
          >
            Refresh submitted job snapshot
          </Button>
          {withdrawable.has(a.status) && (
            <>
              <FormField
                label="Reason for withdrawal"
                required
                hint="Shared with the organization, up to 1,000 characters."
              >
                {({ id, describedBy, invalid }) => (
                  <TextArea
                    id={id}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                    required
                    maxLength={1000}
                    value={withdrawalReason}
                    onChange={(event) =>
                      setWithdrawalReason(event.target.value)
                    }
                  />
                )}
              </FormField>
              <Button
                variant="danger"
                disabled={!withdrawalReason.trim()}
                onClick={() => setConfirm(true)}
              >
                Withdraw application
              </Button>
            </>
          )}
          {mutation.isError && (
            <Alert tone="danger" title="Action failed">
              {message(mutation.error)}
            </Alert>
          )}
        </Card>
        <Card>
          <h2>Safe timeline</h2>
          {timeline.isPending ? (
            <LoadingState label="Loading timeline" />
          ) : timeline.isError ? (
            <ErrorState
              title="Timeline unavailable"
              detail={message(timeline.error)}
            />
          ) : (
            <ol className="candidate-timeline">
              {timeline.data.map((item, i) => (
                <li key={`${item.changedAt}-${i}`}>
                  <strong>{item.to}</strong>
                  <span>{date(item.changedAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Withdraw application?"
        description="The organization will no longer consider this application. This action may not be reversible."
        confirmLabel="Withdraw"
        variant="destructive"
        onConfirm={() => {
          mutation.mutate({
            path: `/applications/me/${a.id}/withdraw`,
            body: { reason: withdrawalReason.trim() },
          });
          setConfirm(false);
        }}
      />
    </div>
  );
}

export function CandidateNotificationsPage() {
  const q = useNotifications(),
    m = useNotificationMutation(),
    navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="candidate-page">
      <PageHeader
        title="Notifications"
        description="Updates from your candidate activity, with safe Talvix destinations only."
        secondaryActions={
          <div className="candidate-inline-links">
            <Button
              variant="secondary"
              onClick={() => m.mutate({ path: '/notifications/read-all' })}
            >
              Mark all read
            </Button>
            <Button
              variant="secondary"
              disabled={m.isPending}
              onClick={() => m.mutate({ path: '/notifications/archive-all' })}
            >
              Archive all
            </Button>
            {selected.length > 0 && (
              <>
                <Button
                  variant="secondary"
                  disabled={m.isPending}
                  onClick={() =>
                    m.mutate({
                      path: '/notifications/bulk/read',
                      body: { notificationIds: selected },
                    })
                  }
                >
                  Mark selected read
                </Button>
                <Button
                  variant="secondary"
                  disabled={m.isPending}
                  onClick={() =>
                    m.mutate({
                      path: '/notifications/bulk/archive',
                      body: { notificationIds: selected },
                    })
                  }
                >
                  Archive selected
                </Button>
              </>
            )}
          </div>
        }
      />
      {q.isPending ? (
        <LoadingState label="Loading notifications" />
      ) : q.isError ? (
        <ErrorState
          title="Notifications unavailable"
          detail={message(q.error)}
        />
      ) : q.data.items.length ? (
        <ul className="candidate-notifications">
          {q.data.items.map((n) => (
            <li key={n.id} className={n.read ? '' : 'is-unread'}>
              <input
                type="checkbox"
                aria-label={`Select ${n.title}`}
                checked={selected.includes(n.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, n.id]
                      : current.filter((id) => id !== n.id),
                  )
                }
              />
              <div>
                <span className="candidate-eyebrow">
                  {n.category || n.type}
                </span>
                <h2>{n.title}</h2>
                <p>{n.message}</p>
                <small>{date(n.createdAt)}</small>
              </div>
              <div>
                <Button
                  variant="secondary"
                  onClick={() => navigate(`/candidate/notifications/${n.id}`)}
                >
                  Details
                </Button>
                {n.target && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!n.read)
                        m.mutate({ path: `/notifications/${n.id}/read` });
                      if (n.target) navigate(n.target);
                    }}
                  >
                    Open
                  </Button>
                )}
                <Button
                  variant="quiet"
                  onClick={() =>
                    m.mutate({
                      path: `/notifications/${n.id}/${n.read ? 'unread' : 'read'}`,
                    })
                  }
                >
                  Mark {n.read ? 'unread' : 'read'}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() =>
                    m.mutate({
                      path: `/notifications/${n.id}/${n.archived ? 'unarchive' : 'archive'}`,
                    })
                  }
                >
                  {n.archived ? 'Restore' : 'Archive'}
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    m.mutate({
                      path: `/notifications/${n.id}`,
                      method: 'DELETE',
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="You’re all caught up"
          description="New candidate activity will appear here."
        />
      )}
    </div>
  );
}
export function CandidateNotificationDetailPage() {
  const { notificationId = '' } = useParams();
  const q = useNotification(notificationId),
    m = useNotificationMutation(),
    navigate = useNavigate();
  if (q.isPending) return <LoadingState label="Loading notification" />;
  if (q.isError)
    return (
      <ErrorState title="Notification unavailable" detail={message(q.error)} />
    );
  const n = q.data;
  return (
    <div className="candidate-page">
      <PageHeader title={n.title} description={date(n.createdAt)} />
      <Card>
        <p>{n.message}</p>
        <div className="candidate-inline-links">
          {n.target && (
            <Button
              onClick={() => {
                if (n.target) navigate(n.target);
              }}
            >
              Open related item
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() =>
              m.mutate({
                path: `/notifications/${n.id}/${n.read ? 'unread' : 'read'}`,
              })
            }
          >
            Mark {n.read ? 'unread' : 'read'}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              m.mutate(
                { path: `/notifications/${n.id}`, method: 'DELETE' },
                { onSuccess: () => navigate('/candidate/notifications') },
              )
            }
          >
            Delete
          </Button>
        </div>
      </Card>
    </div>
  );
}
export function CandidateSettingsPage() {
  const { user, logout, completeAuth } = useAuth();
  const toast = useToast();
  const linkRef = useRef<HTMLDivElement>(null);
  const [isLinking, setIsLinking] = useState(false);

  const hasGoogle = user?.providers?.includes('GOOGLE');

  useEffect(() => {
    if (hasGoogle) return;
    let active = true;

    // Load GIS script dynamically if not present
    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGoogleLink = () => {
      if (!window.google || !active) return;

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const data = await apiRequest<{ user: any }>('/auth/link-google', {
              method: 'POST',
              body: { idToken: response.credential },
            });
            const token = tokenStore.get();
            if (token) {
              await completeAuth({ user: data.user, accessToken: token });
            }
            toast.push({
              title: 'Linked',
              message: 'Google account linked successfully.',
              tone: 'success',
            });
          } catch (err: any) {
            toast.push({
              title: 'Linking Failed',
              message: err?.message || 'Failed to link Google account.',
              tone: 'danger',
            });
          }
        },
      });

      if (linkRef.current) {
        window.google.accounts.id.renderButton(linkRef.current, {
          theme: 'outline',
          size: 'medium',
          text: 'continue_with',
        });
      }
    };

    const interval = setInterval(() => {
      if (window.google) {
        initGoogleLink();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [hasGoogle, completeAuth, toast]);

  const handleUnlink = async () => {
    setIsLinking(true);
    try {
      const data = await apiRequest<{ user: any }>('/auth/unlink-google', {
        method: 'DELETE',
      });
      const token = tokenStore.get();
      if (token) {
        await completeAuth({ user: data.user, accessToken: token });
      }
      toast.push({
        title: 'Unlinked',
        message: 'Google account unlinked successfully.',
        tone: 'success',
      });
    } catch (err: any) {
      toast.push({
        title: 'Unlinking Failed',
        message: err?.message || 'Failed to unlink Google account.',
        tone: 'danger',
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleGoogleClickPlaceholder = () => {
    if (!linkRef.current || linkRef.current.children.length === 0) {
      toast.push({
        title: 'Google Integration Required',
        message: 'Please set the VITE_GOOGLE_CLIENT_ID environment variable to enable Google authentication.',
        tone: 'warning',
        duration: 5000,
      });
    }
  };

  return (
    <div className="candidate-page">
      <PageHeader
        title="Settings"
        description="Account access, privacy and notification choices."
      />
      <Card>
        <h2>Account</h2>
        <dl>
          <dt>Name</dt>
          <dd>{user?.fullName}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
        </dl>
        <Button variant="danger" onClick={() => void logout()}>
          Sign out
        </Button>
      </Card>
      <div className="candidate-summary">
        <Card>
          <h2>Connected Accounts</h2>
          <p className="text-sm text-slate-500 mb-4">
            Connect third-party login providers to sign in to Talvix.
          </p>
          {hasGoogle ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Google connected</span>
              </div>
              <Button
                variant="secondary"
                disabled={isLinking}
                onClick={handleUnlink}
                className="mt-2 text-xs py-1"
              >
                Unlink Google Account
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-400 mb-2">Google is not connected.</span>
              <div 
                onClick={handleGoogleClickPlaceholder}
                className="relative w-full max-w-[240px] flex justify-center h-[36px] cursor-pointer"
              >
                {/* Custom visual representation */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 py-1.5 px-3 border border-slate-200 bg-white hover:bg-slate-50/50 rounded-lg font-semibold text-[11px] text-slate-700 shadow-sm pointer-events-none select-none w-full">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 0 12 0 7.31 0 3.25 2.69 1.25 6.63l3.87 3C6.06 6.88 8.81 5.04 12 5.04z"/>
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58v3l3.87 3c2.26-2.09 3.56-5.17 3.56-8.73z"/>
                    <path fill="#34A853" d="M5.12 14.37c-.24-.72-.37-1.49-.37-2.37s.13-1.65.37-2.37V6.63H1.25C.45 8.24 0 10.06 0 12s.45 3.76 1.25 5.37l3.87-3z"/>
                    <path fill="#FBBC05" d="M12 18.96c-3.19 0-5.94-1.84-6.88-4.59l-3.87 3C3.25 21.31 7.31 24 12 24c3.24 0 6.13-1.07 8.17-2.91l-3.87-3c-1.13.75-2.6 1.17-4.3 1.17z"/>
                  </svg>
                  <span>Connect Google Account</span>
                </div>
                {/* Real hidden GSI button overlay */}
                <div 
                  ref={linkRef} 
                  className="absolute inset-0 opacity-[0.01] cursor-pointer w-full [&_iframe]:w-full"
                ></div>
              </div>
            </div>
          )}
        </Card>
        <Card>
          <h2>Notifications</h2>
          <p>Manage supported delivery channels.</p>
          <Link to="/candidate/settings/notifications">
            Notification preferences
          </Link>
        </Card>
        <Card>
          <h2>Privacy</h2>
          <p>Control candidate profile discoverability.</p>
          <Link to="/candidate/settings/privacy">Privacy settings</Link>
        </Card>
        <Card>
          <h2>Security</h2>
          <p>
            Password changes, MFA and session history are not supported by the
            current API.
          </p>
          <Link to="/candidate/settings/security">View availability</Link>
        </Card>
      </div>
    </div>
  );
}
export function CandidateNotificationSettingsPage() {
  const q = useNotificationPreferences();
  const mutation = useNotificationPreferenceMutation();
  return (
    <div className="candidate-page">
      <PageHeader
        title="Notification preferences"
        description="Your server-supported notification configuration."
      />
      {q.isPending ? (
        <LoadingState label="Loading preferences" />
      ) : q.isError ? (
        <ErrorState title="Preferences unavailable" detail={message(q.error)} />
      ) : (
        <Card>
          <form
            className="candidate-editor"
            onSubmit={(event) => {
              event.preventDefault();
              const f = new FormData(event.currentTarget);
              mutation.mutate({
                global: {
                  inAppEnabled: f.get('inApp') === 'on',
                  emailEnabled: f.get('email') === 'on',
                },
                digest: {
                  enabled: f.get('digest') === 'on',
                  frequency: String(f.get('frequency')),
                  timezone: String(f.get('timezone')),
                  preferredHour: Number(f.get('hour')),
                },
                quietHours: {
                  enabled: f.get('quiet') === 'on',
                  startHour: Number(f.get('startHour')),
                  endHour: Number(f.get('endHour')),
                  timezone: String(f.get('timezone')),
                },
              });
            }}
          >
            <fieldset>
              <legend>Delivery</legend>
              <label htmlFor="preference-frequency">
                <input
                  name="inApp"
                  type="checkbox"
                  defaultChecked={q.data.inAppEnabled}
                />{' '}
                In-app notifications
              </label>
              <label>
                <input
                  name="email"
                  type="checkbox"
                  defaultChecked={q.data.emailEnabled}
                />{' '}
                Email notifications
              </label>
            </fieldset>
            <fieldset>
              <legend>Digest</legend>
              <label>
                <input
                  name="digest"
                  type="checkbox"
                  defaultChecked={q.data.digestEnabled}
                />{' '}
                Enable digest
              </label>
              <label htmlFor="preference-frequency">
                Frequency
                <Select
                  id="preference-frequency"
                  name="frequency"
                  defaultValue={q.data.digestFrequency}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ]}
                />
              </label>
              <label htmlFor="preference-hour">
                Preferred hour
                <TextField
                  id="preference-hour"
                  name="hour"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={q.data.preferredHour}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Quiet hours</legend>
              <label htmlFor="preference-start-hour">
                <input
                  name="quiet"
                  type="checkbox"
                  defaultChecked={q.data.quietHoursEnabled}
                />{' '}
                Enable quiet hours
              </label>
              <label htmlFor="preference-start-hour">
                Start hour
                <TextField
                  id="preference-start-hour"
                  name="startHour"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={q.data.quietStartHour}
                />
              </label>
              <label htmlFor="preference-end-hour">
                End hour
                <TextField
                  id="preference-end-hour"
                  name="endHour"
                  type="number"
                  min="0"
                  max="23"
                  defaultValue={q.data.quietEndHour}
                />
              </label>
              <label htmlFor="preference-timezone">
                IANA timezone
                <TextField
                  id="preference-timezone"
                  name="timezone"
                  required
                  defaultValue={q.data.timezone}
                />
              </label>
            </fieldset>
            {mutation.isError && (
              <Alert tone="danger" title="Preferences not saved">
                {message(mutation.error)}
              </Alert>
            )}
            {mutation.isSuccess && (
              <Alert tone="success" title="Preferences saved">
                Your notification choices are up to date.
              </Alert>
            )}
            <FormActions>
              <Button type="submit" loading={mutation.isPending}>
                Save preferences
              </Button>
            </FormActions>
          </form>
        </Card>
      )}
    </div>
  );
}
export function CandidatePrivacySettingsPage() {
  return (
    <div className="candidate-page">
      <PageHeader
        title="Privacy"
        description="Understand and control profile discoverability."
      />
      <Card>
        <h2>Candidate profile visibility</h2>
        <p>
          Public means discoverable only to authenticated Talvix recruiters and
          administrators. Recruiters-only limits discovery to authenticated
          recruiters. Private removes your profile from discovery. Per-section
          privacy is unavailable.
        </p>
        <Link className="candidate-button-link" to="/candidate/profile">
          Manage visibility
        </Link>
      </Card>
    </div>
  );
}
export function CandidateSecurityUnavailablePage() {
  return (
    <div className="candidate-page">
      <PageHeader
        title="Security"
        description="Account security capabilities."
      />
      <EmptyState
        title="Security controls are not available yet"
        description="The backend does not currently support password change, MFA, device sessions, login history, email change or account deletion. Contact support if you need help securing your account."
      />
    </div>
  );
}
