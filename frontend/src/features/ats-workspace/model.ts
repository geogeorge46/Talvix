export const applicationStatuses = [
  'submitted',
  'under-review',
  'shortlisted',
  'assessment-pending',
  'assessment-in-progress',
  'assessment-completed',
  'interview-scheduled',
  'interview-completed',
  'offer-pending',
  'offer-sent',
  'offer-accepted',
  'offer-declined',
  'hired',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];
export const transitions: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  submitted: ['under-review', 'rejected'],
  'under-review': ['shortlisted', 'rejected'],
  shortlisted: ['assessment-pending', 'interview-scheduled', 'rejected'],
  'assessment-pending': ['assessment-in-progress', 'rejected'],
  'assessment-in-progress': ['assessment-completed'],
  'assessment-completed': ['shortlisted', 'interview-scheduled', 'rejected'],
  'interview-scheduled': ['interview-completed', 'rejected'],
  'interview-completed': ['offer-pending', 'rejected'],
  'offer-pending': ['offer-sent', 'rejected'],
  'offer-sent': ['offer-accepted', 'offer-declined'],
  'offer-accepted': ['hired'],
  hired: [],
  rejected: [],
  withdrawn: [],
  'offer-declined': [],
};
export const rejectionCategories = [
  'skills-mismatch',
  'experience-mismatch',
  'education-mismatch',
  'assessment-performance',
  'interview-performance',
  'position-filled',
  'candidate-unavailable',
  'other',
] as const;
type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
const text = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v : 0;
const scalar = (v: unknown) =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' && Number.isFinite(v)
      ? String(v)
      : '';
const list = (v: unknown) => (Array.isArray(v) ? v : []);
const strings = (v: unknown) =>
  list(v)
    .map((x) => (typeof x === 'string' ? x : text(obj(x).name)))
    .filter(Boolean);
const date = (v: unknown) => text(v) || undefined;
const status = (v: unknown): ApplicationStatus | 'unknown' =>
  applicationStatuses.includes(v as ApplicationStatus)
    ? (v as ApplicationStatus)
    : 'unknown';
export const labelStatus = (v: string) =>
  v
    .split('-')
    .map((x) => x[0]?.toUpperCase() + x.slice(1))
    .join(' ');
export interface ApplicationRow {
  id: string;
  number: string;
  profileId?: string | undefined;
  candidateName: string;
  jobTitle: string;
  skills: string[];
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  status: ApplicationStatus | 'unknown';
  submittedAt?: string | undefined;
  lastChangedAt?: string | undefined;
  rating: number;
  tags: string[];
  assignedCount: number;
}
export function toApplicationRow(v: unknown): ApplicationRow {
  const x = obj(v),
    c = obj(x.candidateSnapshot),
    m = obj(x.skillMatch);
  return {
    id: text(x._id),
    number: text(x.applicationNumber),
    profileId: text(x.candidateProfile) || undefined,
    candidateName: text(c.fullName) || 'Candidate',
    jobTitle: text(obj(x.jobSnapshot).title) || 'Role unavailable',
    skills: strings(c.skills),
    matchScore: num(m.score),
    matchedSkills: strings(m.matchedSkills),
    missingSkills: strings(m.missingRequiredSkills),
    status: status(x.status),
    submittedAt: date(x.submittedAt),
    lastChangedAt: date(x.lastStatusChangedAt),
    rating: num(x.recruiterRating),
    tags: strings(x.tags),
    assignedCount: list(x.assignedRecruiters).length,
  };
}
export interface HistoryItem {
  from?: string | undefined;
  to: string;
  date?: string | undefined;
  reason?: string | undefined;
}
export interface EvidenceItem {
  title: string;
  subtitle?: string | undefined;
  detail?: string | undefined;
  meta?: string | undefined;
}
export interface ApplicationDetail extends ApplicationRow {
  source: string;
  coverLetter?: string | undefined;
  answers: { question: string; answer: string }[];
  resume?: { fileName: string; uploadedAt?: string | undefined } | undefined;
  education: EvidenceItem[];
  experience: EvidenceItem[];
  projects: EvidenceItem[];
  certifications: EvidenceItem[];
  history: HistoryItem[];
}
const evidence = (
  v: unknown,
  kind: 'education' | 'experience' | 'projects' | 'certifications',
): EvidenceItem[] =>
  list(v).map((raw) => {
    const x = obj(raw);
    if (kind === 'education')
      return {
        title: text(x.degree) || 'Education',
        subtitle: text(x.institution),
        detail: text(x.fieldOfStudy),
        meta: [scalar(x.startYear), scalar(x.endYear)]
          .filter(Boolean)
          .join('–'),
      };
    if (kind === 'experience')
      return {
        title: text(x.title) || 'Experience',
        subtitle: text(x.company),
        detail: text(x.description),
        meta: [text(x.startDate), text(x.endDate)].filter(Boolean).join(' – '),
      };
    if (kind === 'projects')
      return {
        title: text(x.title) || 'Project',
        detail: text(x.description),
        meta: strings(x.technologies).join(', '),
      };
    return {
      title: text(x.name) || 'Certification',
      subtitle: text(x.issuingOrganization) || text(x.issuer),
      meta: [text(x.issueDate), text(x.expirationDate) || text(x.expiryDate)]
        .filter(Boolean)
        .join(' – '),
    };
  });
export function toApplicationDetail(v: unknown): ApplicationDetail {
  const x = obj(v),
    c = obj(x.candidateSnapshot),
    r = obj(x.resumeSnapshot);
  return {
    ...toApplicationRow(v),
    source: text(x.source) || 'talvix',
    coverLetter: text(x.coverLetter) || undefined,
    answers: list(x.answers)
      .map((a) => {
        const y = obj(a);
        return {
          question:
            text(y.question) || text(y.questionText) || 'Application question',
          answer: Array.isArray(y.answer)
            ? strings(y.answer).join(', ')
            : String(y.answer ?? ''),
        };
      })
      .filter((a) => a.answer),
    resume: text(r.fileName)
      ? { fileName: text(r.fileName), uploadedAt: date(r.uploadedAt) }
      : undefined,
    education: evidence(c.education, 'education'),
    experience: evidence(c.experience, 'experience'),
    projects: evidence(c.projects, 'projects'),
    certifications: evidence(c.certifications, 'certifications'),
    history: list(x.statusHistory)
      .map((h) => {
        const y = obj(h);
        return {
          from: text(y.from) || undefined,
          to: text(y.to),
          date: date(y.changedAt),
          reason: text(y.reason) || undefined,
        };
      })
      .filter((h) => h.to),
  };
}
export interface CandidateRow {
  id: string;
  name: string;
  avatar?: string | undefined;
  headline: string;
  location: string;
  skills: string[];
  completion: number;
  availability: string;
  preferredRoles: string[];
  jobTypes: string[];
}
export interface CandidateDetail extends CandidateRow {
  bio?: string | undefined;
  education: EvidenceItem[];
  experience: EvidenceItem[];
  projects: EvidenceItem[];
  certifications: EvidenceItem[];
  skillDetails: { name: string; proficiency: string; years: number }[];
  preferredLocations: string[];
  noticeDays?: number | undefined;
}
export function toCandidate(v: unknown): CandidateDetail {
  const x = obj(v),
    u = obj(x.user),
    l = obj(x.location);
  const skillDetails = list(x.skills)
    .map((s) => {
      const y = obj(s);
      return {
        name: text(y.name),
        proficiency: text(y.proficiency),
        years: num(y.yearsOfExperience),
      };
    })
    .filter((s) => s.name);
  return {
    id: text(x._id),
    name: text(u.fullName) || 'Candidate',
    avatar: text(u.avatar) || undefined,
    headline: text(x.headline) || 'Profile headline not provided',
    bio: text(x.bio) || undefined,
    location:
      [text(l.city), text(l.state), text(l.country)]
        .filter(Boolean)
        .join(', ') || 'Location not provided',
    skills: skillDetails.map((s) => s.name),
    skillDetails,
    completion: num(x.profileCompletion),
    availability: text(x.availability) || 'Not specified',
    preferredRoles: strings(x.preferredRoles),
    jobTypes: strings(x.preferredJobTypes),
    preferredLocations: strings(x.preferredLocations),
    noticeDays:
      typeof x.noticePeriodDays === 'number' ? x.noticePeriodDays : undefined,
    education: evidence(x.education, 'education'),
    experience: evidence(x.experience, 'experience'),
    projects: evidence(x.projects, 'projects'),
    certifications: evidence(x.certifications, 'certifications'),
  };
}
export interface PageInfo {
  page: number;
  pages: number;
  total: number;
}
export const toPage = (v: unknown, fallback = 1): PageInfo => {
  const x = obj(v);
  return {
    page: num(x.page) || fallback,
    pages: num(x.pages) || num(x.totalPages) || 1,
    total: num(x.total),
  };
};
export const formatDate = (v?: string) =>
  v
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(v),
      )
    : 'Not available';
