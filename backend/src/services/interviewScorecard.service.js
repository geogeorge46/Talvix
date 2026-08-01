import { InterviewFeedback } from "../models/InterviewFeedback.js";
import { InterviewRound } from "../models/InterviewRound.js";
import { InterviewSchedule } from "../models/InterviewSchedule.js";
import { AppError } from "../shared/errors/AppError.js";
import { serializeScorecard } from "../utils/interviewSerializer.js";
export const getScorecard = async (company, roundId, interviewer) => {
  const round = await InterviewRound.findOne({
    _id: roundId,
    company,
    interviewers: interviewer,
  }).lean();
  if (!round) throw new AppError("Interview round not found", 404);
  const [schedule, feedback] = await Promise.all([
    InterviewSchedule.findOne({ round: roundId, company }).lean(),
    InterviewFeedback.findOne({ round: roundId, company, interviewer })
      .select("+privateNotes")
      .lean(),
  ]);
  return serializeScorecard(round, schedule, feedback);
};
export const listScorecards = async (company, interviewer, overdue = false) => {
  const rounds = await InterviewRound.find({
    company,
    interviewers: interviewer,
    status: { $in: ["scheduled", "in-progress", "awaiting-feedback"] },
  }).lean();
  const ids = rounds.map((round) => round._id);
  const [schedules, feedback] = await Promise.all([
    InterviewSchedule.find({ company, round: { $in: ids } }).lean(),
    InterviewFeedback.find({ company, interviewer, round: { $in: ids } })
      .select("+privateNotes")
      .lean(),
  ]);
  const scheduleByRound = new Map(
    schedules.map((item) => [String(item.round), item]),
  );
  const feedbackByRound = new Map(
    feedback.map((item) => [String(item.round), item]),
  );
  return rounds.flatMap((round) => {
    const ownFeedback = feedbackByRound.get(String(round._id));
    if (ownFeedback?.submitted) return [];
    const dto = serializeScorecard(
      round,
      scheduleByRound.get(String(round._id)),
      ownFeedback,
    );
    return dto.overdue === overdue ? [dto] : [];
  });
};
