const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const optionalText = (value: unknown) =>
  typeof value === 'string' && value ? value : undefined;
const id = (value: unknown) =>
  text(record(value).id ?? record(value)._id ?? value);
const rows = (value: unknown) => (Array.isArray(value) ? value : []);

export interface CandidateProfile {
  id: string;
  headline: string | undefined;
  bio: string | undefined;
  phone: string | undefined;
  dateOfBirth: string | undefined;
  gender: string | undefined;
  location: {
    city: string | undefined;
    state: string | undefined;
    country: string | undefined;
  };
  profileVisibility: 'public' | 'recruiters-only' | 'private';
  availability: 'immediately' | 'notice-period' | 'unavailable' | undefined;
  noticePeriodDays: number | undefined;
  preferredRoles: string[];
  preferredJobTypes: string[];
  preferredLocations: string[];
  socialLinks: {
    github: string | undefined;
    linkedin: string | undefined;
    portfolio: string | undefined;
  };
  expectedSalary:
    { minimum: number; maximum: number; currency: string } | undefined;
  skills: {
    id: string;
    name: string;
    proficiency: string;
    yearsOfExperience: number;
  }[];
  experience: {
    id: string;
    company: string;
    title: string;
    startDate: string | undefined;
    endDate: string | undefined;
    currentlyWorking: boolean;
  }[];
  education: {
    id: string;
    institution: string;
    degree: string;
    startYear: number | undefined;
    endYear: number | undefined;
    currentlyStudying: boolean;
  }[];
  projects: {
    id: string;
    title: string;
    description: string | undefined;
  }[];
  certifications: {
    id: string;
    name: string;
    issuingOrganization: string;
    expirationDate: string | undefined;
  }[];
  resumeDocument?: string | undefined;
  resume?: { url: string; displayName?: string | undefined } | undefined;
}
export const toCandidateProfile = (value: unknown): CandidateProfile => {
  const v = record(value),
    location = record(v.location);
  const visibility = v.profileVisibility;
  return {
    id: id(v),
    headline: optionalText(v.headline),
    bio: optionalText(v.bio),
    phone: optionalText(v.phone),
    dateOfBirth: optionalText(v.dateOfBirth),
    gender: optionalText(v.gender),
    location: {
      city: optionalText(location.city),
      state: optionalText(location.state),
      country: optionalText(location.country),
    },
    profileVisibility:
      visibility === 'public' || visibility === 'private'
        ? visibility
        : 'recruiters-only',
    availability:
      v.availability === 'immediately' ||
      v.availability === 'notice-period' ||
      v.availability === 'unavailable'
        ? v.availability
        : undefined,
    noticePeriodDays:
      typeof v.noticePeriodDays === 'number' ? v.noticePeriodDays : undefined,
    preferredRoles: rows(v.preferredRoles).filter(
      (x): x is string => typeof x === 'string',
    ),
    preferredJobTypes: rows(v.preferredJobTypes).filter(
      (x): x is string => typeof x === 'string',
    ),
    preferredLocations: rows(v.preferredLocations).filter(
      (x): x is string => typeof x === 'string',
    ),
    socialLinks: {
      github: optionalText(record(v.socialLinks).github),
      linkedin: optionalText(record(v.socialLinks).linkedin),
      portfolio: optionalText(record(v.socialLinks).portfolio),
    },
    expectedSalary: Object.keys(record(v.expectedSalary)).length
      ? {
          minimum: Number(record(v.expectedSalary).minimum ?? 0),
          maximum: Number(record(v.expectedSalary).maximum ?? 0),
          currency: text(record(v.expectedSalary).currency),
        }
      : undefined,
    skills: rows(v.skills).map((x) => {
      const a = record(x);
      return {
        id: id(a),
        name: text(a.name),
        proficiency: text(a.proficiency),
        yearsOfExperience: Number(a.yearsOfExperience ?? 0),
      };
    }),
    experience: rows(v.experience).map((x) => {
      const a = record(x);
      return {
        id: id(a),
        company: text(a.company),
        title: text(a.title),
        startDate: optionalText(a.startDate),
        endDate: optionalText(a.endDate),
        currentlyWorking: a.currentlyWorking === true,
      };
    }),
    education: rows(v.education).map((x) => {
      const a = record(x);
      return {
        id: id(a),
        institution: text(a.institution),
        degree: text(a.degree),
        startYear: typeof a.startYear === 'number' ? a.startYear : undefined,
        endYear: typeof a.endYear === 'number' ? a.endYear : undefined,
        currentlyStudying: a.currentlyStudying === true,
      };
    }),
    projects: rows(v.projects).map((x) => {
      const a = record(x);
      return {
        id: id(a),
        title: text(a.title),
        description: optionalText(a.description),
      };
    }),
    certifications: rows(v.certifications).map((x) => {
      const a = record(x);
      return {
        id: id(a),
        name: text(a.name),
        issuingOrganization: text(a.issuingOrganization),
        expirationDate: optionalText(a.expirationDate),
      };
    }),
    resumeDocument: optionalText(v.resumeDocument),
    resume: v.resume ? { url: text(record(v.resume).url), displayName: optionalText(record(v.resume).displayName) } : undefined,
  };
};

export interface PublicJob {
  id: string;
  title: string;
  companyName: string;
  location: string | undefined;
  employmentType: string | undefined;
  workMode: string | undefined;
  description: string | undefined;
  closingDate: string | undefined;
  status: string | undefined;
  resumeRequired?: boolean;
  questions: { id: string; question: string; required: boolean }[];
}
export const toPublicJob = (value: unknown): PublicJob => {
  const v = record(value),
    company = record(v.company),
    loc = record(v.location);
  return {
    id: id(v),
    title: text(v.title),
    companyName: text(v.companyName ?? company.name),
    location:
      optionalText(v.location) ??
      ([loc.city, loc.country].filter(Boolean).join(', ') || undefined),
    employmentType: optionalText(v.employmentType),
    workMode: optionalText(v.workMode),
    description: optionalText(v.description),
    closingDate: optionalText(v.closingDate ?? v.applicationDeadline),
    status: optionalText(v.status),
    resumeRequired: v.resumeRequired === true,
    questions: rows(v.applicationQuestions ?? v.questions).map((x) => {
      const q = record(x);
      return {
        id: id(q),
        question: text(q.question ?? q.label),
        required: q.required === true,
      };
    }),
  };
};

export interface SafeApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: string;
  appliedAt: string | undefined;
  updatedAt: string | undefined;
}
export const toSafeApplication = (value: unknown): SafeApplication => {
  const v = record(value),
    job = record(v.job),
    snapshot = record(v.jobSnapshot),
    company = record(job.company);
  return {
    id: id(v),
    jobId: id(v.jobId ?? job),
    jobTitle: text(job.title ?? snapshot.title),
    companyName: text(company.name ?? snapshot.companyName),
    status: text(v.status),
    appliedAt: optionalText(v.appliedAt ?? v.createdAt),
    updatedAt: optionalText(v.updatedAt),
  };
};
export interface SafeTimeline {
  from: string | undefined;
  to: string;
  changedAt: string;
}
export const toSafeTimeline = (value: unknown): SafeTimeline => {
  const v = record(value);
  return {
    from: optionalText(v.from),
    to: text(v.to),
    changedAt: text(v.changedAt),
  };
};

export interface SafeNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string | undefined;
  createdAt: string;
  read: boolean;
  archived: boolean;
  target: string | undefined;
}
const safeTarget = (
  type: string,
  data: Record<string, unknown>,
): string | undefined => {
  const objectId = /^[a-f\d]{24}$/i;
  const mapping: [RegExp, string, string][] = [
    [/assessment/i, 'assignmentId', '/candidate/assessments/'],
    [/interview/i, 'processId', '/candidate/interviews/'],
    [/offer/i, 'offerId', '/candidate/offers/'],
    [/application/i, 'applicationId', '/candidate/applications/'],
  ];
  for (const [pattern, key, prefix] of mapping) {
    const value = data[key];
    if (pattern.test(type) && typeof value === 'string' && objectId.test(value))
      return prefix + value;
  }
  return undefined;
};
export const toSafeNotification = (value: unknown): SafeNotification => {
  const v = record(value),
    type = text(v.type),
    data = record(v.data);
  return {
    id: id(v),
    title: text(v.title),
    message: text(v.message),
    type,
    category: optionalText(v.category),
    createdAt: text(v.createdAt),
    read: v.isRead === true || v.read === true,
    archived: v.isArchived === true || v.archived === true,
    target: safeTarget(type, data),
  };
};
export const candidateModelInternals = { safeTarget };
export interface SafeNotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  digestEnabled: boolean;
  digestFrequency: 'daily' | 'weekly';
  timezone: string;
  preferredHour: number;
  quietHoursEnabled: boolean;
  quietStartHour: number;
  quietEndHour: number;
}
export const toSafeNotificationPreferences = (
  value: unknown,
): SafeNotificationPreferences => {
  const v = record(value),
    global = record(v.global),
    digest = record(v.digest),
    quiet = record(v.quietHours);
  return {
    inAppEnabled: global.inAppEnabled !== false,
    emailEnabled: global.emailEnabled !== false,
    digestEnabled: digest.enabled === true,
    digestFrequency: digest.frequency === 'weekly' ? 'weekly' : 'daily',
    timezone: typeof digest.timezone === 'string' ? digest.timezone : 'UTC',
    preferredHour:
      typeof digest.preferredHour === 'number' ? digest.preferredHour : 9,
    quietHoursEnabled: quiet.enabled === true,
    quietStartHour: typeof quiet.startHour === 'number' ? quiet.startHour : 22,
    quietEndHour: typeof quiet.endHour === 'number' ? quiet.endHour : 7,
  };
};
