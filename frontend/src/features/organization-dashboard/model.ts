export const APPLICATION_STAGES = [
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

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];
export type DashboardRange = 7 | 30 | 90;

export interface DashboardFilters {
  range: DashboardRange;
  q: string;
  stage: ApplicationStage | '';
  page: number;
}
export interface PaginationModel {
  page: number;
  total: number;
  pages: number;
}
export interface CandidateViewModel {
  id: string;
  name: string;
  initials: string;
  role: string;
  skills: string[];
  matchedSkills: string[];
  skillMatch: number | null;
  stage: ApplicationStage | 'unknown';
  stageLabel: string;
  submittedAt: string | null;
}
export interface PipelineStage {
  id: string;
  label: string;
  count: number;
}
export interface InterviewViewModel {
  id: string;
  startTime: string;
  endTime: string | null;
  mode: string;
  status: string;
  place: string | null;
}

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown) => (typeof value === 'string' ? value : null);
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const id = (value: unknown) => {
  const direct = text(value);
  if (direct) return direct;
  const nested = object(value);
  return text(nested?._id) ?? '';
};
const label = (value: string) =>
  value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function parseDashboardFilters(
  params: URLSearchParams,
): DashboardFilters {
  const rangeNumber = Number(params.get('range'));
  const range: DashboardRange =
    rangeNumber === 7 || rangeNumber === 90 ? rangeNumber : 30;
  const rawStage = params.get('stage') ?? '';
  const stage = APPLICATION_STAGES.includes(rawStage as ApplicationStage)
    ? (rawStage as ApplicationStage)
    : '';
  const rawPage = Number(params.get('page'));
  return {
    range,
    q: (params.get('q') ?? '').trim().slice(0, 100),
    stage,
    page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  };
}

export function dashboardDateRange(days: DashboardRange, now = new Date()) {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}
export function upcomingDateRange(days: DashboardRange, now = new Date()) {
  const from = new Date(now);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + days);
  return { from: from.toISOString(), to: to.toISOString() };
}
export function currentWeekRange(now = new Date()) {
  const from = new Date(now);
  const day = (from.getUTCDay() + 6) % 7;
  from.setUTCDate(from.getUTCDate() - day);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + 7);
  to.setUTCMilliseconds(-1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function toCandidateViewModel(
  value: unknown,
): CandidateViewModel | null {
  const source = object(value);
  const candidate = object(source?.candidateSnapshot);
  const job = object(source?.jobSnapshot);
  const match = object(source?.skillMatch);
  const applicationId = id(source?._id);
  const name = text(candidate?.fullName)?.trim();
  if (!applicationId || !name) return null;
  const skills = Array.isArray(candidate?.skills)
    ? candidate.skills
        .map((skill) => text(skill) ?? text(object(skill)?.name))
        .filter((skill): skill is string => Boolean(skill))
        .slice(0, 6)
    : [];
  const matchedSkills = Array.isArray(match?.matchedSkills)
    ? match.matchedSkills
        .map((skill) => text(skill) ?? text(object(skill)?.name))
        .filter((skill): skill is string => Boolean(skill))
        .slice(0, 6)
    : [];
  const rawStage = text(source?.status) ?? '';
  const stage = APPLICATION_STAGES.includes(rawStage as ApplicationStage)
    ? (rawStage as ApplicationStage)
    : 'unknown';
  return {
    id: applicationId,
    name,
    initials:
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?',
    role: text(job?.title) ?? 'Role unavailable',
    skills,
    matchedSkills,
    skillMatch: number(match?.score),
    stage,
    stageLabel: stage === 'unknown' ? 'Status unavailable' : label(stage),
    submittedAt: text(source?.submittedAt),
  };
}

export function toCandidatesEnvelope(value: unknown) {
  const source = object(value);
  const pagination = object(source?.pagination);
  return {
    candidates: Array.isArray(source?.applications)
      ? source.applications
          .map(toCandidateViewModel)
          .filter((item): item is CandidateViewModel => item !== null)
      : [],
    pagination: {
      page: number(pagination?.page) ?? 1,
      total: number(pagination?.total) ?? 0,
      pages: number(pagination?.pages) ?? 0,
    } satisfies PaginationModel,
  };
}

const PIPELINE_GROUPS = [
  { id: 'applied', label: 'Applied', statuses: ['submitted'] },
  {
    id: 'screening',
    label: 'Screening',
    statuses: ['under-review', 'shortlisted'],
  },
  {
    id: 'assessment',
    label: 'Assessment',
    statuses: [
      'assessment-pending',
      'assessment-in-progress',
      'assessment-completed',
    ],
  },
  {
    id: 'interview',
    label: 'Interview',
    statuses: ['interview-scheduled', 'interview-completed'],
  },
  {
    id: 'offer',
    label: 'Offer',
    statuses: [
      'offer-pending',
      'offer-sent',
      'offer-accepted',
      'offer-declined',
    ],
  },
  { id: 'hired', label: 'Hired', statuses: ['hired'] },
] as const;
export function toPipeline(value: unknown) {
  const source = object(value);
  const counts = object(source?.pipeline) ?? {};
  return {
    total: number(source?.total) ?? 0,
    stages: PIPELINE_GROUPS.map((group) => ({
      id: group.id,
      label: group.label,
      count: group.statuses.reduce(
        (sum, status) => sum + (number(counts[status]) ?? 0),
        0,
      ),
    })) satisfies PipelineStage[],
  };
}
export function toInterviews(value: unknown): InterviewViewModel[] {
  const source = object(value);
  if (!Array.isArray(source?.schedules)) return [];
  return source.schedules.flatMap((entry) => {
    const schedule = object(entry);
    const scheduleId = id(schedule?._id);
    const startTime = text(schedule?.startTime);
    if (!scheduleId || !startTime) return [];
    const location = object(schedule?.location);
    const place = [text(location?.name), text(location?.city)]
      .filter(Boolean)
      .join(', ');
    return [
      {
        id: scheduleId,
        startTime,
        endTime: text(schedule?.endTime),
        mode: text(schedule?.mode) ?? 'unspecified',
        status: text(schedule?.status) ?? 'unknown',
        place: place || null,
      },
    ];
  });
}
export function readNumber(value: unknown, key: string) {
  return number(object(value)?.[key]);
}
export function readJobs(value: unknown) {
  const source = object(value);
  const rows = Array.isArray(source?.jobs) ? source.jobs : [];
  const total = number(object(source?.pagination)?.total) ?? rows.length;
  const active = rows.filter((row) => {
    const status = text(object(row)?.status);
    return status === 'published' || status === 'paused';
  }).length;
  return { active, total, partial: total > rows.length };
}
