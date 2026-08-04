import * as service from '../services/assessmentWorkflow.service.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { executeCode } from '../services/codeExecution.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (action) => async (request, response, next) => {
  try {
    return await action(request, response);
  } catch (error) {
    return next(error);
  }
};

const meta = (request) => ({
  startIp: request.ip,
  lastIp: request.ip,
  userAgent: request.get('user-agent') ?? ''
});

export const startMyAttempt = handle(async (r, s) => s.status(201).json({ success: true, message: 'Assessment attempt started successfully', data: { attempt: await service.startAttempt(r.user.id, r.params.assignmentId, meta(r)) } }));
export const myAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment attempt retrieved successfully', data: { attempt: await service.getAttempt(r.user.id, r.params.attemptId) } }));
export const saveMyAnswer = handle(async (r, s) => s.json({ success: true, message: 'Answer saved successfully', data: { savedAt: await service.saveAnswer(r.user.id, r.params.attemptId, r.body, meta(r)) } }));
export const submitMyAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment submitted successfully', data: { attempt: await service.submitAttempt(r.user.id, r.params.attemptId) } }));
export const myResult = handle(async (r, s) => s.json({ success: true, message: 'Assessment result retrieved successfully', data: { result: await service.getMyResult(r.user.id, r.params.attemptId) } }));

export const logSuspiciousEvent = handle(async (r, s) => {
  return s.json({
    success: true,
    message: 'Suspicious event logged successfully',
    data: await service.logSuspiciousEvent(r.user.id, r.params.attemptId, r.body, meta(r))
  });
});

export const executeCodeInAttempt = handle(async (r, s) => {
  const attempt = await AssessmentAttempt.findOne({ _id: r.params.attemptId, candidate: r.user.id });
  if (!attempt) throw new AppError('Assessment attempt not found', 404);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);

  const assignment = await AssessmentAssignment.findById(attempt.assignment);
  const question = assignment.assessmentSnapshot.questions.find((q) => q.questionId.toString() === r.body.questionId);
  if (!question) throw new AppError('Question not found in assessment attempt', 404);

  const publicTestCases = question.coding?.testCases?.filter(tc => !tc.isHidden) || [];

  const limits = {
    timeLimit: question.coding?.timeLimit,
    memoryLimit: question.coding?.memoryLimit
  };

  const result = await executeCode({
    code: r.body.code,
    language: r.body.language,
    testCases: publicTestCases,
    limits
  });

  return s.json({
    success: true,
    message: 'Code executed successfully',
    data: { result }
  });
});
