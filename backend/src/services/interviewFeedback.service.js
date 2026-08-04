import mongoose from 'mongoose';
import { InterviewFeedback } from '../models/InterviewFeedback.js';
import { InterviewRound } from '../models/InterviewRound.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { Company } from '../models/Company.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { aggregateRecommendation, averageScore, calculateWeightedScore, aggregateRoundFeedback } from '../utils/interviewScoring.js';

const assigned = async (c, rid, u) => {
  const r = await InterviewRound.findOne({ _id: rid, company: c, interviewers: u });
  if (!r) throw new AppError('Interview round not found', 404);
  return r;
};

const verifyFeedbackAccess = async (c, r, u) => {
  const company = await Company.findById(c);
  const isOwner = company?.owner.toString() === u.toString();

  const jobObj = await mongoose.model('Job').findById(r.job);
  const isHiringManager = jobObj?.hiringManager?.toString() === u.toString();

  const isInterviewer = r.interviewers.some((id) => id.toString() === u.toString());

  if (!isOwner && !isHiringManager && !isInterviewer) {
    throw new AppError('Unauthorized access to interview feedback', 403);
  }

  return { isOwner, isHiringManager, isInterviewer };
};

export const listFeedback = (c, u) => InterviewFeedback.find({ company: c, interviewer: u });

export const listScorecards = async (c, u, overdue = false) => {
  const rounds = await InterviewRound.find({
    company: c,
    interviewers: u,
    status: { $in: ['scheduled', 'in-progress', 'awaiting-feedback'] },
  }).lean();
  const roundIds = rounds.map((r) => r._id);
  const [feedback, schedules] = await Promise.all([
    InterviewFeedback.find({ round: { $in: roundIds }, interviewer: u }).select('+privateNotes').lean(),
    InterviewSchedule.find({ round: { $in: roundIds }, company: c }).select('round startTime endTime status version').lean(),
  ]);
  const feedbackByRound = new Map(feedback.map((f) => [String(f.round), f]));
  const scheduleByRound = new Map(schedules.map((s) => [String(s.round), s]));
  const now = new Date();
  return rounds.flatMap((r) => {
    const f = feedbackByRound.get(String(r._id));
    if (f?.submitted) return [];
    const s = scheduleByRound.get(String(r._id));
    const isOverdue = Boolean(s && s.endTime < now);
    if (overdue !== isOverdue) return [];
    return [
      {
        id: String(r._id),
        round: String(r._id),
        process: String(r.process),
        name: r.name,
        type: r.type,
        status: r.status,
        dueAt: s?.endTime,
        overdue: isOverdue,
        schedule: s && {
          id: String(s._id),
          startTime: s.startTime,
          endTime: s.endTime,
          status: s.status,
          version: s.version,
        },
        scorecard: { criteria: r.scorecardTemplate.criteria },
        feedback: f && {
          id: String(f._id),
          version: f.version,
          scores: f.scores,
          recommendation: f.recommendation,
          strengths: f.strengths,
          concerns: f.concerns,
          privateNotes: f.privateNotes,
          candidateVisibleFeedback: f.candidateVisibleFeedback,
          lastEditedAt: f.lastEditedAt,
        },
      },
    ];
  });
};

export const roundFeedback = async (c, rid, u) => {
  const r = await InterviewRound.findOne({ _id: rid, company: c });
  if (!r) throw new AppError('Interview round not found', 404);

  const { isOwner, isHiringManager } = await verifyFeedbackAccess(c, r, u);

  const query = { round: rid };
  if (!isOwner && !isHiringManager) {
    query.interviewer = u;
  }

  const feedbackList = await InterviewFeedback.find(query);
  const submittedList = await InterviewFeedback.find({ round: rid, submitted: true });
  const aggregation = aggregateRoundFeedback(submittedList);

  return {
    feedback: feedbackList,
    aggregation,
  };
};

export const saveFeedback = async (c, rid, u, b) => {
  const r = await assigned(c, rid, u);
  let f = await InterviewFeedback.findOne({ round: rid, interviewer: u }).select('+privateNotes');
  if (f?.submitted) throw new AppError('Submitted feedback is immutable', 409);
  const criteria = new Map(r.scorecardTemplate.criteria.map((x) => [x.id, x]));
  if (b.scores.some((x) => !criteria.has(x.criterionId))) {
    throw new AppError('Feedback contains an invalid criterion', 400);
  }
  const scores = b.scores.map((x) => {
    const criterion = criteria.get(x.criterionId);
    if (x.score > criterion.maximumScore) {
      throw new AppError('Criterion score exceeds its maximum', 400);
    }
    return {
      ...x,
      criterionName: criterion.name,
      category: criterion.category,
      weight: criterion.weight,
      maximumScore: criterion.maximumScore,
    };
  });
  const data = {
    ...b,
    scores,
    weightedScore: calculateWeightedScore(scores),
    process: r.process,
    round: r.id,
    schedule: r.scheduledInterview,
    application: r.application,
    candidate: r.candidate,
    company: c,
    interviewer: u,
    lastEditedAt: new Date(),
  };
  if (f) {
    f.set(data);
    await f.save();
    return f;
  }
  return InterviewFeedback.create(data);
};

export const submitFeedback = async (c, rid, u, reqMeta = {}) => {
  const r = await assigned(c, rid, u);
  const f = await InterviewFeedback.findOne({ round: rid, interviewer: u });
  if (!f) throw new AppError('Feedback draft not found', 404);
  if (f.submitted) return f;
  const scored = new Set(f.scores.map((x) => x.criterionId));
  if (r.scorecardTemplate.criteria.some((x) => x.required && !scored.has(x.id))) {
    throw new AppError('All required criteria must be scored', 400);
  }
  f.submitted = true;
  f.submittedAt = new Date();
  await f.save();
  r.status = 'awaiting-feedback';
  await r.save();

  await AuditLog.create({
    action: 'interview.feedback_submitted',
    actor: u,
    company: c,
    application: r.application,
    newValue: { roundId: rid, feedbackId: f.id },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown',
  });

  return f;
};

export const startRound = async (c, pid, rid, u) => {
  const r = await InterviewRound.findOne({ _id: rid, process: pid, company: c, interviewers: u });
  if (!r) throw new AppError('Interview round not found', 404);
  if (r.status !== 'scheduled') throw new AppError('Interview round cannot be started', 409);
  r.status = 'in-progress';
  r.startedAt = new Date();
  await r.save();
  return r;
};

export const completeRound = async (c, pid, rid, u, reason, reqMeta = {}) => {
  const r = await InterviewRound.findOne({ _id: rid, process: pid, company: c });
  if (!r) throw new AppError('Interview round not found', 404);
  if (!['in-progress', 'awaiting-feedback'].includes(r.status)) {
    throw new AppError('Interview round cannot be completed', 409);
  }
  const feedback = await InterviewFeedback.find({ round: r.id, submitted: true });
  if (feedback.length < r.interviewers.length && !reason) {
    throw new AppError('Required interviewer feedback is incomplete', 409);
  }
  r.roundScore = averageScore(feedback.map((x) => x.weightedScore));
  r.roundRecommendation = aggregateRecommendation(feedback.map((x) => x.recommendation));
  r.status = 'completed';
  r.completedAt = new Date();
  r.audit.push({ action: 'completed', actor: u, reason, at: new Date() });
  await r.save();

  await AuditLog.create({
    action: 'interview.scorecard_completed',
    actor: u,
    company: c,
    application: r.application,
    newValue: { roundId: rid, score: r.roundScore, recommendation: r.roundRecommendation },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown',
  });

  await AuditLog.create({
    action: 'interview.completed',
    actor: u,
    company: c,
    application: r.application,
    newValue: { roundId: rid },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown',
  });

  return r;
};
