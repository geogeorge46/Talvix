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
export interface DetailedEducation {
  institution: string;
  degree: string;
  fieldOfStudy?: string | undefined;
  startYear: number;
  endYear?: number | undefined;
  grade?: string | undefined;
  description?: string | undefined;
  source: 'snapshot' | 'profile';
}
export interface DetailedExperience {
  company: string;
  title: string;
  employmentType?: string | undefined;
  location?: string | undefined;
  startDate: string;
  endDate?: string | undefined;
  currentlyWorking?: boolean | undefined;
  description?: string | undefined;
  skills?: string[] | undefined;
  source: 'snapshot' | 'profile';
}
export interface DetailedProject {
  title: string;
  description?: string | undefined;
  technologies?: string[] | undefined;
  githubUrl?: string | undefined;
  liveUrl?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  source: 'snapshot' | 'profile';
}
export interface DetailedCertification {
  name: string;
  issuingOrganization: string;
  issueDate?: string | undefined;
  expirationDate?: string | undefined;
  credentialId?: string | undefined;
  credentialUrl?: string | undefined;
  source: 'snapshot' | 'profile';
}
export interface DetailedSocialLinks {
  github?: string | undefined;
  linkedin?: string | undefined;
  portfolio?: string | undefined;
  source: 'snapshot' | 'profile';
}
export interface ApplicationSkill {
  name: string;
  proficiency: string;
  yearsOfExperience: number;
}
export interface SkillMatchBreakdownItem {
  skill: string;
  required: boolean;
  candidateProficiency?: string | undefined;
  minimumProficiency?: string | undefined;
  candidateExperience?: number | undefined;
  minimumExperience?: number | undefined;
  weight: number;
  score: number;
}
export interface ApplicationDetail extends ApplicationRow {
  source: string;
  coverLetter?: string | undefined;
  answers: { question: string; answer: string }[];
  resume?: { fileName: string; uploadedAt?: string | undefined; documentId?: string | undefined } | undefined;
  education: DetailedEducation[];
  experience: DetailedExperience[];
  projects: DetailedProject[];
  certifications: DetailedCertification[];
  socialLinks?: DetailedSocialLinks | undefined;
  skillsDetail: ApplicationSkill[];
  skillMatchBreakdown: SkillMatchBreakdownItem[];
  history: HistoryItem[];
}

export function toApplicationDetail(v: unknown): ApplicationDetail {
  const x = obj(v),
    c = obj(x.candidateSnapshot),
    p = obj(x.candidateProfile),
    r = obj(x.resumeSnapshot);

  const getEvidence = <T>(
    snapshotItems: any[],
    profileItems: any[],
    mapFn: (item: any, source: 'snapshot' | 'profile') => T,
  ): T[] => {
    if (snapshotItems && snapshotItems.length > 0) {
      return snapshotItems.map((item) => mapFn(item, 'snapshot'));
    }
    if (profileItems && profileItems.length > 0) {
      return profileItems.map((item) => mapFn(item, 'profile'));
    }
    return [];
  };

  let socialLinks: DetailedSocialLinks | undefined = undefined;
  const sS = obj(c.socialLinks);
  const pS = obj(p.socialLinks);

  if (sS.github || sS.linkedin || sS.portfolio) {
    socialLinks = {
      github: text(sS.github) || undefined,
      linkedin: text(sS.linkedin) || undefined,
      portfolio: text(sS.portfolio) || undefined,
      source: 'snapshot',
    };
  } else if (pS.github || pS.linkedin || pS.portfolio) {
    socialLinks = {
      github: text(pS.github) || undefined,
      linkedin: text(pS.linkedin) || undefined,
      portfolio: text(pS.portfolio) || undefined,
      source: 'profile',
    };
  }

  const education = getEvidence<DetailedEducation>(
    list(c.education),
    list(p.education),
    (item, source) => {
      const y = obj(item);
      return {
        institution: text(y.institution) || 'Institution',
        degree: text(y.degree) || 'Degree',
        fieldOfStudy: text(y.fieldOfStudy) || undefined,
        startYear: num(y.startYear) || 0,
        endYear: num(y.endYear) || undefined,
        grade: text(y.grade) || undefined,
        description: text(y.description) || undefined,
        source,
      };
    },
  );

  const experience = getEvidence<DetailedExperience>(
    list(c.experience),
    list(p.experience),
    (item, source) => {
      const y = obj(item);
      return {
        company: text(y.company) || 'Company',
        title: text(y.title) || 'Title',
        employmentType: text(y.employmentType) || undefined,
        location: text(y.location) || undefined,
        startDate: text(y.startDate) || '',
        endDate: text(y.endDate) || undefined,
        currentlyWorking: Boolean(y.currentlyWorking),
        description: text(y.description) || undefined,
        skills: strings(y.skills),
        source,
      };
    },
  );

  const projects = getEvidence<DetailedProject>(
    list(c.projects),
    list(p.projects),
    (item, source) => {
      const y = obj(item);
      return {
        title: text(y.title) || 'Project',
        description: text(y.description) || undefined,
        technologies: strings(y.technologies),
        githubUrl: text(y.githubUrl) || undefined,
        liveUrl: text(y.liveUrl) || undefined,
        startDate: text(y.startDate) || undefined,
        endDate: text(y.endDate) || undefined,
        source,
      };
    },
  );

  const certifications = getEvidence<DetailedCertification>(
    list(c.certifications),
    list(p.certifications),
    (item, source) => {
      const y = obj(item);
      return {
        name: text(y.name) || 'Certification',
        issuingOrganization: text(y.issuingOrganization) || text(y.issuer) || '',
        issueDate: text(y.issueDate) || undefined,
        expirationDate: text(y.expirationDate) || text(y.expiryDate) || undefined,
        credentialId: text(y.credentialId) || undefined,
        credentialUrl: text(y.credentialUrl) || undefined,
        source,
      };
    },
  );

  const skillsDetail = getEvidence<ApplicationSkill>(
    list(c.skills),
    list(p.skills),
    (item) => {
      const y = obj(item);
      return {
        name: text(y.name) || '',
        proficiency: text(y.proficiency) || 'beginner',
        yearsOfExperience: num(y.yearsOfExperience) || 0,
      };
    },
  );

  const skillMatchBreakdown = list(obj(x.skillMatch).breakdown).map((b) => {
    const y = obj(b);
    return {
      skill: text(y.skill),
      required: Boolean(y.required),
      candidateProficiency: text(y.candidateProficiency) || undefined,
      minimumProficiency: text(y.minimumProficiency) || undefined,
      candidateExperience: num(y.candidateExperience) || 0,
      minimumExperience: num(y.minimumExperience) || 0,
      weight: num(y.weight) || 0,
      score: num(y.score) || 0,
    };
  });

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
      ? {
          fileName: text(r.fileName),
          uploadedAt: date(r.uploadedAt),
          documentId: text(x.resumeDocument) || undefined,
        }
      : undefined,
    education,
    experience,
    projects,
    certifications,
    socialLinks,
    skillsDetail,
    skillMatchBreakdown,
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
