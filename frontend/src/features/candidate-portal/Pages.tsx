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
  useCandidateProfileAccessLogs,
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
  Wrench,
  GraduationCap,
  FolderGit2,
  Eye,
  ShieldCheck,
  Building2,
  Download,
  UserCheck,
  Clock,
  Plus,
  Trash2,
  ExternalLink,
  MessageSquare,
  MoreHorizontal,
  Info,
  CheckCircle2,
  MapPin,
  Code,
  ArrowRight,
  LogOut,
  Link2,
  Search,
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
    <div className="candidate-page animated-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageHeader
        title="Candidate workspace"
        description="Keep your search moving, one clear next step at a time."
      />
      
      {/* Premium Hero Next Best Action (Mindease Theme) */}
      <section className="profile-header-banner delay-1 animated-entrance" aria-label="Next best action">
        <div className="profile-banner-left">
          <div className="profile-info-stack">
            <div className="profile-name-heading-row">
              <span className="status-badge-available" style={{ background: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe' }}>
                <Sparkles size={14} className="hero-badge-icon" />
                NEXT BEST ACTION
              </span>
            </div>

            <h2 className="profile-candidate-name" style={{ fontSize: '22px' }}>
              {nextAction?.label ??
                (!profile.data?.headline
                  ? 'Complete your candidate headline'
                  : 'No urgent deadline')}
            </h2>
            <p className="profile-headline-line">
              {nextAction?.detail ??
                (!profile.data?.headline
                  ? 'Help recruiters understand the work you want to do.'
                  : 'You have no assessment, interview, or offer response due right now.')}
            </p>
          </div>
        </div>

        <Link
          className="btn-pill-dark"
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

      {/* Top 3 Column Cards Summary (Mindease Theme) */}
      <div className="profile-sections-grid-3col delay-2 animated-entrance">
        <div className="section-card-mindease">
          <div className="section-card-header">
            <div className="section-card-header-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
              <User size={20} />
            </div>
            <div>
              <h3 className="section-card-header-title">Profile</h3>
              <span className="section-card-header-subtext">Discoverability status</span>
            </div>
          </div>
          <div className="card-body">
            {profile.isPending ? (
              <LoadingState label="Loading profile" />
            ) : profile.isError ? (
              <ErrorState title="Profile unavailable" detail={message(profile.error)} />
            ) : (
              <div className="profile-summary-text" style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{profile.data?.headline || 'Headline needed'}</strong>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Visibility: {profile.data?.profileVisibility}
                </span>
              </div>
            )}
            <Link className="btn-pill-dark" to="/candidate/profile" style={{ width: 'fit-content', marginTop: 'auto' }}>
              Edit profile →
            </Link>
          </div>
        </div>

        <div className="section-card-mindease">
          <div className="section-card-header">
            <div className="section-card-header-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 className="section-card-header-title">Applications</h3>
              <span className="section-card-header-subtext">Active applications</span>
            </div>
          </div>
          <div className="card-body">
            {apps.isPending ? (
              <LoadingState label="Loading applications" />
            ) : apps.isError ? (
              <ErrorState title="Applications unavailable" detail={message(apps.error)} />
            ) : (
              <div className="apps-summary-text" style={{ marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{apps.data?.total || 0}</span>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Applications in workspace</span>
              </div>
            )}
            <Link className="btn-pill-dark" to="/candidate/applications" style={{ width: 'fit-content', marginTop: 'auto' }}>
              View all →
            </Link>
          </div>
        </div>

        <div className="section-card-mindease">
          <div className="section-card-header">
            <div className="section-card-header-icon" style={{ background: '#f3e8ff', color: '#6b21a8' }}>
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="section-card-header-title">Quick Links</h3>
              <span className="section-card-header-subtext">Recruiting workspaces</span>
            </div>
          </div>
          <div className="card-body">
            <p className="section-card-header-subtext" style={{ marginBottom: '12px' }}>Access your dedicated recruiting tools instantly.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: 'auto' }}>
              <Link className="btn-pill-light" to="/candidate/assessments">Assessments</Link>
              <Link className="btn-pill-light" to="/candidate/interviews">Interviews</Link>
              <Link className="btn-pill-light" to="/candidate/offers">Offers</Link>
            </div>
          </div>
        </div>
      </div>

      {/* Deadlines and Activity Pastel Cards Row (Matching Profile Metric Theme) */}
      <section className="pastel-metrics-grid delay-3 animated-entrance" aria-labelledby="candidate-deadlines-title">
        <Link to="/candidate/assessments" className="pastel-card pastel-card-yellow" style={{ textDecoration: 'none' }}>
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <ClipboardCheck size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Assessments</span>
              <span className="pastel-card-count">
                {assessments.isPending ? '...' : assessments.error ? '0' : (assessments.data?.length ?? 0)}
              </span>
              <span className="pastel-card-subtext">Pending assessments</span>
            </div>
          </div>
          <div className="pastel-card-arrow-btn">
            <ArrowRight size={18} />
          </div>
        </Link>

        <Link to="/candidate/interviews" className="pastel-card pastel-card-blue" style={{ textDecoration: 'none' }}>
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <Calendar size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Interviews</span>
              <span className="pastel-card-count">
                {interviews.isPending ? '...' : interviews.error ? '0' : (interviews.data?.length ?? 0)}
              </span>
              <span className="pastel-card-subtext">Scheduled interviews</span>
            </div>
          </div>
          <div className="pastel-card-arrow-btn">
            <ArrowRight size={18} />
          </div>
        </Link>

        <Link to="/candidate/offers" className="pastel-card pastel-card-purple" style={{ textDecoration: 'none' }}>
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <Award size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Offers</span>
              <span className="pastel-card-count">
                {offers.isPending ? '...' : offers.error ? '0' : (offers.data?.length ?? 0)}
              </span>
              <span className="pastel-card-subtext">Received offers</span>
            </div>
          </div>
          <div className="pastel-card-arrow-btn">
            <ArrowRight size={18} />
          </div>
        </Link>

        <Link to="/candidate/notifications" className="pastel-card pastel-card-green" style={{ textDecoration: 'none' }}>
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <Bell size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Unread updates</span>
              <span className="pastel-card-count">
                {notifications.isPending ? '...' : notifications.error ? '0' : (notifications.data?.total ?? 0)}
              </span>
              <span className="pastel-card-subtext">Unread notifications</span>
            </div>
          </div>
          <div className="pastel-card-arrow-btn">
            <ArrowRight size={18} />
          </div>
        </Link>
      </section>

      {/* Recent Applications Section Card */}
      <section className="section-card-mindease delay-4 animated-entrance">
        <div className="section-card-header">
          <div className="section-card-header-icon" style={{ background: '#f1f5f9', color: '#0f172a' }}>
            <FileText size={20} />
          </div>
          <div>
            <h2 className="section-card-header-title">Recent applications</h2>
            <p className="section-card-header-subtext">Track your latest job applications</p>
          </div>
        </div>

        {apps.data?.items.length ? (
          <div className="applications-table-wrapper" style={{ border: '1px solid #f1f5f9', borderRadius: '14px', overflow: 'hidden' }}>
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
                <Link className="btn-pill-dark" to="/candidate/jobs" style={{ textDecoration: 'none' }}>
                  Browse jobs
                </Link>
              }
            />
          )
        )}
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
}export function CandidateProfilePage() {
  const { user } = useAuth();
  const q = useCandidateProfile(),
    mutation = useCandidateProfileMutation();
  const photo = useCandidateProfilePhoto();
  const accessLogsQuery = useCandidateProfileAccessLogs('page=1&limit=1');
  const [confirm, setConfirm] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [validationError, setValidationError] = useState('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'personal' | 'experience' | 'skills' | 'documents' | 'security'
  >('overview');

  if (q.isPending) return <LoadingState label="Loading profile" />;
  if (q.isError)
    return <ErrorState title="Profile unavailable" detail={message(q.error)} />;
  const p = q.data;

  const totalAccessEvents = accessLogsQuery.data?.pagination?.total ?? 0;

  // Calculate profile completion metrics
  const completedSections = [
    Boolean(p.headline),
    Boolean(p.bio),
    Boolean(p.location?.city || p.location?.country),
    Boolean(p.phone),
    Boolean(photo.data?.url),
    p.skills.length > 0,
    p.experience.length > 0,
    p.education.length > 0,
    p.projects.length > 0,
    Boolean(p.socialLinks?.github || p.socialLinks?.linkedin || p.socialLinks?.portfolio),
    Boolean(p.dateOfBirth),
    Boolean(p.availability),
    p.preferredJobTypes.length > 0,
  ].filter(Boolean).length;

  const totalSections = 13;
  const completionPercentage = Math.round((completedSections / totalSections) * 100);
  const strokeDashoffset = 175.93 - (175.93 * completionPercentage) / 100;

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

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError('');
    const f = new FormData(e.currentTarget);
    const getVal = (name: string) => {
      const v = f.get(name);
      return v !== null && v !== undefined ? String(v).trim() : '';
    };

    const phoneVal = getVal('phone');
    if (phoneVal) {
      if (!/^\+91\d{10}$/.test(phoneVal)) {
        setValidationError('Phone number must start with +91 followed by exactly 10 digits.');
        return;
      }
    }

    const headlineVal = getVal('headline');
    if (headlineVal.length > 150) {
      setValidationError('Professional headline must not exceed 150 characters.');
      return;
    }

    const bioVal = getVal('bio');
    if (bioVal.length > 3000) {
      setValidationError('Bio must not exceed 3000 characters.');
      return;
    }

    const dobVal = getVal('dateOfBirth');
    if (dobVal) {
      const dob = new Date(dobVal);
      const today = new Date();
      if (Number.isNaN(dob.getTime())) {
        setValidationError('Invalid date of birth format.');
        return;
      }
      if (dob > today) {
        setValidationError('Date of birth cannot be in the future.');
        return;
      }
      const hundredYearsAgo = new Date();
      hundredYearsAgo.setFullYear(today.getFullYear() - 100);
      if (dob < hundredYearsAgo) {
        setValidationError('Date of birth cannot be more than 100 years ago.');
        return;
      }
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
      if (dob > eighteenYearsAgo) {
        setValidationError('You must be at least 18 years old to use Talvix.');
        return;
      }
    }

    const availabilityVal = getVal('availability');
    const noticePeriodDaysVal = getVal('noticePeriodDays');
    if (availabilityVal === 'notice-period') {
      const days = Number(noticePeriodDaysVal);
      if (!noticePeriodDaysVal || Number.isNaN(days) || days < 0) {
        setValidationError('Notice period days is required and must be a positive number.');
        return;
      }
    }

    const minSalaryVal = getVal('salaryMinimum');
    const maxSalaryVal = getVal('salaryMaximum');
    if (minSalaryVal || maxSalaryVal) {
      if (!minSalaryVal || !maxSalaryVal) {
        setValidationError('Both minimum and maximum expected salary must be specified.');
        return;
      }
      const min = Number(minSalaryVal);
      const max = Number(maxSalaryVal);
      if (Number.isNaN(min) || min < 0) {
        setValidationError('Minimum salary must be a positive number.');
        return;
      }
      if (Number.isNaN(max) || max < 0) {
        setValidationError('Maximum salary must be a positive number.');
        return;
      }
      if (min > max) {
        setValidationError('Minimum salary cannot exceed maximum salary.');
        return;
      }
    }

    const visibility = getVal('profileVisibility') || p.profileVisibility;
    const body = {
      headline: headlineVal,
      bio: bioVal,
      phone: phoneVal || undefined,
      location: {
        city: getVal('city'),
        state: getVal('state'),
        country: getVal('country'),
      },
      dateOfBirth: getVal('dateOfBirth') || undefined,
      gender: getVal('gender') || undefined,
      socialLinks: {
        github: getVal('github') || undefined,
        linkedin: getVal('linkedin') || undefined,
        portfolio: getVal('portfolio') || undefined,
      },
      preferredRoles: getVal('preferredRoles')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      preferredLocations: getVal('preferredLocations')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      preferredJobTypes: getVal('preferredJobTypes')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      ...(minSalaryVal && maxSalaryVal
        ? {
            expectedSalary: {
              minimum: Number(minSalaryVal),
              maximum: Number(maxSalaryVal),
              currency: (getVal('salaryCurrency') || 'INR').toUpperCase(),
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

  const displayName = user?.fullName || 'Geo George';
  const headline = p.headline || 'Full-Stack Developer | IoT Developer | Open Source Coordinator | AI & Cloud';
  const locationString = p.location?.city
    ? `${p.location.city}${p.location.state ? `, ${p.location.state}` : ''}${p.location.country ? `, ${p.location.country}` : ''}`
    : 'Kanjirappally, Kerala, India';
  const educationString = p.education.length > 0
    ? `${p.education[0].degree} • ${p.education[0].institution}`
    : 'MCA (Integrated) • 2022 - 2027';

  return (
    <div className="candidate-page animated-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Main Profile Header Banner (Matching Mockup) */}
      <section className="profile-header-banner">
        <div className="profile-banner-left">
          <div className="profile-avatar-container">
            {photo.data?.url ? (
              <img
                src={photo.data.url}
                alt={displayName}
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-fallback">
                {displayName[0]?.toUpperCase() || 'G'}
              </div>
            )}
            <div className="profile-live-status-dot" title="Available for opportunities" />
          </div>

          <div className="profile-info-stack">
            <div className="profile-name-heading-row">
              <h1 className="profile-candidate-name">{displayName}</h1>
              <span className="status-badge-available">
                <span className="status-dot" />
                Available ✓
              </span>
            </div>

            <p className="profile-headline-line">{headline}</p>

            <div className="profile-meta-subline">
              <span className="profile-meta-item">
                <MapPin size={14} />
                {locationString}
              </span>
              <span>•</span>
              <span className="profile-meta-item">
                <GraduationCap size={14} />
                {educationString}
              </span>
            </div>

            <div className="profile-header-actions">
              <a className="btn-pill-dark" href="#resume">
                <Download size={15} />
                <span>Download Resume</span>
              </a>
              {p.socialLinks.portfolio ? (
                <a className="btn-pill-dark" href={p.socialLinks.portfolio} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={15} />
                  <span>View Portfolio</span>
                </a>
              ) : (
                <button type="button" className="btn-pill-dark" onClick={() => setActiveTab('personal')}>
                  <ExternalLink size={15} />
                  <span>View Portfolio</span>
                </button>
              )}
              <button type="button" className="btn-pill-light">
                <MessageSquare size={15} />
                <span>Message</span>
              </button>
              <button type="button" className="btn-pill-icon-only" aria-label="More actions">
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Profile Completion Ring Card */}
        <div className="profile-banner-right">
          <div className="completion-ring-box">
            <svg width="72" height="72" viewBox="0 0 64 64">
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="5"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#10b981"
                strokeWidth="5"
                strokeDasharray="175.93"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 32 32)"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }}
              />
            </svg>
            <span className="completion-number-text">{completionPercentage}%</span>
          </div>

          <div className="completion-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="completion-title">
                {completionPercentage >= 80 ? 'Great progress!' : 'Keep going!'}
              </span>
              <Info size={14} color="#94a3b8" />
            </div>
            <p className="completion-subtext">
              Complete your profile to get more interview opportunities and better matches.
            </p>
            <div className="completion-progress-bar-bg">
              <div
                className="completion-progress-bar-fill"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <span className="completion-sections-label">
              {completedSections} of {totalSections} sections completed
            </span>
          </div>
        </div>
      </section>

      {/* 4-Column Pastel Metric Cards Row (Matching Mockup) */}
      <section className="pastel-metrics-grid delay-1 animated-entrance">
        <div
          className="pastel-card pastel-card-yellow"
          onClick={() => setActiveTab('skills')}
          role="button"
          tabIndex={0}
        >
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <Code size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Skills</span>
              <span className="pastel-card-count">{p.skills.length}</span>
              <span className="pastel-card-subtext">Skills added</span>
            </div>
          </div>
          <button className="pastel-card-arrow-btn" aria-label="View skills">
            <ArrowRight size={18} />
          </button>
        </div>

        <div
          className="pastel-card pastel-card-blue"
          onClick={() => setActiveTab('experience')}
          role="button"
          tabIndex={0}
        >
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <Briefcase size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Work Experience</span>
              <span className="pastel-card-count">{p.experience.length}</span>
              <span className="pastel-card-subtext">Experience entries</span>
            </div>
          </div>
          <button className="pastel-card-arrow-btn" aria-label="View work experience">
            <ArrowRight size={18} />
          </button>
        </div>

        <div
          className="pastel-card pastel-card-purple"
          onClick={() => setActiveTab('experience')}
          role="button"
          tabIndex={0}
        >
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <GraduationCap size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Education</span>
              <span className="pastel-card-count">{p.education.length}</span>
              <span className="pastel-card-subtext">Education entries</span>
            </div>
          </div>
          <button className="pastel-card-arrow-btn" aria-label="View education">
            <ArrowRight size={18} />
          </button>
        </div>

        <div
          className="pastel-card pastel-card-green"
          onClick={() => setActiveTab('security')}
          role="button"
          tabIndex={0}
        >
          <div className="pastel-card-content">
            <div className="pastel-card-icon-box">
              <ShieldCheck size={22} />
            </div>
            <div className="pastel-card-text">
              <span className="pastel-card-title">Profile Access</span>
              <span className="pastel-card-count">{totalAccessEvents}</span>
              <span className="pastel-card-subtext">Audit events & log records</span>
            </div>
          </div>
          <button className="pastel-card-arrow-btn" aria-label="View profile access">
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Tabbed Navigation Bar (Matching Mockup) */}
      <nav className="profile-tab-bar-container delay-2 animated-entrance" aria-label="Profile section tabs">
        <button
          className={`profile-tab-pill ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`profile-tab-pill ${activeTab === 'personal' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          Personal Info
        </button>
        <button
          className={`profile-tab-pill ${activeTab === 'experience' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('experience')}
        >
          Work & Education
        </button>
        <button
          className={`profile-tab-pill ${activeTab === 'skills' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          Skills & Portfolio
        </button>
        <button
          className={`profile-tab-pill ${activeTab === 'documents' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
        <button
          className={`profile-tab-pill ${activeTab === 'security' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Access Security
        </button>
      </nav>

      {/* Overview Tab Content (Exact 2-Column/3-Column Layout from Mockup) */}
      {activeTab === 'overview' && (
        <>
          <form id="profile-form-overview" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="delay-3 animated-entrance">
            
            {/* Row 1: Personal Summary & Contact & Demographics */}
            <div className="profile-sections-grid-2col">
              
              {/* Personal Summary Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Personal Summary</h3>
                    <p className="section-card-header-subtext">Professional introduction about yourself</p>
                  </div>
                </div>

                <div>
                  <FormField label="Professional headline">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        name="headline"
                        defaultValue={p.headline}
                        placeholder="e.g. Production-ready candidate profile with professional summary..."
                      />
                    )}
                  </FormField>

                  <div style={{ marginTop: '12px' }}>
                    <FormField label="About you">
                      {({ id, ...control }) => (
                        <TextArea
                          id={id}
                          {...control}
                          name="bio"
                          defaultValue={p.bio}
                          placeholder="Production-ready candidate profile with professional summary, skills, and background..."
                          rows={4}
                        />
                      )}
                    </FormField>
                    <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                      {(p.bio || '').length}/500
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact & Demographics Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Contact & Demographics</h3>
                    <p className="section-card-header-subtext">Basic contact details and personal information</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <FormField label="Phone Number">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        name="phone"
                        defaultValue={p.phone}
                        placeholder="+919876543210"
                      />
                    )}
                  </FormField>

                  <FormField label="Email Address">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        readOnly
                        disabled
                        value={user?.email || 'geo@example.com'}
                      />
                    )}
                  </FormField>

                  <FormField label="Location">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        name="city"
                        defaultValue={p.location?.city || 'Kanjirappally, Kerala'}
                      />
                    )}
                  </FormField>

                  <FormField label="Date of Birth">
                    {({ id, ...control }) => (
                      <TextField
                        id={id}
                        {...control}
                        name="dateOfBirth"
                        type="date"
                        defaultValue={p.dateOfBirth}
                      />
                    )}
                  </FormField>
                </div>
              </div>
            </div>

            {/* Row 2: Visibility Settings, Work Experience & Education, Skills & Portfolio */}
            <div className="profile-sections-grid-3col">
              
              {/* Visibility Settings Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <Eye size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Visibility Settings</h3>
                    <p className="section-card-header-subtext">Control your profile visibility and data sharing</p>
                  </div>
                </div>

                <FormField label="Profile Visibility">
                  {({ id, ...control }) => (
                    <Select
                      id={id}
                      {...control}
                      name="profileVisibility"
                      defaultValue={p.profileVisibility}
                      options={[
                        { value: 'recruiters-only', label: 'Recruiters Only' },
                        { value: 'public', label: 'Public within Talvix' },
                        { value: 'private', label: 'Private' },
                      ]}
                    />
                  )}
                </FormField>

                <div className="mindease-toggle-wrapper">
                  <div>
                    <strong style={{ display: 'block', fontSize: '13px', color: '#0f172a' }}>Allow recruiters to contact me</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>You'll be notified when someone reaches out.</span>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle-switch-input"
                    defaultChecked
                    aria-label="Allow recruiters to contact me"
                  />
                </div>
              </div>

              {/* Work Experience & Education Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Work Experience & Education</h3>
                    <p className="section-card-header-subtext">Add your professional experience and academic details</p>
                  </div>
                </div>

                <div className="mindease-list-group">
                  <div className="mindease-list-row" onClick={() => setActiveTab('experience')}>
                    <div className="mindease-row-left">
                      <Briefcase size={18} className="mindease-row-icon" />
                      <div>
                        <span className="mindease-row-title" style={{ display: 'block' }}>Work Experience</span>
                        <span className="mindease-row-detail">{p.experience.length} entries • Latest at Talvix</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>

                  <div className="mindease-list-row" onClick={() => setActiveTab('experience')}>
                    <div className="mindease-row-left">
                      <GraduationCap size={18} className="mindease-row-icon" />
                      <div>
                        <span className="mindease-row-title" style={{ display: 'block' }}>Education</span>
                        <span className="mindease-row-detail">{p.education.length} entries • Add your degree details</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>
                </div>
              </div>

              {/* Skills & Portfolio Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <Code size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Skills & Portfolio</h3>
                    <p className="section-card-header-subtext">Showcase your skills and projects</p>
                  </div>
                </div>

                <div className="mindease-list-group">
                  <div className="mindease-list-row" onClick={() => setActiveTab('skills')}>
                    <div className="mindease-row-left">
                      <Code size={18} className="mindease-row-icon" />
                      <div>
                        <span className="mindease-row-title" style={{ display: 'block' }}>Skills</span>
                        <span className="mindease-row-detail">{p.skills.length} skills added</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>

                  <div className="mindease-list-row" onClick={() => setActiveTab('skills')}>
                    <div className="mindease-row-left">
                      <FolderGit2 size={18} className="mindease-row-icon" />
                      <div>
                        <span className="mindease-row-title" style={{ display: 'block' }}>Portfolio Projects</span>
                        <span className="mindease-row-detail">{p.projects.length} projects • Add links to your projects</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>
                </div>
              </div>

            </div>

            {/* Row 3: Access & Security & Resume Upload Dropzone */}
            <div className="profile-sections-grid-2col" id="resume">
              
              {/* Access & Security Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Access & Security</h3>
                    <p className="section-card-header-subtext">Manage your account security and access</p>
                  </div>
                </div>

                <div className="mindease-list-group">
                  <div className="mindease-list-row" onClick={() => setActiveTab('security')}>
                    <div>
                      <span className="mindease-row-title" style={{ display: 'block' }}>Password</span>
                      <span className="mindease-row-detail">Last updated 2 months ago</span>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>

                  <div className="mindease-list-row" onClick={() => setActiveTab('security')}>
                    <div>
                      <span className="mindease-row-title" style={{ display: 'block' }}>Connected Accounts</span>
                      <span className="mindease-row-detail">Google, GitHub</span>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>

                  <div className="mindease-list-row" onClick={() => setActiveTab('security')}>
                    <div>
                      <span className="mindease-row-title" style={{ display: 'block' }}>Two-Factor Authentication</span>
                      <span className="mindease-row-detail">Not enabled</span>
                    </div>
                    <ChevronRight size={18} className="mindease-row-arrow" />
                  </div>
                </div>
              </div>

              {/* Resume Upload Card */}
              <div className="section-card-mindease">
                <div className="section-card-header">
                  <div className="section-card-header-icon">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="section-card-header-title">Resume</h3>
                    <p className="section-card-header-subtext">Upload your latest resume (PDF, DOC, DOCX)</p>
                  </div>
                </div>

                <div className="mindease-dropzone">
                  <div className="mindease-dropzone-icon">
                    <Download size={24} />
                  </div>
                  <span className="mindease-dropzone-text">Drag & drop your resume here or</span>
                  
                  <UploadControl
                    entityType="candidate-profile"
                    entityId={p.id}
                    category="resume"
                    path="/documents/me/resume"
                    onDone={() => q.refetch()}
                  />

                  <span className="mindease-dropzone-subtext">PDF, DOC, DOCX • Max 10MB</span>
                </div>
              </div>

            </div>

            {(validationError || mutation.isError) && (
              <Alert tone="danger" title="Profile was not saved">
                {validationError || message(mutation.error)}
              </Alert>
            )}

              <div className="profile-floating-save-bar">
              <div className="save-bar-info">
                <CheckCircle2 size={18} color="#10b981" />
                <span>Review and save your updated candidate profile details</span>
              </div>
              <Button type="submit" loading={mutation.isPending}>
                Save profile
              </Button>
            </div>
          </form>

          <ProfileCollections profile={p} />
        </>
      )}

      {/* Tab: Personal Info */}
      {activeTab === 'personal' && (
        <div className="section-card-mindease delay-3 animated-entrance">
          <div className="section-card-header">
            <div className="section-card-header-icon">
              <User size={20} />
            </div>
            <div>
              <h3 className="section-card-header-title">Personal Info & Social Links</h3>
              <p className="section-card-header-subtext">Update your professional headline, bio, location, and social links</p>
            </div>
          </div>

          <form id="profile-form-personal" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormField label="Professional headline">
              {({ id, ...control }) => (
                <TextField id={id} {...control} name="headline" defaultValue={p.headline} />
              )}
            </FormField>

            <FormField label="About you">
              {({ id, ...control }) => (
                <TextArea id={id} {...control} name="bio" defaultValue={p.bio} rows={4} />
              )}
            </FormField>

            <div className="candidate-form-grid">
              <FormField label="Phone number">
                {({ id, ...control }) => (
                  <TextField id={id} {...control} name="phone" defaultValue={p.phone} />
                )}
              </FormField>
              <FormField label="City">
                {({ id, ...control }) => (
                  <TextField id={id} {...control} name="city" defaultValue={p.location?.city} />
                )}
              </FormField>

              <FormField label="State">
                {({ id, ...control }) => (
                  <TextField id={id} {...control} name="state" defaultValue={p.location?.state} />
                )}
              </FormField>

              <FormField label="Country">
                {({ id, ...control }) => (
                  <TextField id={id} {...control} name="country" defaultValue={p.location?.country} />
                )}
              </FormField>
            </div>

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

            {(validationError || mutation.isError) && (
              <Alert tone="danger" title="Profile was not saved">
                {validationError || message(mutation.error)}
              </Alert>
            )}

            <FormActions>
              <Button type="submit" loading={mutation.isPending}>
                Save Personal Info
              </Button>
            </FormActions>
          </form>
        </div>
      )}

      {/* Tab: Work & Education / Skills */}
      {(activeTab === 'experience' || activeTab === 'skills') && (
        <div className="delay-3 animated-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <ProfileCollections profile={p} />
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div className="profile-sections-grid-2col delay-3 animated-entrance">
          <div className="section-card-mindease">
            <div className="section-card-header">
              <div className="section-card-header-icon">
                <User size={20} />
              </div>
              <div>
                <h3 className="section-card-header-title">Profile Photo</h3>
                <p className="section-card-header-subtext">Upload or replace your official profile photo</p>
              </div>
            </div>

            {photo.data?.url ? (
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
                <img
                  src={photo.data.url}
                  alt="Profile"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <strong style={{ display: 'block', fontSize: '14px', color: '#0f172a' }}>{photo.data.displayName}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Status: {photo.data.status}</span>
                </div>
              </div>
            ) : null}

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

          <div className="section-card-mindease">
            <div className="section-card-header">
              <div className="section-card-header-icon">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="section-card-header-title">Resume Document</h3>
                <p className="section-card-header-subtext">Upload your official resume for candidate applications</p>
              </div>
            </div>

            <UploadControl
              entityType="candidate-profile"
              entityId={p.id}
              category="resume"
              path="/documents/me/resume"
              onDone={() => q.refetch()}
            />
          </div>
        </div>
      )}

      {/* Tab: Access Security */}
      {activeTab === 'security' && (
        <div className="delay-3 animated-entrance" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <CandidateProfileAccessSection />
        </div>
      )}

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

function CandidateProfileAccessSection() {
  const [page, setPage] = useState(1);
  const query = useCandidateProfileAccessLogs(`page=${page}&limit=5`);

  if (query.isPending) return <LoadingState label="Loading profile access logs" />;
  if (query.isError) return null;

  const logs = query.data?.logs || [];
  const pagination = query.data?.pagination;

  return (
    <div className="tvx-card tvx-card--bordered" style={{ padding: '24px', background: 'var(--color-surface-1)', borderRadius: '12px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', background: 'var(--color-info-bg)', color: 'var(--color-info-fg)', display: 'flex' }}>
            <Eye size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--color-text-strong)' }}>Profile Access Audit Log</h3>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Transparent log of recruiters and company team members who viewed or downloaded your profile documents.</span>
          </div>
        </div>
        <Badge variant="accent">{pagination?.total ?? 0} Events</Badge>
      </div>

      {logs.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
            <table className="candidate-access-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-default)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Recruiter / Member</th>
                  <th style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Company</th>
                  <th style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Associated Job</th>
                  <th style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Action</th>
                  <th style={{ padding: '10px 12px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '500' }}>
                      {log.recruiter?.fullName || 'Recruiter'}
                      {log.recruiter?.email && <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-muted)' }}>{log.recruiter.email}</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{log.company?.name || 'Company'}</td>
                    <td style={{ padding: '10px 12px' }}>{log.job?.title || 'Direct Search'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <StatusTag tone={log.accessType === 'download' ? 'info' : 'neutral'}>
                        {log.accessType === 'download' ? 'Resume Downloaded' : 'Profile Viewed'}
                      </StatusTag>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && pagination.pages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={pagination.pages}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState
          title="No access logs yet"
          description="When recruiters discover your profile or download your resume, audit entries will be securely logged here."
        />
      )}
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
    { label: 'Skills', items: profile.skills, path: 'skills', icon: <Wrench size={18} /> },
    { label: 'Experience', items: profile.experience, path: 'experience', icon: <Briefcase size={18} /> },
    { label: 'Education', items: profile.education, path: 'education', icon: <GraduationCap size={18} /> },
    { label: 'Projects', items: profile.projects, path: 'projects', icon: <FolderGit2 size={18} /> },
    { label: 'Certifications', items: profile.certifications, path: 'certifications', icon: <Award size={18} /> },
  ] as const;

  return (
    <>
      {groups.map(({ label, items, path, icon }) => (
        <div key={path} className="collection-card-mindease">
          <div className="collection-card-header">
            <div className="collection-header-left">
              <div className="collection-icon-badge">
                {icon}
              </div>
              <h2 className="collection-title">{label}</h2>
              <span className="collection-count-badge">{items.length}</span>
            </div>
            <button
              type="button"
              className="btn-pill-dark"
              onClick={() => setEditor({ kind: path })}
            >
              <Plus size={15} />
              <span>Add {label.toLowerCase()}</span>
            </button>
          </div>

          {items.length ? (
            <ul className="candidate-collection" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
              {items.map((item) => (
                <li key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <ProfileItemContent item={item} path={path} />
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>No {label.toLowerCase()} added yet.</p>
          )}

          {editor && editor.kind === path && (
            <div style={{ marginTop: '16px' }}>
              <CollectionEditor
                kind={editor.kind}
                id={editor.id}
                data={
                  groups
                    .find((group) => group.path === editor.kind)?.items
                    .find((item) => item.id === editor.id) as
                    Record<string, unknown> | undefined
                }
                onClose={() => setEditor(null)}
              />
            </div>
          )}
        </div>
      ))}
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
  const predefinedSkills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'Go', 'HTML', 'CSS', 'SQL', 'MongoDB', 'AWS', 'Docker', 'Kubernetes', 'Git'];
  const isOtherSkill = data?.name && !predefinedSkills.includes(String(data.name));

  const [skillSelect, setSkillSelect] = useState(
    isOtherSkill ? 'other' : String(data?.name ?? predefinedSkills[0])
  );
  const [customSkill, setCustomSkill] = useState(
    isOtherSkill ? String(data.name) : ''
  );

  const mutation = useCandidateProfileMutation();
  const [current, setCurrent] = useState(
    Boolean(data?.currentlyWorking ?? data?.currentlyStudying),
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget),
      value = (name: string) => String(f.get(name) ?? '').trim();
    let body: Record<string, unknown>;
    if (kind === 'skills') {
      body = {
        name: value('name'),
        proficiency: value('proficiency'),
        yearsOfExperience: Number(value('yearsOfExperience') || 0),
      };
    }
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
            <FormField label="Skill name">
              {({ id }) => (
                <>
                  <TextField
                    id={id}
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={String(data?.name ?? '')}
                    placeholder="e.g. React, TypeScript, Research"
                    list="predefined-skills-list"
                  />
                  <datalist id="predefined-skills-list">
                    {predefinedSkills.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
            <FormField label="Proficiency">
              {({ id }) => (
                <Select
                  id={id}
                  name="proficiency"
                  options={['beginner', 'intermediate', 'advanced', 'expert'].map(
                    (value) => ({ value, label: value }),
                  )}
                  defaultValue={String(data?.proficiency ?? 'intermediate')}
                />
              )}
            </FormField>
            <FormField label="Years of experience">
              {({ id }) => (
                <TextField
                  id={id}
                  name="yearsOfExperience"
                  type="number"
                  min="0"
                  max="60"
                  defaultValue={String(data?.yearsOfExperience ?? 0)}
                />
              )}
            </FormField>
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
    <div className="candidate-page candidate-domain-container">
      <div className="candidate-hero-banner-mindease">
        <div className="banner-left-content">
          <div className="banner-icon-badge theme-blue">
            <Search size={22} />
          </div>
          <div className="banner-text-details">
            <h1 className="banner-title">Find Jobs</h1>
            <p className="banner-subtext">Search currently published opportunities.</p>
          </div>
        </div>
      </div>
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

  const initials = (user?.fullName || 'Candidate')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="candidate-page candidate-settings-container">
      {/* Account Hero Banner Card */}
      <div className="settings-account-hero">
        <div className="account-hero-left">
          <div className="account-avatar-wrapper">
            <div className="account-avatar-circle">{initials}</div>
            <span className="account-status-dot" title="Active Account"></span>
          </div>
          <div className="account-user-details">
            <div className="account-badge-row">
              <span className="account-role-pill">Candidate Workspace</span>
            </div>
            <h2 className="account-user-name">{user?.fullName || 'Candidate'}</h2>
            <p className="account-user-email">{user?.email}</p>
          </div>
        </div>
        <div className="account-hero-right">
          <button
            type="button"
            className="settings-signout-btn"
            onClick={() => void logout()}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Settings Cards Grid */}
      <div className="settings-grid-mindease">
        {/* Connected Accounts */}
        <div className="settings-card-mindease card-stagger-1">
          <div className="settings-card-header">
            <div className="settings-icon-box theme-blue">
              <Link2 size={20} />
            </div>
            <div className="settings-card-title-group">
              <h3>Connected Accounts</h3>
              <p>Sign in provider integrations</p>
            </div>
          </div>
          <p className="settings-card-desc">
            Connect third-party login providers to sign in to Talvix securely.
          </p>
          <div className="settings-card-action">
            {hasGoogle ? (
              <div className="connected-status-box">
                <div className="connected-badge">
                  <span className="connected-dot"></span>
                  <span>Google connected</span>
                </div>
                <Button
                  variant="secondary"
                  disabled={isLinking}
                  onClick={handleUnlink}
                  className="unlink-google-btn"
                >
                  Unlink Google Account
                </Button>
              </div>
            ) : (
              <div className="connect-google-container">
                <span className="connect-note">Google is not connected.</span>
                <div 
                  onClick={handleGoogleClickPlaceholder}
                  className="google-connect-pill-btn"
                >
                  <div className="google-connect-inner">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 0 12 0 7.31 0 3.25 2.69 1.25 6.63l3.87 3C6.06 6.88 8.81 5.04 12 5.04z"/>
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58v3l3.87 3c2.26-2.09 3.56-5.17 3.56-8.73z"/>
                      <path fill="#34A853" d="M5.12 14.37c-.24-.72-.37-1.49-.37-2.37s.13-1.65.37-2.37V6.63H1.25C.45 8.24 0 10.06 0 12s.45 3.76 1.25 5.37l3.87-3z"/>
                      <path fill="#FBBC05" d="M12 18.96c-3.19 0-5.94-1.84-6.88-4.59l-3.87 3C3.25 21.31 7.31 24 12 24c3.24 0 6.13-1.07 8.17-2.91l-3.87-3c-1.13.75-2.6 1.17-4.3 1.17z"/>
                    </svg>
                    <span>Connect Google Account</span>
                  </div>
                  <div 
                    ref={linkRef} 
                    className="absolute inset-0 opacity-[0.01] cursor-pointer w-full [&_iframe]:w-full"
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-card-mindease card-stagger-2">
          <div className="settings-card-header">
            <div className="settings-icon-box theme-purple">
              <Bell size={20} />
            </div>
            <div className="settings-card-title-group">
              <h3>Notifications</h3>
              <p>Delivery channels & digests</p>
            </div>
          </div>
          <p className="settings-card-desc">
            Manage email notifications, in-app alerts, quiet hours, and digest frequencies.
          </p>
          <div className="settings-card-action">
            <Link to="/candidate/settings/notifications" className="settings-action-pill-btn">
              <span>Notification preferences</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Privacy */}
        <div className="settings-card-mindease card-stagger-3">
          <div className="settings-card-header">
            <div className="settings-icon-box theme-green">
              <Eye size={20} />
            </div>
            <div className="settings-card-title-group">
              <h3>Privacy</h3>
              <p>Profile discoverability</p>
            </div>
          </div>
          <p className="settings-card-desc">
            Control candidate profile discoverability for recruiters and hiring managers.
          </p>
          <div className="settings-card-action">
            <Link to="/candidate/settings/privacy" className="settings-action-pill-btn">
              <span>Privacy settings</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Security */}
        <div className="settings-card-mindease card-stagger-4">
          <div className="settings-card-header">
            <div className="settings-icon-box theme-yellow">
              <ShieldCheck size={20} />
            </div>
            <div className="settings-card-title-group">
              <h3>Security</h3>
              <p>Credentials & session management</p>
            </div>
          </div>
          <p className="settings-card-desc">
            Review security features, MFA availability, and session control policies.
          </p>
          <div className="settings-card-action">
            <Link to="/candidate/settings/security" className="settings-action-pill-btn">
              <span>View availability</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
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
