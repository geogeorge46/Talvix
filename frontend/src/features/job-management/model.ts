export const jobStatuses = [
  'draft',
  'pending-review',
  'published',
  'paused',
  'closed',
  'rejected',
  'archived',
] as const;
export type JobStatus = (typeof jobStatuses)[number];
export const employmentTypes = [
  'internship',
  'full-time',
  'part-time',
  'contract',
  'freelance',
] as const;
export const workModes = ['onsite', 'remote', 'hybrid'] as const;
export interface JobDraft {
  title: string;
  description: string;
  employmentType: string;
  workMode: string;
  city: string;
  state: string;
  country: string;
  openings: string;
  deadline: string;
  scheduledPublishAt: string;
  minimumExperience: string;
  maximumExperience: string;
  responsibilities: string;
  requirements: string;
  preferredQualifications: string;
  educationRequirements: string;
  assessmentRequired: boolean;
  resumeRequired: boolean;
  minimumProfileCompletion: string;
  skills: {
    name: string;
    required: boolean;
    minimumProficiency: string;
    minimumYearsOfExperience: string;
    weight: string;
  }[];
  questions: {
    question: string;
    type: string;
    required: boolean;
    options: string;
  }[];
  salaryMinimum: string;
  salaryMaximum: string;
  salaryCurrency: string;
  salaryPeriod: string;
  salaryVisible: boolean;
}
export const emptyDraft: JobDraft = {
  title: '',
  description: '',
  employmentType: '',
  workMode: '',
  city: '',
  state: '',
  country: '',
  openings: '1',
  deadline: '',
  scheduledPublishAt: '',
  minimumExperience: '0',
  maximumExperience: '',
  responsibilities: '',
  requirements: '',
  preferredQualifications: '',
  educationRequirements: '',
  assessmentRequired: false,
  resumeRequired: true,
  minimumProfileCompletion: '0',
  skills: [],
  questions: [],
  salaryMinimum: '',
  salaryMaximum: '',
  salaryCurrency: 'USD',
  salaryPeriod: 'yearly',
  salaryVisible: true,
};
export interface JobView {
  id: string;
  title: string;
  description: string;
  status: JobStatus | 'unknown';
  rawStatus: string;
  employmentType: string;
  workMode: string;
  location: string;
  openings: number;
  applicationsCount: number;
  viewsCount: number;
  deadline?: string | undefined;
  scheduledPublishAt?: string | undefined;
  rejectionReason?: string | undefined;
  reviewedAt?: string | undefined;
  responsibilities: string[];
  requirements: string[];
  preferredQualifications: string[];
  educationRequirements: string[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  draft: JobDraft;
}
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;
export function toJob(v: unknown): JobView {
  const x = obj(v),
    l = obj(x.location);
  const salary = obj(x.salary);
  const skills = Array.isArray(x.skills) ? x.skills.map(obj) : [];
  const questions = Array.isArray(x.applicationQuestions)
    ? x.applicationQuestions.map(obj)
    : [];
  const raw = text(x.status);
  return {
    id: text(x._id),
    title: text(x.title),
    description: text(x.description),
    status: (jobStatuses as readonly string[]).includes(raw)
      ? (raw as JobStatus)
      : 'unknown',
    rawStatus: raw,
    employmentType: text(x.employmentType),
    workMode: text(x.workMode),
    location:
      [text(l.city), text(l.state), text(l.country)]
        .filter(Boolean)
        .join(', ') || 'Not specified',
    openings: num(x.openings),
    applicationsCount: num(x.applicationsCount),
    viewsCount: num(x.viewsCount),
    deadline: text(x.applicationDeadline) || undefined,
    scheduledPublishAt: text(x.scheduledPublishAt) || undefined,
    rejectionReason: text(x.rejectionReason) || undefined,
    reviewedAt: text(x.reviewedAt) || undefined,
    responsibilities: Array.isArray(x.responsibilities)
      ? x.responsibilities.filter((i): i is string => typeof i === 'string')
      : [],
    requirements: Array.isArray(x.requirements)
      ? x.requirements.filter((i): i is string => typeof i === 'string')
      : [],
    preferredQualifications: Array.isArray(x.preferredQualifications)
      ? x.preferredQualifications.filter(
          (i): i is string => typeof i === 'string',
        )
      : [],
    educationRequirements: Array.isArray(x.educationRequirements)
      ? x.educationRequirements.filter(
          (i): i is string => typeof i === 'string',
        )
      : [],
    createdAt: text(x.createdAt) || undefined,
    updatedAt: text(x.updatedAt) || undefined,
    draft: {
      ...emptyDraft,
      title: text(x.title),
      description: text(x.description),
      employmentType: text(x.employmentType),
      workMode: text(x.workMode),
      city: text(l.city),
      state: text(l.state),
      country: text(l.country),
      openings: String(num(x.openings) || 1),
      deadline: text(x.applicationDeadline).slice(0, 10),
      scheduledPublishAt: text(x.scheduledPublishAt).slice(0, 10),
      minimumExperience: String(num(x.minimumExperience)),
      maximumExperience:
        x.maximumExperience === undefined
          ? ''
          : String(num(x.maximumExperience)),
      responsibilities: Array.isArray(x.responsibilities)
        ? x.responsibilities
            .filter((i): i is string => typeof i === 'string')
            .join('\n')
        : '',
      requirements: Array.isArray(x.requirements)
        ? x.requirements
            .filter((i): i is string => typeof i === 'string')
            .join('\n')
        : '',
      preferredQualifications: Array.isArray(x.preferredQualifications)
        ? x.preferredQualifications
            .filter((i): i is string => typeof i === 'string')
            .join('\n')
        : '',
      educationRequirements: Array.isArray(x.educationRequirements)
        ? x.educationRequirements
            .filter((i): i is string => typeof i === 'string')
            .join('\n')
        : '',
      assessmentRequired: x.assessmentRequired === true,
      resumeRequired: x.resumeRequired !== false,
      minimumProfileCompletion: String(num(x.minimumProfileCompletion)),
      salaryMinimum:
        salary.minimum === undefined ? '' : String(num(salary.minimum)),
      salaryMaximum:
        salary.maximum === undefined ? '' : String(num(salary.maximum)),
      salaryCurrency: text(salary.currency) || 'USD',
      salaryPeriod: text(salary.period) || 'yearly',
      salaryVisible: salary.isVisible !== false,
      skills: skills.map((s) => ({
        name: text(s.name),
        required: s.required !== false,
        minimumProficiency: text(s.minimumProficiency) || 'beginner',
        minimumYearsOfExperience: String(num(s.minimumYearsOfExperience)),
        weight: String(num(s.weight) || 1),
      })),
      questions: questions.map((q) => ({
        question: text(q.question),
        type: text(q.type) || 'text',
        required: q.required === true,
        options: Array.isArray(q.options)
          ? q.options
              .filter((i): i is string => typeof i === 'string')
              .join('\n')
          : '',
      })),
    },
  };
}
export function toDraft(j: JobView): JobDraft {
  return structuredClone(j.draft);
}
const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
export function serializeDraft(d: JobDraft) {
  const location = {
    city: d.city.trim(),
    state: d.state.trim(),
    country: d.country.trim(),
  };
  const hasSalary = d.salaryMinimum !== '' || d.salaryMaximum !== '';
  return {
    title: d.title.trim(),
    description: d.description.trim(),
    employmentType: d.employmentType,
    workMode: d.workMode,
    ...(Object.values(location).some(Boolean) ? { location } : {}),
    ...(hasSalary
      ? {
          salary: {
            minimum: Number(d.salaryMinimum),
            maximum: Number(d.salaryMaximum),
            currency: d.salaryCurrency.toUpperCase(),
            period: d.salaryPeriod,
            isVisible: d.salaryVisible,
          },
        }
      : {}),
    openings: Number(d.openings),
    ...(d.deadline
      ? { applicationDeadline: new Date(d.deadline).toISOString() }
      : {}),
    ...(d.scheduledPublishAt
      ? { scheduledPublishAt: new Date(d.scheduledPublishAt).toISOString() }
      : {}),
    minimumExperience: Number(d.minimumExperience),
    ...(d.maximumExperience
      ? { maximumExperience: Number(d.maximumExperience) }
      : {}),
    responsibilities: lines(d.responsibilities),
    requirements: lines(d.requirements),
    preferredQualifications: lines(d.preferredQualifications),
    educationRequirements: lines(d.educationRequirements),
    skills: d.skills.map((s) => ({
      name: s.name.trim(),
      required: s.required,
      minimumProficiency: s.minimumProficiency,
      minimumYearsOfExperience: Number(s.minimumYearsOfExperience),
      weight: Number(s.weight),
    })),
    applicationQuestions: d.questions.map((q) => ({
      question: q.question.trim(),
      type: q.type,
      required: q.required,
      options: ['single-choice', 'multiple-choice'].includes(q.type)
        ? lines(q.options)
        : [],
    })),
    assessmentRequired: d.assessmentRequired,
    resumeRequired: d.resumeRequired,
    minimumProfileCompletion: Number(d.minimumProfileCompletion),
  };
}
export const statusMeta = (s: JobView['status']) =>
  (
    ({
      draft: ['Draft', 'neutral'],
      'pending-review': ['Pending review', 'warning'],
      published: ['Published', 'success'],
      paused: ['Paused', 'warning'],
      closed: ['Closed', 'neutral'],
      rejected: ['Changes requested', 'danger'],
      archived: ['Archived', 'neutral'],
      unknown: ['Unknown status', 'neutral'],
    }) as const
  )[s];
export function allowedActions(
  status: JobView['status'],
  permissions: readonly string[],
  verified: boolean,
) {
  const has = (p: string) => permissions.includes(p);
  return {
    edit: has('jobs.update') && (status === 'draft' || status === 'rejected'),
    submit: has('jobs.publish') && verified && status === 'draft',
    pause: has('jobs.publish') && status === 'published',
    resume: has('jobs.publish') && verified && status === 'paused',
    close:
      has('jobs.publish') && (status === 'published' || status === 'paused'),
    archive: has('jobs.delete') && (status === 'draft' || status === 'closed'),
  };
}
