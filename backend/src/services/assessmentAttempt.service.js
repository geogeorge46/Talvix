import { Application } from '../models/Application.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AppError } from '../shared/errors/AppError.js';
import { gradeAttempt } from '../utils/assessmentGrading.js';
import { serializeActiveAttempt, serializeCandidateResult } from '../utils/assessmentSerializer.js';
import { getEffectiveAttemptExpiry, isAttemptExpired } from '../utils/assessmentTiming.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
const shuffle = (values) => { const output = [...values]; for (let index = output.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [output[index], output[other]] = [output[other], output[index]]; } return output; };
const ownAttempt = async (candidate, id) => { const attempt = await AssessmentAttempt.findOne({ _id: id, candidate }); if (!attempt) throw new AppError('Assessment attempt not found', 404); const assignment = await AssessmentAssignment.findById(attempt.assignment); return { attempt, assignment }; };
const completeApplication = async (assignment, actor) => { const application = await Application.findById(assignment.application); if (application?.status === 'assessment-in-progress') { changeApplicationStatus(application, 'assessment-completed', actor, 'Assessment evaluation completed'); await application.save(); } };
export const startAttempt = async (candidate, assignmentId, requestMeta) => { const assignment = await AssessmentAssignment.findOne({ _id: assignmentId, candidate }); if (!assignment) throw new AppError('Assessment assignment not found', 404); const now = new Date(); if (assignment.status === 'cancelled' || assignment.expiresAt <= now) throw new AppError('Assessment assignment is unavailable', 409); if (assignment.availableFrom > now) throw new AppError('Assessment is not available yet', 409); const active = await AssessmentAttempt.findOne({ assignment, status: 'in-progress' }); if (active) return serializeActiveAttempt(active, assignment.assessmentSnapshot); if (assignment.attemptsUsed >= assignment.assessmentSnapshot.maximumAttempts) throw new AppError('Maximum assessment attempts reached', 409); const questionIds = assignment.assessmentSnapshot.questions.map((question) => question.questionId); const order = assignment.assessmentSnapshot.shuffleQuestions ? shuffle(questionIds) : questionIds; const optionOrders = Object.fromEntries(assignment.assessmentSnapshot.questions.filter((question) => question.options?.length).map((question) => [question.questionId.toString(), assignment.assessmentSnapshot.shuffleOptions ? shuffle(question.options.map((option) => option.id)) : question.options.map((option) => option.id)])); let attempt; try { attempt = await AssessmentAttempt.create({ assignment: assignment.id, assessment: assignment.assessment, application: assignment.application, candidate, company: assignment.company, attemptNumber: assignment.attemptsUsed + 1, status: 'in-progress', startedAt: now, expiresAt: getEffectiveAttemptExpiry(now, assignment.assessmentSnapshot.durationMinutes, assignment.expiresAt), questionOrder: order, optionOrders, integrity: requestMeta }); } catch (error) { if (error.code === 11000) { const existing = await AssessmentAttempt.findOne({ assignment, status: 'in-progress' }); if (existing) return serializeActiveAttempt(existing, assignment.assessmentSnapshot); } throw error; } assignment.attemptsUsed += 1; assignment.latestAttempt = attempt.id; assignment.status = 'in-progress'; await assignment.save(); const application = await Application.findById(assignment.application); if (application?.status === 'assessment-pending') { changeApplicationStatus(application, 'assessment-in-progress', candidate, 'Candidate started assessment'); await application.save(); } return serializeActiveAttempt(attempt, assignment.assessmentSnapshot); };
export const getAttempt = async (candidate, id) => { const { attempt, assignment } = await ownAttempt(candidate, id); if (attempt.status === 'in-progress' && isAttemptExpired(attempt)) await submitAttempt(candidate, id, 'time-expired'); return serializeActiveAttempt(await AssessmentAttempt.findById(id), assignment.assessmentSnapshot); };
export const saveAnswer = async (candidate, id, input, requestMeta) => {
  const { attempt, assignment } = await ownAttempt(candidate, id);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, id, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }
  const question = assignment.assessmentSnapshot.questions.find((item) => item.questionId.toString() === input.questionId);
  if (!question) {
    attempt.integrity.suspiciousEvents.push({ type: 'invalid-question-access', detail: input.questionId });
    await attempt.save();
    throw new AppError('Question not found in attempt', 400);
  }
  if (['single-choice', 'multiple-choice', 'output-prediction'].includes(question.type)) {
    if (question.options?.length) {
      const selected = Array.isArray(input.answer) ? input.answer : [input.answer];
      if (selected.some((value) => !question.options.some((option) => option.id === value))) {
        throw new AppError('Answer contains an invalid option', 400);
      }
    }
  }
  if (['coding', 'sql', 'debugging'].includes(question.type)) {
    if (!input.code || !input.language || !question.coding?.languageSupport?.includes(input.language)) {
      throw new AppError('Supported language and code are required', 400);
    }
  }
  if (question.type === 'file-upload') {
    if (!input.answer) {
      throw new AppError('File upload reference is required', 400);
    }
  }
  const answer = { ...input, questionType: question.type, savedAt: new Date() };
  const index = attempt.answers.findIndex((item) => item.questionId.toString() === input.questionId);
  if (index >= 0) attempt.answers[index] = answer;
  else attempt.answers.push(answer);
  attempt.integrity.saveCount += 1;
  attempt.integrity.lastIp = requestMeta.lastIp;
  await attempt.save();
  return answer.savedAt;
};
export const submitAttempt = async (candidate, id, reason = 'candidate-submit', adapter) => { const { attempt, assignment } = await ownAttempt(candidate, id); if (['completed', 'review-pending', 'auto-evaluated'].includes(attempt.status)) return attempt; if (attempt.status !== 'in-progress') throw new AppError('Attempt cannot be submitted', 409); if (isAttemptExpired(attempt) && !attempt.answers.length) { attempt.status = 'expired'; attempt.submissionReason = 'time-expired'; attempt.submittedAt = new Date(); assignment.status = 'expired'; await Promise.all([attempt.save(), assignment.save()]); return attempt; } const grading = await gradeAttempt(assignment.assessmentSnapshot, attempt.answers, adapter); attempt.questionResults = grading.questionResults; attempt.evaluation = grading.evaluation; attempt.submissionReason = isAttemptExpired(attempt) ? 'time-expired' : reason; attempt.submittedAt = new Date(); attempt.status = grading.manual ? 'review-pending' : 'completed'; if (!grading.manual) attempt.completedAt = new Date(); assignment.status = grading.manual ? 'evaluating' : 'completed'; assignment.latestAttempt = attempt.id; if (!grading.manual && (assignment.bestPercentage === undefined || grading.evaluation.percentage > assignment.bestPercentage)) { assignment.bestAttempt = attempt.id; assignment.bestScore = grading.evaluation.totalScore; assignment.bestPercentage = grading.evaluation.percentage; assignment.passed = grading.evaluation.passed; } if (!grading.manual) assignment.completedAt = new Date(); await Promise.all([attempt.save(), assignment.save()]); if (!grading.manual) await completeApplication(assignment, candidate); return attempt; };
export const getMyResult = async (candidate, id) => { const { attempt, assignment } = await ownAttempt(candidate, id); if (attempt.status !== 'completed') throw new AppError('Assessment result is not complete', 409); if (!assignment.assessmentSnapshot.showResultImmediately && !assignment.resultReleasedAt) throw new AppError('Assessment result has not been released', 403); return serializeCandidateResult(attempt, assignment); };

export const logSuspiciousEvent = async (candidate, id, eventInput, requestMeta) => {
  const { attempt } = await ownAttempt(candidate, id);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);

  attempt.integrity.suspiciousEvents.push({
    type: eventInput.type,
    detail: eventInput.detail || '',
    at: new Date()
  });

  const events = attempt.integrity.suspiciousEvents;
  let score = 0;
  for (const e of events) {
    if (e.type === 'tab-switch') score += 15;
    else if (e.type === 'window-blur') score += 5;
    else if (['copy-paste', 'copy', 'paste'].includes(e.type)) score += 10;
    else if (e.type === 'right-click') score += 2;
    else if (e.type === 'multiple-login') score += 50;
    else score += 10;
  }
  attempt.integrity.cheatingRiskScore = Math.min(100, score);
  attempt.integrity.lastIp = requestMeta.lastIp || attempt.integrity.lastIp;
  await attempt.save();

  return { cheatingRiskScore: attempt.integrity.cheatingRiskScore, suspiciousEventsCount: events.length };
};
