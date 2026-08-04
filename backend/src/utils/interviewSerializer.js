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
export const serializeRecruiterProcess = (value, rounds, schedules) => {
  const x = plain(value);
  const scheduleByRound = new Map(schedules.map((s) => [String(s.round), s]));
  return {
    id: id(x),
    applicationId: id(x.application),
    candidateId: id(x.candidate),
    jobId: id(x.job),
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
      .map((r) =>
        serializeRecruiterRound(r, scheduleByRound.get(String(r._id))),
      ),
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
  schedules,
  feedback = [],
) => ({
  id: process.id,
  status: process.status,
  application: process.application,
  job: process.job,
  feedbackReleased: process.feedbackReleased,
  rounds: rounds.map((round) => ({
    id: round.id,
    name: round.name,
    type: round.type,
    status: round.status,
    order: round.order,
    schedule: schedules.find((item) => item.round.toString() === round.id)
      ?.toObject
      ? serializeCandidateSchedule(
          schedules.find((item) => item.round.toString() === round.id),
        )
      : undefined,
    ...(process.feedbackReleased && {
      feedback: feedback
        .filter((item) => item.round.toString() === round.id)
        .map((item) => ({
          candidateVisibleFeedback: item.candidateVisibleFeedback,
          weightedScore: item.weightedScore,
        })),
    }),
  })),
});
