const plain = (value) =>
  value?.toObject ? value.toObject() : JSON.parse(JSON.stringify(value));
const id = (value) =>
  value == null ? undefined : String(value._id ?? value.id ?? value);
export const serializeRecruiterSchedule = (value) => {
  if (!value) return undefined;
  const x = plain(value);
  return {
    id: id(x),
    timezone: x.timezone,
    startTime: x.startTime,
    endTime: x.endTime,
    durationMinutes: x.durationMinutes,
    mode: x.mode,
    meetingProvider: x.meetingProvider,
    meetingUrl: x.meetingUrl,
    phoneDetails: x.phoneDetails,
    location: x.location,
    candidateInstructions: x.candidateInstructions,
    status: x.status,
    candidateResponse: x.candidateResponse,
    version: x.version,
    interviewerIds: (x.interviewers ?? []).map(id),
  };
};
export const serializeRecruiterRound = (value, schedule) => {
  const x = plain(value);
  return {
    id: id(x),
    name: x.name,
    description: x.description,
    type: x.type,
    order: x.order,
    required: x.required,
    durationMinutes: x.durationMinutes,
    minimumInterviewers: x.minimumInterviewers,
    maximumInterviewers: x.maximumInterviewers,
    status: x.status,
    scheduledInterview: id(x.scheduledInterview) || (schedule ? id(schedule) : undefined),
    interviewerIds: (x.interviewers ?? []).map(id),
    scorecard: {
      criteria: (x.scorecardTemplate?.criteria ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        weight: c.weight,
        maximumScore: c.maximumScore,
        required: c.required,
      })),
    },
    roundScore: x.roundScore,
    roundRecommendation: x.roundRecommendation,
    startedAt: x.startedAt,
    completedAt: x.completedAt,
    cancelledAt: x.cancelledAt,
    cancellationReason: x.cancellationReason,
    noShow: x.noShow && {
      party: x.noShow.party,
      reason: x.noShow.reason,
      recordedAt: x.noShow.recordedAt,
    },
    schedule: serializeRecruiterSchedule(schedule),
  };
};
export const serializeRecruiterProcess = (value, rounds, schedules = []) => {
  const x = plain(value);
  const scheduleById = new Map((schedules || []).map((s) => [String(s._id ?? s.id), s]));
  const sortedSchedules = [...(schedules || [])].sort(
    (a, b) => (a.version ?? 0) - (b.version ?? 0) || new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
  );
  const scheduleByRound = new Map(sortedSchedules.map((s) => [String(s.round?._id ?? s.round), s]));
  const cand = x.candidate && typeof x.candidate === 'object' ? x.candidate : {};
  const app = x.application && typeof x.application === 'object' ? x.application : {};
  const j = x.job && typeof x.job === 'object' ? x.job : {};
  const candidateName = cand.fullName || app.candidateName || undefined;
  const candidateEmail = cand.email || undefined;
  const jobTitle = j.title || undefined;
  const applicationNumber = app.applicationNumber || undefined;

  return {
    id: id(x),
    applicationId: id(x.application),
    candidateId: id(x.candidate),
    candidateName,
    candidateEmail,
    jobId: id(x.job),
    jobTitle,
    applicationNumber,
    templateId: id(x.template),
    status: x.status,
    feedbackReleased: Boolean(x.feedbackReleased),
    overallScore: x.overallScore,
    calculatedRecommendation: x.calculatedRecommendation,
    overallRecommendation: x.overallRecommendation,
    finalizationReason: x.finalizationReason,
    cancellationReason: x.cancellationReason,
    createdAt: x.createdAt,
    completedAt: x.completedAt,
    rounds: rounds
      .sort((a, b) => a.order - b.order)
      .map((r) => {
        const schedId = String(r.scheduledInterview?._id ?? r.scheduledInterview ?? '');
        const schedule = scheduleById.get(schedId) || scheduleByRound.get(String(r._id ?? r.id));
        return serializeRecruiterRound(r, schedule);
      }),
  };
};
export const serializeScorecard = (round, schedule, feedback) => {
  const r = plain(round),
    f = feedback ? plain(feedback) : undefined;
  return {
    id: id(r),
    roundId: id(r),
    processId: id(r.process),
    name: r.name,
    type: r.type,
    status: r.status,
    dueAt: schedule?.endTime,
    overdue: Boolean(
      schedule?.endTime && new Date(schedule.endTime) < new Date(),
    ),
    schedule: serializeRecruiterSchedule(schedule),
    criteria: (r.scorecardTemplate?.criteria ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      category: c.category,
      weight: c.weight,
      maximumScore: c.maximumScore,
      required: c.required,
    })),
    feedback: f && {
      id: id(f),
      scores: (f.scores ?? []).map((s) => ({
        criterionId: s.criterionId,
        score: s.score,
        comment: s.comment,
      })),
      recommendation: f.recommendation,
      strengths: f.strengths ?? [],
      concerns: f.concerns ?? [],
      privateNotes: f.privateNotes,
      candidateVisibleFeedback: f.candidateVisibleFeedback,
      submitted: Boolean(f.submitted),
      submittedAt: f.submittedAt,
      lastEditedAt: f.lastEditedAt,
      version: f.version,
      attachments: (f.attachments ?? []).map(id),
    },
  };
};
export const serializeCandidateSchedule = (value) => {
  const data = plain(value);
  for (const key of [
    "interviewerInstructions",
    "meetingPassword",
    "audit",
    "company",
    "scheduledBy",
  ])
    delete data[key];
  delete data.interviewers;
  return data;
};
export const serializeCandidateProcess = (
  process,
  rounds,
  schedules = [],
  feedback = [],
) => {
  const scheduleById = new Map((schedules || []).map((s) => [String(s._id ?? s.id), s]));
  const sortedSchedules = [...(schedules || [])].sort(
    (a, b) => (a.version ?? 0) - (b.version ?? 0) || new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0)
  );
  const scheduleByRound = new Map(sortedSchedules.map((s) => [String(s.round?._id ?? s.round), s]));

  return {
    id: process.id ?? String(process._id ?? process),
    status: process.status,
    application: process.application,
    job: process.job,
    feedbackReleased: process.feedbackReleased,
    rounds: rounds
      .sort((a, b) => a.order - b.order)
      .map((round) => {
        const roundIdStr = String(round._id ?? round.id);
        const schedIdStr = String(round.scheduledInterview?._id ?? round.scheduledInterview ?? '');
        const scheduleDoc = scheduleById.get(schedIdStr) || scheduleByRound.get(roundIdStr);
        return {
          id: round.id ?? roundIdStr,
          name: round.name,
          type: round.type,
          status: round.status,
          order: round.order,
          schedule: scheduleDoc
            ? serializeCandidateSchedule(scheduleDoc)
            : undefined,
          ...(process.feedbackReleased && {
            feedback: feedback
              .filter((item) => String(item.round?._id ?? item.round) === roundIdStr)
              .map((item) => ({
                candidateVisibleFeedback: item.candidateVisibleFeedback,
                weightedScore: item.weightedScore,
              })),
          }),
        };
      }),
  };
};
