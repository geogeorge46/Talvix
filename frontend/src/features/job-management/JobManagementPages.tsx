import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useBlocker,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  ErrorSummary,
  FilteredEmptyState,
  Form,
  FormActions,
  FormSection,
  LoadingState,
  MetricCard,
  PageHeader,
  PermissionState,
  PendingApprovalState,
  SuspendedState,
  SearchField,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
  UnverifiedCompanyState,
} from '../../design-system';
import {
  allowedActions,
  emptyDraft,
  employmentTypes,
  jobStatuses,
  statusMeta,
  toDraft,
  type JobDraft,
  type JobView,
  workModes,
} from './model';
import { useJobAction, useManagedJob, useManagedJobs, useSaveJob } from './api';
import './job-management.css';
const label = (s: string) =>
  s.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
function useAccess() {
  const { user, recruiter } = useAuth();
  const p = recruiter?.permissions ?? [];
  const verification = recruiter?.company?.verificationStatus ?? 'pending';
  const companyState = !recruiter?.isApproved
    ? 'approval-pending'
    : recruiter?.company?.isActive === false
      ? 'inactive'
      : verification === 'suspended'
        ? 'suspended'
        : verification === 'rejected'
          ? 'rejected'
          : verification === 'verified'
            ? 'verified'
            : 'unverified';
  const blocked = [
    'approval-pending',
    'inactive',
    'suspended',
    'rejected',
  ].includes(companyState);
  return {
    user,
    recruiter,
    p,
    blocked,
    companyState,
    verified: recruiter?.company?.verificationStatus === 'verified',
    has: (x: string) => p.includes(x),
  };
}
function Block() {
  const a = useAccess();
  if (a.companyState === 'approval-pending')
    return (
      <PendingApprovalState
        title="Recruiter approval pending"
        description="Job management becomes available after your membership is approved."
      />
    );
  if (a.companyState === 'suspended')
    return (
      <SuspendedState
        title="Company suspended"
        description="Job management is read-only while this company is suspended."
      />
    );
  if (a.companyState === 'rejected')
    return (
      <PermissionState
        title="Company verification rejected"
        description="Job mutations are unavailable. Contact an administrator before continuing."
      />
    );
  if (a.companyState === 'inactive')
    return (
      <PermissionState
        title="Company inactive"
        description="This company is inactive, so job management is unavailable."
      />
    );
  return null;
}
function Status({ job }: { job: JobView }) {
  const [name, tone] = statusMeta(job.status);
  return <StatusTag tone={tone}>{name}</StatusTag>;
}
function JobRowActions({
  job,
  permissions,
  verified,
}: {
  job: JobView;
  permissions: string[];
  verified: boolean;
}) {
  const mutation = useJobAction(job.id);
  const [action, setAction] = useState<
    null | 'submit' | 'pause' | 'resume' | 'close' | 'archive'
  >(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = allowedActions(job.status, permissions, verified);
  const choices = (
    ['submit', 'pause', 'resume', 'close', 'archive'] as const
  ).filter((x) => allowed[x]);
  return (
    <div className="job-actions">
      {error && (
        <Alert tone="danger" title="Action failed">
          {error}
        </Alert>
      )}
      <Link
        className="tvx-button tvx-button--secondary tvx-button--md"
        to={`/org/jobs/${job.id}`}
      >
        Details
      </Link>
      {choices.map((x) => (
        <Button
          key={x}
          variant={x === 'archive' ? 'danger' : 'quiet'}
          disabled={mutation.isPending}
          onClick={() => setAction(x)}
        >
          {label(x)}
        </Button>
      ))}
      {action && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setAction(null)}
          title={`${label(action)} job?`}
          description="This updates the job lifecycle immediately."
          confirmLabel={label(action)}
          variant={action === 'archive' ? 'destructive' : 'default'}
          onConfirm={async () => {
            try {
              setError(null);
              await mutation.mutateAsync(action);
              setAction(null);
            } catch (reason) {
              setAction(null);
              setError(
                reason instanceof ApiError && reason.status === 409
                  ? 'This job changed. Open details and reload before retrying.'
                  : reason instanceof Error
                    ? reason.message
                    : 'The action could not be completed.',
              );
            }
          }}
        />
      )}
    </div>
  );
}
export function ManagedJobsPage() {
  const a = useAccess();
  const [sp, setSp] = useSearchParams();
  const rawPage = Number(sp.get('page'));
  const page =
      Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    q = (sp.get('q') ?? '').trim().slice(0, 100),
    status = jobStatuses.includes((sp.get('status') ?? '') as never)
      ? (sp.get('status') ?? '')
      : '',
    employment = employmentTypes.includes((sp.get('employment') ?? '') as never)
      ? (sp.get('employment') ?? '')
      : '',
    workMode = workModes.includes((sp.get('workMode') ?? '') as never)
      ? (sp.get('workMode') ?? '')
      : '';
  const query = useManagedJobs(page, q, a.has('jobs.update') && !a.blocked);
  const rows = useMemo(
    () =>
      query.data?.jobs.filter(
        (j) =>
          (!status || j.status === status) &&
          (!employment || j.employmentType === employment) &&
          (!workMode || j.workMode === workMode),
      ) ?? [],
    [query.data, status, employment, workMode],
  );
  const update = (values: Record<string, string>) => {
    const n = new URLSearchParams(sp);
    Object.entries(values).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    n.set('page', '1');
    setSp(n);
  };
  if (!a.has('jobs.update'))
    return (
      <PermissionState description="The jobs.update permission is required to view managed jobs." />
    );
  if (a.blocked) return <Block />;
  return (
    <main className="jobs-page">
      <PageHeader
        title="Jobs"
        description="Create, review, and move roles through the hiring lifecycle."
        primaryAction={
          a.has('jobs.create') ? (
            <Link
              className="tvx-button tvx-button--primary tvx-button--md"
              to="/org/jobs/new"
            >
              Create job
            </Link>
          ) : undefined
        }
      />
      <MetricCard
        label="Total managed jobs"
        value={query.data?.pagination.total ?? '—'}
        metadata="Across your organization"
      />
      <Toolbar
        label="Job filters"
        start={
          <SearchField
            label="Search jobs"
            defaultValue={q}
            onSearch={(v) => update({ q: v })}
          />
        }
        end={
          <div className="job-filters">
            <Select
              aria-label="Status — current page"
              value={status}
              options={jobStatuses.map((v) => ({ value: v, label: label(v) }))}
              onChange={(e) => update({ status: e.target.value })}
            />
            <Select
              aria-label="Employment — current page"
              value={employment}
              options={employmentTypes.map((v) => ({
                value: v,
                label: label(v),
              }))}
              onChange={(e) => update({ employment: e.target.value })}
            />
            <Select
              aria-label="Work mode — current page"
              value={workMode}
              options={workModes.map((v) => ({ value: v, label: label(v) }))}
              onChange={(e) => update({ workMode: e.target.value })}
            />
          </div>
        }
      />
      <p className="filter-note">
        Status, employment, and work-mode filters apply to the current page.
        Search covers all managed jobs.
      </p>
      {query.isLoading ? (
        <LoadingState label="Loading jobs" />
      ) : query.isError ? (
        <ErrorState
          detail={(query.error as Error).message}
          retry={() => void query.refetch()}
        />
      ) : (
        <DataTable
          caption="Managed jobs"
          rows={rows}
          rowKey={(j) => j.id}
          columns={[
            {
              id: 'title',
              header: 'Role',
              render: (j) => (
                <div>
                  <strong>{j.title}</strong>
                  <small>{j.location}</small>
                </div>
              ),
            },
            {
              id: 'setup',
              header: 'Setup',
              render: (j) => (
                <>
                  {label(j.employmentType)} · {label(j.workMode)}
                </>
              ),
            },
            {
              id: 'status',
              header: 'Status',
              render: (j) => <Status job={j} />,
            },
            { id: 'openings', header: 'Openings', accessor: (j) => j.openings },
            {
              id: 'interest',
              header: 'Interest',
              render: (j) => (
                <>
                  {j.applicationsCount} applications · {j.viewsCount} views
                </>
              ),
            },
            {
              id: 'deadline',
              header: 'Deadline',
              render: (j) =>
                j.deadline
                  ? new Date(j.deadline).toLocaleDateString()
                  : 'No deadline',
            },
          ]}
          renderNarrow={(j) => (
            <Card
              heading={j.title}
              headingLevel={2}
              actions={<Status job={j} />}
            >
              <p>
                {label(j.employmentType)} · {label(j.workMode)}
              </p>
              <p>
                {j.openings} openings · {j.applicationsCount} applications
              </p>
              <p>
                {j.viewsCount} views ·{' '}
                {j.deadline
                  ? `Closes ${new Date(j.deadline).toLocaleDateString()}`
                  : 'No deadline'}{' '}
                · {j.location}
              </p>
            </Card>
          )}
          rowActions={(j) => (
            <JobRowActions job={j} permissions={a.p} verified={a.verified} />
          )}
          empty={
            q || status || employment || workMode ? (
              <FilteredEmptyState
                title="No matching jobs"
                description="No jobs on this page match the current filters."
                onClear={() => setSp({})}
              />
            ) : (
              <EmptyState
                title="No jobs yet"
                description="Create the first job to begin recruiting."
                action={
                  a.has('jobs.create') ? (
                    <Link
                      className="tvx-button tvx-button--primary tvx-button--md"
                      to="/org/jobs/new"
                    >
                      Create job
                    </Link>
                  ) : undefined
                }
              />
            )
          }
          pagination={{
            page,
            totalPages: query.data?.pagination.pages ?? 1,
            onPageChange: (p) => {
              const n = new URLSearchParams(sp);
              n.set('page', String(p));
              setSp(n);
            },
            ariaLabel: 'Jobs pages',
          }}
        />
      )}
    </main>
  );
}
export function JobDetailsPage() {
  const { jobId = '' } = useParams();
  const a = useAccess();
  const q = useManagedJob(jobId, a.has('jobs.update') && !a.blocked);
  const m = useJobAction(jobId);
  const [confirm, setConfirm] = useState<
    null | 'submit' | 'pause' | 'resume' | 'close' | 'archive'
  >(null);
  const [actionError, setActionError] = useState<{
    message: string;
    stale: boolean;
  } | null>(null);
  if (!a.has('jobs.update')) return <PermissionState />;
  if (a.blocked) return <Block />;
  if (q.isLoading) return <LoadingState label="Loading job" />;
  if (q.isError || !q.data)
    return (
      <ErrorState
        detail={(q.error as Error)?.message ?? 'Job not found'}
        retry={() => void q.refetch()}
      />
    );
  const j = q.data,
    actions = allowedActions(j.status, a.p, a.verified);
  return (
    <main className="jobs-page">
      <PageHeader
        title={j.title}
        eyebrow={<Status job={j} />}
        description={`${label(j.employmentType)} · ${label(j.workMode)} · ${j.location}`}
        primaryAction={
          actions.edit ? (
            <Link
              className="tvx-button tvx-button--primary tvx-button--md"
              to={`/org/jobs/${j.id}/edit`}
            >
              Edit job
            </Link>
          ) : undefined
        }
        secondaryActions={
          <div className="job-actions">
            {(['submit', 'pause', 'resume', 'close', 'archive'] as const)
              .filter((x) => actions[x])
              .map((x) => (
                <Button
                  key={x}
                  variant={x === 'archive' ? 'danger' : 'secondary'}
                  onClick={() => setConfirm(x)}
                >
                  {label(x)}
                </Button>
              ))}
          </div>
        }
      />
      {!a.verified && (j.status === 'draft' || j.status === 'paused') && (
        <UnverifiedCompanyState description="Verification is required before submitting or resuming this job." />
      )}
      {actionError && (
        <Alert
          tone="danger"
          title={
            actionError.stale ? 'Job changed on the server' : 'Action failed'
          }
        >
          <p>
            {actionError.stale
              ? 'Reload the latest job before choosing another lifecycle action.'
              : actionError.message}
          </p>
          {actionError.stale && (
            <Button variant="secondary" onClick={() => void q.refetch()}>
              Reload job
            </Button>
          )}
        </Alert>
      )}
      {j.status === 'rejected' && (
        <Alert tone="danger" title="Changes requested">
          <p>
            {j.rejectionReason ??
              'The reviewer requested changes. No reason was provided.'}
          </p>
        </Alert>
      )}
      {j.status === 'pending-review' && (
        <Alert tone="warning" title="Awaiting review">
          An administrator must approve this job before publication.
        </Alert>
      )}
      {j.status === 'published' && (
        <Alert tone="info" title="Published">
          This job is live and accepting applications.
        </Alert>
      )}
      {j.status === 'paused' && (
        <Alert tone="warning" title="Paused">
          Applications are paused until the job is resumed.
        </Alert>
      )}
      {j.status === 'closed' && (
        <Alert tone="info" title="Closed">
          This job no longer accepts applications.
        </Alert>
      )}
      {j.status === 'archived' && (
        <Alert tone="info" title="Archived">
          This job is retained for historical reference.
        </Alert>
      )}
      <div className="job-detail-grid">
        <Card heading="Role overview">
          <p className="job-description">{j.description}</p>
          <DescriptionList
            items={[
              { term: 'Openings', description: j.openings },
              { term: 'Applications', description: j.applicationsCount },
              { term: 'Views', description: j.viewsCount },
              {
                term: 'Deadline',
                description: j.deadline
                  ? new Date(j.deadline).toLocaleDateString()
                  : 'No deadline',
              },
            ]}
          />
        </Card>
        <Card heading="Requirements">
          {j.requirements.length ? (
            <ul>
              {j.requirements.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Responsibilities">
          {j.responsibilities.length ? (
            <ul>
              {j.responsibilities.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Experience and compensation">
          <DescriptionList
            items={[
              {
                term: 'Experience',
                description: `${j.draft.minimumExperience}${j.draft.maximumExperience ? `–${j.draft.maximumExperience}` : '+'} years`,
              },
              {
                term: 'Salary',
                description: j.draft.salaryMinimum
                  ? `${j.draft.salaryCurrency} ${j.draft.salaryMinimum}–${j.draft.salaryMaximum} ${j.draft.salaryPeriod}${j.draft.salaryVisible ? ' · visible' : ' · private'}`
                  : 'Not specified',
              },
              { term: 'Location', description: j.location },
            ]}
          />
        </Card>
        <Card heading="Skills">
          {j.draft.skills.length ? (
            <ul>
              {j.draft.skills.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong> · {label(s.minimumProficiency)} ·{' '}
                  {s.minimumYearsOfExperience} years · weight {s.weight}
                  {s.required ? ' · required' : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Preferred qualifications">
          {j.preferredQualifications.length ? (
            <ul>
              {j.preferredQualifications.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Education">
          {j.educationRequirements.length ? (
            <ul>
              {j.educationRequirements.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p>None specified.</p>
          )}
        </Card>
        <Card heading="Application settings">
          <DescriptionList
            items={[
              {
                term: 'Resume',
                description: j.draft.resumeRequired ? 'Required' : 'Optional',
              },
              {
                term: 'Assessment',
                description: j.draft.assessmentRequired
                  ? 'Required'
                  : 'Not required',
              },
              {
                term: 'Minimum profile completion',
                description: `${j.draft.minimumProfileCompletion}%`,
              },
              {
                term: 'Questions',
                description: j.draft.questions.length
                  ? j.draft.questions.map((q) => q.question).join(' · ')
                  : 'None',
              },
            ]}
          />
        </Card>
        <Card heading="Record history">
          <DescriptionList
            items={[
              {
                term: 'Reviewed',
                description: j.reviewedAt
                  ? new Date(j.reviewedAt).toLocaleString()
                  : 'Not reviewed',
              },
              {
                term: 'Created',
                description: j.createdAt
                  ? new Date(j.createdAt).toLocaleString()
                  : 'Unknown',
              },
              {
                term: 'Updated',
                description: j.updatedAt
                  ? new Date(j.updatedAt).toLocaleString()
                  : 'Unknown',
              },
            ]}
          />
        </Card>
      </div>
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`${label(confirm)} job?`}
          description="This updates the job lifecycle immediately."
          confirmLabel={label(confirm)}
          variant={confirm === 'archive' ? 'destructive' : 'default'}
          onConfirm={async () => {
            try {
              setActionError(null);
              await m.mutateAsync(confirm);
              setConfirm(null);
            } catch (error) {
              setConfirm(null);
              setActionError({
                message:
                  error instanceof Error
                    ? error.message
                    : 'The action could not be completed.',
                stale: error instanceof ApiError && error.status === 409,
              });
            }
          }}
        />
      )}
    </main>
  );
}
const draftKey = (actor: string, company: string, id: string) =>
  `talvix:job-draft:v1:${actor}:${company}:${id}`;
function readDraft(key: string): { draft: JobDraft; savedAt: number } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null') as unknown;
    if (!value || typeof value !== 'object') return null;
    const record = value as {
      version?: unknown;
      savedAt?: unknown;
      draft?: unknown;
    };
    if (
      record.version !== 1 ||
      typeof record.savedAt !== 'number' ||
      !record.draft ||
      typeof record.draft !== 'object'
    )
      return null;
    const d = record.draft as Record<string, unknown>;
    const stringKeys = [
      'title',
      'description',
      'employmentType',
      'workMode',
      'city',
      'state',
      'country',
      'openings',
      'deadline',
      'minimumExperience',
      'maximumExperience',
      'responsibilities',
      'requirements',
      'preferredQualifications',
      'educationRequirements',
      'minimumProfileCompletion',
      'salaryMinimum',
      'salaryMaximum',
      'salaryCurrency',
      'salaryPeriod',
    ];
    if (
      !stringKeys.every((k) => typeof d[k] === 'string') ||
      typeof d.assessmentRequired !== 'boolean' ||
      typeof d.resumeRequired !== 'boolean' ||
      typeof d.salaryVisible !== 'boolean' ||
      !Array.isArray(d.skills) ||
      !Array.isArray(d.questions)
    )
      return null;
    return { draft: d as unknown as JobDraft, savedAt: record.savedAt };
  } catch {
    return null;
  }
}
function validate(d: JobDraft) {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = 'Enter a title.';
  if (!d.description.trim()) e.description = 'Enter a description.';
  if (!employmentTypes.includes(d.employmentType as never))
    e.employmentType = 'Choose an employment type.';
  if (!workModes.includes(d.workMode as never))
    e.workMode = 'Choose a work mode.';
  if (!(Number(d.openings) > 0)) e.openings = 'Openings must be at least 1.';
  if (!Number.isInteger(Number(d.openings)) || Number(d.openings) > 10000)
    e.openings = 'Openings must be a whole number from 1 to 10,000.';
  if (d.deadline && new Date(d.deadline) <= new Date())
    e.deadline = 'Application deadline must be in the future.';
  if (Number(d.minimumExperience) < 0 || Number(d.minimumExperience) > 60)
    e.minimumExperience = 'Experience must be between 0 and 60 years.';
  if (
    Number(d.maximumExperience) < Number(d.minimumExperience) &&
    d.maximumExperience
  )
    e.maximumExperience = 'Maximum experience cannot be lower than minimum.';
  if (
    d.maximumExperience &&
    (Number(d.maximumExperience) < 0 || Number(d.maximumExperience) > 60)
  )
    e.maximumExperience = 'Experience must be between 0 and 60 years.';
  const salaryStarted = d.salaryMinimum !== '' || d.salaryMaximum !== '';
  if (salaryStarted && (d.salaryMinimum === '' || d.salaryMaximum === ''))
    e.salaryMinimum = 'Enter both salary bounds.';
  if (salaryStarted && Number(d.salaryMaximum) < Number(d.salaryMinimum))
    e.salaryMaximum = 'Maximum salary cannot be lower than minimum salary.';
  if (salaryStarted && !/^[A-Z]{3}$/.test(d.salaryCurrency))
    e.salaryCurrency = 'Use a three-letter currency code.';
  if (
    Number(d.minimumProfileCompletion) < 0 ||
    Number(d.minimumProfileCompletion) > 100
  )
    e.minimumProfileCompletion = 'Profile completion must be from 0 to 100.';
  const names = d.skills
    .map((s) => s.name.trim().toLowerCase())
    .filter(Boolean);
  if (new Set(names).size !== names.length)
    e.skills = 'Skill names must be unique.';
  d.skills.forEach((s, i) => {
    if (!s.name.trim()) e[`skills.${i}.name`] = 'Enter a skill name.';
    if (Number(s.weight) < 1 || Number(s.weight) > 100)
      e[`skills.${i}.weight`] = 'Weight must be between 1 and 100.';
    if (!Number.isInteger(Number(s.weight)))
      e[`skills.${i}.weight`] = 'Weight must be a whole number.';
    if (
      Number(s.minimumYearsOfExperience) < 0 ||
      Number(s.minimumYearsOfExperience) > 60
    )
      e[`skills.${i}.minimumYearsOfExperience`] =
        'Skill experience must be from 0 to 60 years.';
  });
  d.questions.forEach((q, i) => {
    if (!q.question.trim())
      e[`applicationQuestions.${i}.question`] = 'Enter a question.';
    if (
      ['single-choice', 'multiple-choice'].includes(q.type) &&
      q.options.split('\n').filter((x) => x.trim()).length < 2
    )
      e[`applicationQuestions.${i}.options`] =
        'Choice questions require at least two options.';
  });
  return e;
}
export function JobFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { jobId = 'new' } = useParams();
  const nav = useNavigate(),
    a = useAccess(),
    existing = useManagedJob(
      jobId,
      mode === 'edit' && a.has('jobs.update') && !a.blocked,
    ),
    save = useSaveJob(mode === 'edit' ? jobId : undefined);
  const key = draftKey(
    a.user?._id ?? 'anon',
    a.recruiter?.company?._id ?? 'none',
    jobId,
  );
  const initialStored = useMemo(() => readDraft(key), [key]);
  const [savedDraft, setSavedDraft] = useState<JobDraft | null>(
    () => initialStored?.draft ?? null,
  );
  const [d, setD] = useState(emptyDraft),
    [dirty, setDirty] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const blocker = useBlocker(dirty);
  const [createdWithoutRead, setCreatedWithoutRead] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const submitLock = useRef(false);
  useEffect(() => {
    if (
      mode === 'edit' &&
      existing.data?.updatedAt &&
      initialStored &&
      initialStored.savedAt <= new Date(existing.data.updatedAt).getTime()
    ) {
      sessionStorage.removeItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSavedDraft(null);
    }
    if (mode === 'edit' && existing.data && !savedDraft) {
      // Server state initializes the edit buffer when the query resolves.
      setD(toDraft(existing.data));
      setDirty(false);
    }
  }, [mode, existing.data, savedDraft, initialStored, key]);
  useEffect(() => {
    if (dirty)
      sessionStorage.setItem(
        key,
        JSON.stringify({ version: 1, savedAt: Date.now(), draft: d }),
      );
  }, [d, dirty, key]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [dirty]);
  const set = <K extends keyof JobDraft>(k: K, v: JobDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  if (mode === 'create' && !a.has('jobs.create')) return <PermissionState />;
  if (mode === 'edit' && !a.has('jobs.update')) return <PermissionState />;
  if (a.blocked) return <Block />;
  if (mode === 'edit' && existing.isLoading)
    return <LoadingState label="Loading job" />;
  if (
    mode === 'edit' &&
    existing.data &&
    !allowedActions(existing.data.status, ['jobs.update'], a.verified).edit
  )
    return (
      <PermissionState
        title="Read-only job"
        description="Only draft or rejected jobs can be edited."
      />
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (save.isPending || submitLock.current) return;
    const next = validate(d);
    setErrors(next);
    if (Object.keys(next).length) {
      setTimeout(() => summary.current?.focus());
      return;
    }
    submitLock.current = true;
    try {
      const res = await save.mutateAsync(d);
      sessionStorage.removeItem(key);
      setDirty(false);
      const id = (res.job as { _id?: string } | undefined)?._id;
      if (mode === 'create' && !a.has('jobs.update'))
        setCreatedWithoutRead(true);
      else
        window.setTimeout(
          () =>
            nav(
              mode === 'edit' || id
                ? `/org/jobs/${mode === 'edit' ? jobId : id}`
                : '/org',
            ),
          0,
        );
    } catch (err) {
      const f = err instanceof ApiError ? err.fieldErrors : {};
      setErrors(
        Object.keys(f).length
          ? f
          : {
              form: err instanceof Error ? err.message : 'Could not save job.',
            },
      );
      setTimeout(() => summary.current?.focus());
    } finally {
      submitLock.current = false;
    }
  };
  if (createdWithoutRead)
    return (
      <EmptyState
        title="Job created"
        description="Your draft was saved. You do not have permission to open managed job details."
        action={<Button onClick={() => nav('/org')}>Return to overview</Button>}
      />
    );
  return (
    <main className="jobs-page">
      <PageHeader
        title={mode === 'create' ? 'Create job' : 'Edit job'}
        description="Save a precise, review-ready role without exposing internal data."
      />
      {savedDraft && (
        <Alert tone="warning" title="Newer local draft available">
          <p>
            Restore your saved browser draft or discard it and continue with the
            server version.
          </p>
          <div className="job-actions">
            <Button
              type="button"
              onClick={() => {
                setD(savedDraft);
                setDirty(true);
                setSavedDraft(null);
              }}
            >
              Restore draft
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                sessionStorage.removeItem(key);
                setSavedDraft(null);
                if (existing.data) setD(toDraft(existing.data));
              }}
            >
              Discard draft
            </Button>
          </div>
        </Alert>
      )}
      <Form className="job-form" busy={save.isPending} onSubmit={submit}>
        <ErrorSummary
          ref={summary}
          errors={Object.entries(errors).map(([fieldId, message]) => ({
            fieldId: fieldId === 'form' ? 'job-form' : fieldId,
            message,
          }))}
        />
        <FormSection
          heading="Role basics"
          description="Required details used in the job lifecycle."
        >
          <TextField
            id="title"
            label="Job title"
            required
            value={d.title}
            error={errors.title}
            maxLength={150}
            onChange={(e) => set('title', e.target.value)}
          />
          <TextArea
            id="description"
            label="Description"
            required
            value={d.description}
            error={errors.description}
            maxLength={10000}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="job-form-grid">
            <Select
              id="employmentType"
              label="Employment type"
              required
              value={d.employmentType}
              error={errors.employmentType}
              options={employmentTypes.map((v) => ({
                value: v,
                label: label(v),
              }))}
              onChange={(e) => set('employmentType', e.target.value)}
            />
            <Select
              id="workMode"
              label="Work mode"
              required
              value={d.workMode}
              error={errors.workMode}
              options={workModes.map((v) => ({ value: v, label: label(v) }))}
              onChange={(e) => set('workMode', e.target.value)}
            />
            <TextField
              id="openings"
              label="Openings"
              type="number"
              min="1"
              max="10000"
              value={d.openings}
              error={errors.openings}
              onChange={(e) => set('openings', e.target.value)}
            />
            <TextField
              id="deadline"
              label="Application deadline"
              type="date"
              value={d.deadline}
              error={errors.deadline}
              onChange={(e) => set('deadline', e.target.value)}
            />
          </div>
        </FormSection>
        <FormSection heading="Location and experience">
          <div className="job-form-grid">
            <TextField
              label="City"
              value={d.city}
              onChange={(e) => set('city', e.target.value)}
            />
            <TextField
              label="State"
              value={d.state}
              onChange={(e) => set('state', e.target.value)}
            />
            <TextField
              label="Country"
              value={d.country}
              onChange={(e) => set('country', e.target.value)}
            />
            <TextField
              id="minimumExperience"
              label="Minimum experience"
              type="number"
              min="0"
              max="60"
              value={d.minimumExperience}
              error={errors.minimumExperience}
              onChange={(e) => set('minimumExperience', e.target.value)}
            />
            <TextField
              id="maximumExperience"
              label="Maximum experience"
              type="number"
              min="0"
              max="60"
              value={d.maximumExperience}
              error={errors.maximumExperience}
              onChange={(e) => set('maximumExperience', e.target.value)}
            />
          </div>
        </FormSection>
        <FormSection
          heading="Salary"
          description="Leave both amounts empty to omit salary from the API payload."
        >
          <div className="job-form-grid">
            <TextField
              id="salaryMinimum"
              label="Minimum salary"
              type="number"
              min="0"
              value={d.salaryMinimum}
              error={errors.salaryMinimum}
              onChange={(e) => set('salaryMinimum', e.target.value)}
            />
            <TextField
              id="salaryMaximum"
              label="Maximum salary"
              type="number"
              min="0"
              value={d.salaryMaximum}
              error={errors.salaryMaximum}
              onChange={(e) => set('salaryMaximum', e.target.value)}
            />
            <TextField
              id="salaryCurrency"
              label="Currency"
              maxLength={3}
              value={d.salaryCurrency}
              error={errors.salaryCurrency}
              onChange={(e) =>
                set('salaryCurrency', e.target.value.toUpperCase())
              }
            />
            <Select
              label="Salary period"
              value={d.salaryPeriod}
              options={['hourly', 'monthly', 'yearly'].map((v) => ({
                value: v,
                label: label(v),
              }))}
              onChange={(e) => set('salaryPeriod', e.target.value)}
            />
            <Checkbox
              label="Show salary publicly"
              checked={d.salaryVisible}
              onChange={(e) => set('salaryVisible', e.target.checked)}
            />
          </div>
        </FormSection>
        <FormSection
          heading="Requirements"
          description="Enter one item per line."
        >
          {(
            [
              'responsibilities',
              'requirements',
              'preferredQualifications',
              'educationRequirements',
            ] as const
          ).map((k) => (
            <TextArea
              key={k}
              label={label(k)}
              value={d[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          ))}
        </FormSection>
        <FormSection heading="Application settings">
          <Checkbox
            label="Resume required"
            checked={d.resumeRequired}
            onChange={(e) => set('resumeRequired', e.target.checked)}
          />
          <Checkbox
            label="Assessment required"
            checked={d.assessmentRequired}
            onChange={(e) => set('assessmentRequired', e.target.checked)}
          />
          <TextField
            id="minimumProfileCompletion"
            label="Minimum profile completion"
            type="number"
            min="0"
            max="100"
            value={d.minimumProfileCompletion}
            error={errors.minimumProfileCompletion}
            onChange={(e) => set('minimumProfileCompletion', e.target.value)}
          />
        </FormSection>
        <FormSection
          heading="Skills"
          description="Add exact skill requirements used during review."
        >
          {d.skills.map((skill, index) => (
            <Card
              key={index}
              heading={`Skill ${index + 1}`}
              actions={
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    set(
                      'skills',
                      d.skills.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              }
            >
              <div className="job-form-grid">
                <TextField
                  label="Skill name"
                  id={`skills.${index}.name`}
                  error={errors[`skills.${index}.name`]}
                  value={skill.name}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, name: e.target.value } : s,
                      ),
                    )
                  }
                />
                <Select
                  label="Minimum proficiency"
                  value={skill.minimumProficiency}
                  options={[
                    'beginner',
                    'intermediate',
                    'advanced',
                    'expert',
                  ].map((v) => ({ value: v, label: label(v) }))}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index
                          ? { ...s, minimumProficiency: e.target.value }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label="Minimum years"
                  id={`skills.${index}.minimumYearsOfExperience`}
                  error={errors[`skills.${index}.minimumYearsOfExperience`]}
                  type="number"
                  min="0"
                  max="60"
                  value={skill.minimumYearsOfExperience}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index
                          ? { ...s, minimumYearsOfExperience: e.target.value }
                          : s,
                      ),
                    )
                  }
                />
                <TextField
                  label="Weight"
                  id={`skills.${index}.weight`}
                  error={errors[`skills.${index}.weight`]}
                  type="number"
                  min="1"
                  max="100"
                  value={skill.weight}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, weight: e.target.value } : s,
                      ),
                    )
                  }
                />
                <Checkbox
                  label="Required skill"
                  checked={skill.required}
                  onChange={(e) =>
                    set(
                      'skills',
                      d.skills.map((s, i) =>
                        i === index ? { ...s, required: e.target.checked } : s,
                      ),
                    )
                  }
                />
              </div>
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set('skills', [
                ...d.skills,
                {
                  name: '',
                  required: true,
                  minimumProficiency: 'beginner',
                  minimumYearsOfExperience: '0',
                  weight: '50',
                },
              ])
            }
          >
            Add skill
          </Button>
        </FormSection>
        <FormSection
          heading="Application questions"
          description="Choice questions require at least two options, one per line."
        >
          {d.questions.map((question, index) => (
            <Card
              key={index}
              heading={`Question ${index + 1}`}
              actions={
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() =>
                    set(
                      'questions',
                      d.questions.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove
                </Button>
              }
            >
              <TextArea
                label="Question"
                id={`applicationQuestions.${index}.question`}
                error={errors[`applicationQuestions.${index}.question`]}
                value={question.question}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, question: e.target.value } : q,
                    ),
                  )
                }
              />
              <Select
                label="Answer type"
                value={question.type}
                options={[
                  'text',
                  'textarea',
                  'number',
                  'boolean',
                  'single-choice',
                  'multiple-choice',
                ].map((v) => ({ value: v, label: label(v) }))}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, type: e.target.value } : q,
                    ),
                  )
                }
              />
              {['single-choice', 'multiple-choice'].includes(question.type) && (
                <TextArea
                  label="Options"
                  id={`applicationQuestions.${index}.options`}
                  error={errors[`applicationQuestions.${index}.options`]}
                  value={question.options}
                  onChange={(e) =>
                    set(
                      'questions',
                      d.questions.map((q, i) =>
                        i === index ? { ...q, options: e.target.value } : q,
                      ),
                    )
                  }
                />
              )}
              <Checkbox
                label="Required question"
                checked={question.required}
                onChange={(e) =>
                  set(
                    'questions',
                    d.questions.map((q, i) =>
                      i === index ? { ...q, required: e.target.checked } : q,
                    ),
                  )
                }
              />
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              set('questions', [
                ...d.questions,
                { question: '', type: 'text', required: false, options: '' },
              ])
            }
          >
            Add question
          </Button>
        </FormSection>
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => nav('/org/jobs')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save draft
          </Button>
        </FormActions>
      </Form>
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && blocker.reset()}
          title="Discard unsaved changes?"
          description="Your unsaved job changes will be lost."
          confirmLabel="Discard and leave"
          variant="destructive"
          onConfirm={async () => {
            setDirty(false);
            sessionStorage.removeItem(key);
            blocker.proceed();
          }}
        />
      )}
    </main>
  );
}
