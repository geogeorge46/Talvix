import { useEffect, useState, type FormEvent } from 'react';
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
} from '../../design-system';
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
      <section className="candidate-hero" aria-label="Next best action">
        <div>
          <span className="candidate-eyebrow">NEXT BEST ACTION</span>
          <h2>
            {nextAction?.label ??
              (!profile.data?.headline
                ? 'Complete your candidate headline'
                : 'No urgent deadline')}
          </h2>
          <p>
            {nextAction?.detail ??
              (!profile.data?.headline
                ? 'Help recruiters understand the work you want to do.'
                : 'You have no assessment, interview, or offer response due right now.')}
          </p>
        </div>
        <Link
          className="candidate-button-link"
          to={
            nextAction?.href ??
            (!profile.data?.headline
              ? '/candidate/profile'
              : '/candidate/applications')
          }
        >
          {nextAction
            ? 'Open action'
            : !profile.data?.headline
              ? 'Complete profile'
              : 'View applications'}
        </Link>
      </section>
      <div className="candidate-summary">
        <Card>
          <h2>Profile</h2>
          {profile.isPending ? (
            <LoadingState label="Loading profile" />
          ) : profile.isError ? (
            <ErrorState
              title="Profile unavailable"
              detail={message(profile.error)}
            />
          ) : (
            <>
              <strong>{profile.data?.headline || 'Headline needed'}</strong>
              <p>Visibility: {profile.data?.profileVisibility}</p>
            </>
          )}
        </Card>
        <Card>
          <h2>Applications</h2>
          {apps.isPending ? (
            <LoadingState label="Loading applications" />
          ) : apps.isError ? (
            <ErrorState
              title="Applications unavailable"
              detail={message(apps.error)}
            />
          ) : (
            <>
              <strong className="candidate-number">{apps.data?.total}</strong>
              <p>Applications in your workspace</p>
            </>
          )}
        </Card>
        <Card>
          <h2>Upcoming work</h2>
          <p>
            Assessments, interviews and offers stay in their dedicated
            workspaces.
          </p>
          <div className="candidate-inline-links">
            <Link to="/candidate/assessments">Assessments</Link>
            <Link to="/candidate/interviews">Interviews</Link>
            <Link to="/candidate/offers">Offers</Link>
          </div>
        </Card>
      </div>
      <section>
        <h2>Recent applications</h2>
        {apps.data?.items.length ? (
          <ul className="candidate-list">
            {apps.data.items.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.jobTitle || 'Application'}</strong>
                  <span>{a.companyName}</span>
                </div>
                <StatusTag>{a.status}</StatusTag>
                <Link to={`/candidate/applications/${a.id}`}>Open</Link>
              </li>
            ))}
          </ul>
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
      <section aria-labelledby="candidate-deadlines-title">
        <h2 id="candidate-deadlines-title">Deadlines and activity</h2>
        <div className="candidate-summary">
          <DomainSummary
            title="Assessments"
            href="/candidate/assessments"
            pending={assessments.isPending}
            error={assessments.error}
            count={assessments.data?.length}
          />
          <DomainSummary
            title="Interviews"
            href="/candidate/interviews"
            pending={interviews.isPending}
            error={interviews.error}
            count={interviews.data?.length}
          />
          <DomainSummary
            title="Offers"
            href="/candidate/offers"
            pending={offers.isPending}
            error={offers.error}
            count={offers.data?.length}
          />
          <DomainSummary
            title="Unread updates"
            href="/candidate/notifications"
            pending={notifications.isPending}
            error={notifications.error}
            count={notifications.data?.total}
          />
        </div>
      </section>
    </div>
  );
}
function DomainSummary({
  title,
  href,
  pending,
  error,
  count,
}: {
  title: string;
  href: string;
  pending: boolean;
  error: unknown;
  count: number | undefined;
}) {
  return (
    <Card>
      <h3>{title}</h3>
      {pending ? (
        <LoadingState label={`Loading ${title.toLowerCase()}`} />
      ) : error ? (
        <p role="status">Temporarily unavailable</p>
      ) : (
        <strong className="candidate-number">{count ?? 0}</strong>
      )}
      <Link to={href}>Open {title.toLowerCase()}</Link>
    </Card>
  );
}

export function CandidateProfilePage() {
  const q = useCandidateProfile(),
    mutation = useCandidateProfileMutation();
  const photo = useCandidateProfilePhoto();
  const [confirm, setConfirm] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<Record<
    string,
    unknown
  > | null>(null);
  if (q.isPending) return <LoadingState label="Loading profile" />;
  if (q.isError)
    return <ErrorState title="Profile unavailable" detail={message(q.error)} />;
  const p = q.data;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      visibility = String(f.get('profileVisibility'));
    const body = {
      headline: String(f.get('headline')),
      bio: String(f.get('bio')),
      phone: String(f.get('phone')),
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
      ...(String(f.get('salaryMinimum')) && String(f.get('salaryMaximum'))
        ? {
            expectedSalary: {
              minimum: Number(f.get('salaryMinimum')),
              maximum: Number(f.get('salaryMaximum')),
              currency: String(f.get('salaryCurrency')).toUpperCase(),
            },
          }
        : { expectedSalary: null }),
      availability: String(f.get('availability')) || undefined,
      ...(String(f.get('availability')) === 'notice-period'
        ? { noticePeriodDays: Number(f.get('noticePeriodDays')) }
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
      <Card>
        <h2>Profile photo</h2>
        {photo.isPending ? (
          <LoadingState label="Loading profile photo" />
        ) : photo.isError ? (
          <p>
            The specialized profile-photo service is temporarily unavailable.
          </p>
        ) : photo.data ? (
          <p>
            {photo.data.displayName} · {photo.data.status}
          </p>
        ) : (
          <p>No profile photo uploaded.</p>
        )}
        <p>
          Profile photos use the private specialized document contract. Upload
          and replacement remain in the Documents workspace until a dedicated
          photo picker can safely provide its multipart flow.
        </p>
        <Link to="/candidate/documents">Open document manager</Link>
      </Card>
      <Card>
        <form onSubmit={submit}>
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
          <FormField label="Phone">
            {({ id, ...control }) => (
              <TextField
                id={id}
                {...control}
                name="phone"
                defaultValue={p.phone}
              />
            )}
          </FormField>
          <FormField label="Profile visibility">
            {({ id, ...control }) => (
              <Select
                id={id}
                {...control}
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
          <div className="candidate-form-grid">
            <TextField
              name="city"
              aria-label="City"
              placeholder="City"
              defaultValue={p.location.city}
            />
            <TextField
              name="state"
              aria-label="State"
              placeholder="State"
              defaultValue={p.location.state}
            />
            <TextField
              name="country"
              aria-label="Country"
              placeholder="Country"
              defaultValue={p.location.country}
            />
            <TextField
              name="dateOfBirth"
              aria-label="Date of birth"
              type="date"
              defaultValue={p.dateOfBirth?.slice(0, 10)}
            />
            <Select
              name="gender"
              aria-label="Gender"
              placeholder="Gender"
              defaultValue={p.gender ?? ''}
              options={[
                'female',
                'male',
                'non-binary',
                'prefer-not-to-say',
              ].map((value) => ({ value, label: value }))}
            />
            <TextField
              name="github"
              aria-label="GitHub URL"
              type="url"
              placeholder="GitHub URL"
              defaultValue={p.socialLinks.github}
            />
            <TextField
              name="linkedin"
              aria-label="LinkedIn URL"
              type="url"
              placeholder="LinkedIn URL"
              defaultValue={p.socialLinks.linkedin}
            />
            <TextField
              name="portfolio"
              aria-label="Portfolio URL"
              type="url"
              placeholder="Portfolio URL"
              defaultValue={p.socialLinks.portfolio}
            />
            <TextField
              name="preferredRoles"
              aria-label="Preferred roles"
              placeholder="Preferred roles, comma separated"
              defaultValue={p.preferredRoles.join(', ')}
            />
            <TextField
              name="preferredLocations"
              aria-label="Preferred locations"
              placeholder="Preferred locations, comma separated"
              defaultValue={p.preferredLocations.join(', ')}
            />
            <TextField
              name="preferredJobTypes"
              aria-label="Preferred job types"
              placeholder="internship, full-time, part-time, contract, freelance"
              defaultValue={p.preferredJobTypes.join(', ')}
            />
            <TextField
              name="salaryMinimum"
              aria-label="Expected salary minimum"
              type="number"
              min="0"
              defaultValue={p.expectedSalary?.minimum}
            />
            <TextField
              name="salaryMaximum"
              aria-label="Expected salary maximum"
              type="number"
              min="0"
              defaultValue={p.expectedSalary?.maximum}
            />
            <TextField
              name="salaryCurrency"
              aria-label="Expected salary currency"
              maxLength={3}
              defaultValue={p.expectedSalary?.currency ?? 'INR'}
            />
            <Select
              name="availability"
              aria-label="Availability"
              placeholder="Availability"
              defaultValue={p.availability ?? ''}
              options={['immediately', 'notice-period', 'unavailable'].map(
                (value) => ({ value, label: value }),
              )}
            />
            <TextField
              name="noticePeriodDays"
              aria-label="Notice period days"
              type="number"
              min="0"
              max="365"
              defaultValue={p.noticePeriodDays}
            />
          </div>
          {mutation.isError && (
            <Alert tone="danger" title="Profile was not saved">
              {message(mutation.error)}
            </Alert>
          )}
          <FormActions>
            <Button type="submit" loading={mutation.isPending}>
              Save profile
            </Button>
          </FormActions>
        </form>
      </Card>
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
        <TextField
          name="skills"
          aria-label="Required skills"
          placeholder="Skills, comma separated"
          defaultValue={params.get('skills') ?? ''}
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
                  <Link to={`/candidate/jobs/${job.id}`}>{job.title}</Link>
                </h2>
                <p>
                  {job.companyName} · {job.location || 'Location flexible'}
                </p>
              </div>
              {job.closingDate && <span>Closes {date(job.closingDate)}</span>}
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
              <Button type="submit" disabled={mutation.isPending}>
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
  const { user, logout } = useAuth();
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
