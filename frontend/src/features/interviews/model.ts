export type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict =>
  v && typeof v === 'object' ? (v as Dict) : {};
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const id = (v: unknown) => str(obj(v).id || obj(v)._id || v);
const list = (v: unknown) => (Array.isArray(v) ? v : []);
export const label = (v: string) =>
  v.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export interface Criterion {
  id: string;
  name: string;
  category: string;
  weight: number;
  maximumScore: number;
  required: boolean;
}
export interface RoundPlan {
  id: string;
  name: string;
  description: string;
  type: string;
  durationMinutes: number;
  order: number;
  required: boolean;
  criteria: Criterion[];
}
export interface Template {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  isReusable: boolean;
  usageCount: number;
  rounds: RoundPlan[];
}
export interface Process {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  status: string;
  feedbackReleased: boolean;
  overallScore?: number | undefined;
  overallRecommendation: string;
  cancellationReason: string;
  rounds: RoundPlan[];
  liveRoundIds: string[];
}
export interface SafeSchedule {
  id: string;
  timezone: string;
  startTime: string;
  endTime: string;
  mode: string;
  meetingProvider: string;
  meetingUrl: string;
  phoneNumber: string;
  locationName: string;
  locationAddress: string;
  candidateInstructions: string;
  status: string;
  candidateResponse: string;
}
export interface CandidateRound {
  id: string;
  name: string;
  type: string;
  status: string;
  order: number;
  schedule?: SafeSchedule | undefined;
  feedback: { text: string; weightedScore?: number | undefined }[];
}
export interface CandidateProcess {
  id: string;
  status: string;
  applicationId: string;
  jobId: string;
  feedbackReleased: boolean;
  rounds: CandidateRound[];
}
const criterion = (v: unknown): Criterion => {
  const x = obj(v);
  return {
    id: str(x.id),
    name: str(x.name),
    category: str(x.category),
    weight: Number(x.weight) || 0,
    maximumScore: Number(x.maximumScore) || 0,
    required: x.required !== false,
  };
};
const round = (v: unknown): RoundPlan => {
  const x = obj(v),
    score = obj(x.scorecardTemplate);
  return {
    id: id(x),
    name: str(x.name) || 'Interview round',
    description: str(x.description),
    type: str(x.type),
    durationMinutes: Number(x.durationMinutes) || 0,
    order: Number(x.order) || 0,
    required: x.required !== false,
    criteria: list(score.criteria).map(criterion),
  };
};
export const toTemplate = (v: unknown): Template => {
  const x = obj(v);
  return {
    id: id(x),
    name: str(x.name) || 'Untitled template',
    description: str(x.description),
    isActive: x.isActive !== false,
    isReusable: x.isReusable !== false,
    usageCount: Number(x.usageCount) || 0,
    rounds: list(x.rounds)
      .map(round)
      .sort((a, b) => a.order - b.order),
  };
};
export const toProcess = (v: unknown): Process => {
  const x = obj(v),
    snap = obj(x.templateSnapshot);
  return {
    id: id(x),
    applicationId: id(x.application),
    candidateId: id(x.candidate),
    jobId: id(x.job),
    status: str(x.status),
    feedbackReleased: x.feedbackReleased === true,
    overallScore:
      typeof x.overallScore === 'number' ? x.overallScore : undefined,
    overallRecommendation: str(x.overallRecommendation),
    cancellationReason: str(x.cancellationReason),
    rounds: list(snap.rounds)
      .map(round)
      .sort((a, b) => a.order - b.order),
    liveRoundIds: list(x.rounds).map(id),
  };
};
export const safeSchedule = (v: unknown): SafeSchedule => {
  const x = obj(v),
    phone = obj(x.phoneDetails),
    loc = obj(x.location);
  return {
    id: id(x),
    timezone: str(x.timezone),
    startTime: str(x.startTime),
    endTime: str(x.endTime),
    mode: str(x.mode),
    meetingProvider: str(x.meetingProvider),
    meetingUrl: str(x.meetingUrl),
    phoneNumber: str(phone.phoneNumber),
    locationName: str(loc.name),
    locationAddress: str(loc.address),
    candidateInstructions: str(x.candidateInstructions),
    status: str(x.status),
    candidateResponse: str(x.candidateResponse),
  };
};
export const toCandidateProcess = (v: unknown): CandidateProcess => {
  const x = obj(v);
  return {
    id: id(x),
    status: str(x.status),
    applicationId: id(x.application),
    jobId: id(x.job),
    feedbackReleased: x.feedbackReleased === true,
    rounds: list(x.rounds)
      .map((r) => {
        const y = obj(r);
        return {
          id: id(y),
          name: str(y.name),
          type: str(y.type),
          status: str(y.status),
          order: Number(y.order) || 0,
          schedule: y.schedule ? safeSchedule(y.schedule) : undefined,
          feedback:
            x.feedbackReleased === true
              ? list(y.feedback).map((f) => {
                  const z = obj(f);
                  return {
                    text: str(z.candidateVisibleFeedback),
                    weightedScore:
                      typeof z.weightedScore === 'number'
                        ? z.weightedScore
                        : undefined,
                  };
                })
              : [],
        };
      })
      .sort((a, b) => a.order - b.order),
  };
};
export const formatZoned = (iso: string, zone: string) => {
  if (!iso) return 'Not scheduled';
  try {
    return `${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(iso))} (${zone})`;
  } catch {
    return `${new Date(iso).toLocaleString()} (${zone || 'timezone unavailable'})`;
  }
};
export const zonedLocalToIso = (value: string, zone: string) => {
  if (!value || !zone)
    throw new Error('A local time and IANA timezone are required.');
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = (datePart ?? '').split('-').map(Number);
  const [hour, minute] = (timePart ?? '').split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    ![year, month, day, hour, minute].every(Number.isFinite)
  )
    throw new Error('Invalid local date and time.');
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const partsFor = (ms: number) =>
    Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(ms))
        .map((p) => [p.type, p.value]),
    );
  for (let i = 0; i < 3; i++) {
    const p = partsFor(instant);
    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
    );
    instant += target - represented;
  }
  const check = partsFor(instant);
  if (
    Number(check.year) !== year ||
    Number(check.month) !== month ||
    Number(check.day) !== day ||
    Number(check.hour) !== hour ||
    Number(check.minute) !== minute
  )
    throw new Error('This local time does not exist in the selected timezone.');
  return new Date(instant).toISOString();
};
export const validateSlots = (
  slots: { startTime: string; endTime: string }[],
) =>
  slots.some(
    (s) =>
      !s.startTime ||
      !s.endTime ||
      new Date(s.endTime) <= new Date(s.startTime),
  )
    ? 'Each end time must follow its start time.'
    : [...slots]
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .some((s, i, a) => {
            const previous = a[i - 1];
            return Boolean(
              previous && new Date(previous.endTime) > new Date(s.startTime),
            );
          })
      ? 'Availability slots cannot overlap.'
      : '';
export const candidatePrivateKeys = [
  'interviewers',
  'interviewerInstructions',
  'meetingPassword',
  'privateNotes',
  'strengths',
  'concerns',
  'recommendation',
  'audit',
  'company',
  'scheduledBy',
];
