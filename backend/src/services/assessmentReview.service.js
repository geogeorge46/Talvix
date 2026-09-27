import { Application } from '../models/Application.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { cancelReminders } from './reminderEvent.service.js';
const companyAttempt = async (company, id) => { const attempt = await AssessmentAttempt.findOne({ _id: id, company }).populate('assignment'); if (!attempt) throw new AppError('Assessment attempt not found', 404); return attempt; };
export const listPendingReviews = (company) => AssessmentAttempt.find({ company, status: 'review-pending' }).sort({ submittedAt: 1 });
export const getReviewAttempt = (company, id) => companyAttempt(company, id);
export const scoreQuestion = async (company, id, questionId, input) => {
  const attempt = await companyAttempt(company, id);
  if (attempt.status !== 'review-pending') throw new AppError('Attempt is not pending review', 409);
  const result = attempt.questionResults.find((item) => item.questionId.equals(questionId));
  if (!result || !result.requiresManualReview) throw new AppError('Reviewable question not found', 404);
  if (input.rubricScores) {
    // Rubric-based scoring path (work-sample questions)
    const snapshotQuestion = attempt.assignment.assessmentSnapshot?.questions?.find(
      (q) => q.questionId.toString() === questionId.toString(),
    );
    const rubric = snapshotQuestion?.rubric;
    if (!rubric?.criteria?.length) throw new AppError('This question does not have a rubric', 400);
    const criteriaMap = new Map(rubric.criteria.map((c) => [c.name, c]));
    if (input.rubricScores.length !== rubric.criteria.length)
      throw new AppError('All rubric criteria must be scored', 400);
    for (const score of input.rubricScores) {
      const criterion = criteriaMap.get(score.criterionName);
      if (!criterion) throw new AppError(`Unknown rubric criterion: ${score.criterionName}`, 400);
      if (score.awardedMarks > criterion.maxMarks)
        throw new AppError(`Score for "${score.criterionName}" exceeds maximum (${criterion.maxMarks})`, 400);
    }
    const totalWeight = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = input.rubricScores.reduce((sum, s) => {
      const c = criteriaMap.get(s.criterionName);
      return sum + (c.weight * s.awardedMarks / c.maxMarks);
    }, 0);
    result.awardedMarks = Math.round((result.marks * weightedSum / totalWeight) * 100) / 100;
    result.rubricScores = input.rubricScores.map((s) => ({
      criterionName: s.criterionName,
      awardedMarks: s.awardedMarks,
      maxMarks: criteriaMap.get(s.criterionName).maxMarks,
      feedback: s.feedback ?? '',
    }));
    result.feedback = input.feedback ?? '';
    result.requiresManualReview = false;
  } else {
    // Plain marks scoring path (long-answer, file-upload, etc.)
    if (input.awardedMarks > result.marks) throw new AppError('Awarded marks cannot exceed question marks', 400);
    result.awardedMarks = input.awardedMarks;
    result.feedback = input.feedback ?? '';
    result.requiresManualReview = false;
  }
  await attempt.save();
  return result;
};
export const completeReview = async (company, id, reviewer) => { const attempt = await companyAttempt(company, id); if (attempt.status !== 'review-pending') throw new AppError('Attempt is not pending review', 409); if (attempt.questionResults.some((item) => item.requiresManualReview)) throw new AppError('Every subjective question must be reviewed', 409); const assignment = await AssessmentAssignment.findOne({ _id: attempt.assignment, company }); const subjectiveScore = attempt.questionResults.filter((item) => ['long-answer', 'coding', 'file-upload', 'work-sample'].includes(item.questionType)).reduce((sum, item) => sum + item.awardedMarks, 0); const totalScore = Math.max(0, attempt.evaluation.objectiveScore + subjectiveScore + attempt.evaluation.codingScore - attempt.evaluation.negativeMarks); const percentage = Math.min(100, totalScore / assignment.assessmentSnapshot.totalMarks * 100); attempt.evaluation.subjectiveScore = subjectiveScore; attempt.evaluation.totalScore = totalScore; attempt.evaluation.percentage = percentage; attempt.evaluation.passed = percentage >= assignment.assessmentSnapshot.passingPercentage; attempt.evaluation.reviewedBy = reviewer; attempt.evaluation.reviewedAt = new Date(); attempt.status = 'completed'; attempt.completedAt = new Date(); assignment.status = 'completed'; assignment.completedAt = new Date(); if (assignment.bestPercentage === undefined || percentage > assignment.bestPercentage) { assignment.bestAttempt = attempt.id; assignment.bestScore = totalScore; assignment.bestPercentage = percentage; assignment.passed = attempt.evaluation.passed; } await Promise.all([attempt.save(), assignment.save()]); const application = await Application.findById(assignment.application); if (application?.status === 'assessment-in-progress') { changeApplicationStatus(application, 'assessment-completed', reviewer, 'Assessment review completed'); await application.save(); } return attempt; };
export const releaseResult = async (company, assignmentId, actor) => { const assignment = await AssessmentAssignment.findOne({ _id: assignmentId, company, status: 'completed' }); if (!assignment) throw new AppError('Completed assessment assignment not found', 404); if (assignment.resultReleasedAt) return assignment; assignment.resultReleasedAt = new Date(); assignment.resultReleasedBy = actor; await assignment.save(); await cancelReminders(`assessment.reminder:${assignment.id}:`); await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.ASSESSMENT_RESULT_RELEASED, actor: String(actor), company: String(company), recipientIds: [String(assignment.candidate)], payload: { assessmentId: String(assignment.assessment), assignmentId: String(assignment.id), attemptId: String(assignment.bestAttempt ?? assignment.latestAttempt), applicationId: String(assignment.application), candidateId: String(assignment.candidate), assessmentTitle: assignment.assessmentSnapshot.title, percentage: assignment.bestPercentage, passed: assignment.passed, actionUrl: `/candidate/assessments/${assignment.id}` }, deduplicationKey: `assessment.result-released:${assignment.id}:${assignment.resultReleasedAt.toISOString()}` }); return assignment; };
