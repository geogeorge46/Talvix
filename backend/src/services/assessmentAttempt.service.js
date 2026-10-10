import { Application } from '../models/Application.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { TechnicalSubmission } from '../models/TechnicalSubmission.js';
import { AppError } from '../shared/errors/AppError.js';
import { gradeAttempt } from '../utils/assessmentGrading.js';
import { serializeActiveAttempt, serializeCandidateResult } from '../utils/assessmentSerializer.js';
import { getEffectiveAttemptExpiry, isAttemptExpired } from '../utils/assessmentTiming.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { broadcastAssessmentActivity } from './realtime.service.js';
import { executePublicCodingTests, executeAllCodingTests } from './codingExecution.service.js';
import { runDebuggingTests, submitDebuggingFix, getOriginalBuggyCode } from './debuggingExecution.service.js';
import { getSQLQuestionSchema, executePublicSQLQuery, executeAllSQLTests } from './sqlExecution.service.js';
import { saveSystemDesignSubmission } from './systemDesign.service.js';
import { saveWorkSampleSubmission } from './workSample.service.js';
import { queueAIEvaluation } from './technicalAI.service.js';
const mulberry32 = (seed) => {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedShuffle = (array, random) => {
  const output = [...array];
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
};
const getQId = (q) => String(q?.questionId || q?.id || q?._id || '');

const ownAttempt = async (candidate, id) => { const attempt = await AssessmentAttempt.findOne({ _id: id, candidate }); if (!attempt) throw new AppError('Assessment attempt not found', 404); const assignment = await AssessmentAssignment.findById(attempt.assignment); return { attempt, assignment }; };
const completeApplication = async (assignment, actor) => { const application = await Application.findById(assignment.application); if (application?.status === 'assessment-in-progress') { changeApplicationStatus(application, 'assessment-completed', actor, 'Assessment evaluation completed'); await application.save(); } };
export const startAttempt = async (candidate, assignmentId, requestMeta) => {
  const assignment = await AssessmentAssignment.findOne({ _id: assignmentId, candidate });
  if (!assignment) throw new AppError('Assessment assignment not found', 404);
  const now = new Date();
  if (assignment.status === 'cancelled' || assignment.expiresAt <= now) throw new AppError('Assessment assignment is unavailable', 409);
  if (assignment.availableFrom > now) throw new AppError('Assessment is not available yet', 409);
  
  const active = await AssessmentAttempt.findOne({ assignment, status: 'in-progress' });
  if (active) return serializeActiveAttempt(active, assignment.assessmentSnapshot);
  if (assignment.attemptsUsed >= assignment.assessmentSnapshot.maximumAttempts) throw new AppError('Maximum assessment attempts reached', 409);
  
  const seed = Math.floor(Math.random() * 2147483647) + 1;
  const random = mulberry32(seed);

  const questionIds = assignment.assessmentSnapshot.questions.map(getQId);
  const order = assignment.assessmentSnapshot.shuffleQuestions ? seedShuffle(questionIds, random) : questionIds;
  
  const optionOrders = Object.fromEntries(
    assignment.assessmentSnapshot.questions
      .filter((question) => question.options?.length)
      .map((question) => [
        getQId(question),
        assignment.assessmentSnapshot.shuffleOptions 
          ? seedShuffle(question.options.map((option) => option.id), random) 
          : question.options.map((option) => option.id)
      ])
  );
  
  let attempt;
  try {
    attempt = await AssessmentAttempt.create({ 
      assignment: assignment.id, 
      assessment: assignment.assessment, 
      application: assignment.application, 
      candidate, 
      company: assignment.company, 
      attemptNumber: assignment.attemptsUsed + 1, 
      status: 'in-progress', 
      startedAt: now, 
      expiresAt: getEffectiveAttemptExpiry(now, assignment.assessmentSnapshot.durationMinutes, assignment.expiresAt), 
      seed,
      questionOrder: order, 
      optionOrders, 
      integrity: requestMeta 
    });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await AssessmentAttempt.findOne({ assignment, status: 'in-progress' });
      if (existing) return serializeActiveAttempt(existing, assignment.assessmentSnapshot);
    }
    throw error;
  }
  
  assignment.attemptsUsed += 1;
  assignment.latestAttempt = attempt.id;
  assignment.status = 'in-progress';
  await assignment.save();
  
  const application = await Application.findById(assignment.application);
  if (application?.status === 'assessment-pending') {
    changeApplicationStatus(application, 'assessment-in-progress', candidate, 'Candidate started assessment');
    await application.save();
  }
  
  broadcastAssessmentActivity(attempt.company, attempt.id, 'started', { candidate });
  return serializeActiveAttempt(attempt, assignment.assessmentSnapshot);
};
export const getAttempt = async (candidate, id) => { const { attempt, assignment } = await ownAttempt(candidate, id); if (attempt.status === 'in-progress' && isAttemptExpired(attempt)) await submitAttempt(candidate, id, 'time-expired'); return serializeActiveAttempt(await AssessmentAttempt.findById(id), assignment.assessmentSnapshot); };
export const saveAnswer = async (candidate, id, input, requestMeta) => {
  const { attempt, assignment } = await ownAttempt(candidate, id);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, id, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }
  const question = assignment.assessmentSnapshot.questions.find((item) => getQId(item) === (input.questionId || '').toString());
  if (!question) {
    attempt.integrity.suspiciousEvents.push({ type: 'invalid-question-access', detail: input.questionId });
    await attempt.save();
    throw new AppError('Question not found in attempt', 400);
  }
  if (['single-choice', 'multiple-choice', 'output-prediction'].includes(question.type)) {
    if (question.options?.length && input.answer !== undefined && input.answer !== null) {
      const selected = Array.isArray(input.answer) ? input.answer : [input.answer];
      if (selected.some((value) => !question.options.some((option) => option.id === value))) {
        throw new AppError('Answer contains an invalid option', 400);
      }
    }
  }
  if (['coding', 'sql', 'debugging'].includes(question.type)) {
    if (input.code === undefined || !input.language || !question.coding?.languageSupport?.includes(input.language)) {
      throw new AppError('Supported language and code are required', 400);
    }
  }
  if (question.type === 'file-upload') {
    if (!input.answer) {
      throw new AppError('File upload reference is required', 400);
    }
  }
  const answer = { ...input, questionType: question.type, savedAt: new Date() };
  const index = attempt.answers.findIndex((item) => (item.questionId || '').toString() === (input.questionId || '').toString());
  if (index >= 0) attempt.answers[index] = answer;
  else attempt.answers.push(answer);
  attempt.integrity.saveCount += 1;
  attempt.integrity.lastIp = requestMeta.lastIp;
  await attempt.save();
  broadcastAssessmentActivity(attempt.company, attempt.id, 'autosave', { questionId: input.questionId, timeSpentSeconds: input.timeSpentSeconds });
  return answer.savedAt;
};
export const submitAttempt = async (candidate, id, reason = 'candidate-submit', adapter) => {
  const { attempt, assignment } = await ownAttempt(candidate, id);
  if (['completed', 'review-pending', 'auto-evaluated'].includes(attempt.status)) return attempt;
  if (attempt.status !== 'in-progress') throw new AppError('Attempt cannot be submitted', 409);
  
  if (isAttemptExpired(attempt) && !attempt.answers.length) {
    attempt.status = 'expired';
    attempt.submissionReason = 'time-expired';
    attempt.submittedAt = new Date();
    assignment.status = 'expired';
    await Promise.all([attempt.save(), assignment.save()]);
    await completeApplication(assignment, candidate);
    return attempt;
  }
  
  const grading = await gradeAttempt(assignment.assessmentSnapshot, attempt.answers, adapter);
  attempt.questionResults = grading.questionResults;
  attempt.evaluation = grading.evaluation;
  attempt.submissionReason = isAttemptExpired(attempt) ? 'time-expired' : reason;
  attempt.submittedAt = new Date();
  attempt.status = grading.manual ? 'review-pending' : 'completed';
  if (!grading.manual) attempt.completedAt = new Date();
  assignment.status = grading.manual ? 'evaluating' : 'completed';
  assignment.latestAttempt = attempt.id;
  
  if (!grading.manual && (assignment.bestPercentage === undefined || grading.evaluation.percentage > assignment.bestPercentage)) {
    assignment.bestAttempt = attempt.id;
    assignment.bestScore = grading.evaluation.totalScore;
    assignment.bestPercentage = grading.evaluation.percentage;
    assignment.passed = grading.evaluation.passed;
  }
  
  if (!grading.manual) assignment.completedAt = new Date();
  await Promise.all([attempt.save(), assignment.save()]);
  await completeApplication(assignment, candidate);
  
  broadcastAssessmentActivity(attempt.company, attempt.id, 'submitted', { score: attempt.evaluation?.percentage });
  return attempt;
};
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

  broadcastAssessmentActivity(attempt.company, attempt.id, 'cheating_alert', { type: eventInput.type, cheatingRiskScore: attempt.integrity.cheatingRiskScore });

  return { cheatingRiskScore: attempt.integrity.cheatingRiskScore, suspiciousEventsCount: events.length };
};

export const getTechnicalDraft = async (candidate, attemptId, questionId) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);

  const sub = await TechnicalSubmission.findOne({ attempt: attempt.id, question: questionId });
  const attemptAnswer = attempt.answers.find((a) => (a.questionId || '').toString() === (questionId || '').toString());

  return {
    type: questionSnapshot.type,
    language: sub?.language || attemptAnswer?.language || (questionSnapshot.coding?.languageSupport?.[0] ?? 'javascript'),
    sourceCode: sub?.sourceCode || attemptAnswer?.code || (questionSnapshot.coding?.starterCode?.get?.(sub?.language) || questionSnapshot.coding?.starterCode?.[sub?.language] || ''),
    sqlQuery: sub?.sqlQuery || (typeof attemptAnswer?.answer === 'string' ? attemptAnswer.answer : ''),
    status: sub?.status || 'draft',
    savedAt: sub?.updatedAt || attemptAnswer?.savedAt || null,
  };
};

export const saveTechnicalDraft = async (candidate, attemptId, questionId, input, requestMeta) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);

  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: input.type || questionSnapshot.type,
      language: input.language || 'javascript',
      sourceCode: input.sourceCode ?? '',
      sqlQuery: input.sqlQuery ?? '',
      status: 'draft',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Sync with existing attempt.answers for backward compatibility
  await saveAnswer(
    candidate,
    attemptId,
    {
      questionId,
      code: input.sourceCode ?? input.sqlQuery ?? '',
      language: input.language || 'javascript',
      answer: input.type === 'sql' ? input.sqlQuery : input.sourceCode,
    },
    requestMeta
  );

  return sub;
};

export const submitTechnicalResponse = async (candidate, attemptId, questionId, input, requestMeta) => {
  const sub = await saveTechnicalDraft(candidate, attemptId, questionId, input, requestMeta);
  sub.status = 'submitted';
  sub.submittedAt = new Date();
  await sub.save();
  return sub;
};

export const runCodingQuestion = async (candidate, attemptId, questionId, input, adapter = null) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (!['coding', 'debugging'].includes(questionSnapshot.type)) {
    throw new AppError('Question is not a coding question', 400);
  }

  const result = await executePublicCodingTests({
    sourceCode: input.sourceCode,
    language: input.language,
    question: questionSnapshot,
    adapter,
  });

  await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: questionSnapshot.type,
      language: input.language,
      sourceCode: input.sourceCode,
      status: 'running',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result;
};

export const submitCodingQuestion = async (candidate, attemptId, questionId, input, adapter = null) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (!['coding', 'debugging'].includes(questionSnapshot.type)) {
    throw new AppError('Question is not a coding question', 400);
  }

  const result = await executeAllCodingTests({
    sourceCode: input.sourceCode,
    language: input.language,
    question: questionSnapshot,
    adapter,
  });

  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: questionSnapshot.type,
      language: input.language,
      sourceCode: input.sourceCode,
      status: 'submitted',
      submittedAt: new Date(),
      execution: {
        status: result.status,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
        runtimeMs: result.runtimeMs,
        memoryKb: result.memoryKb,
        testResults: result.testResults,
      },
      grading: {
        functionalScore: result.functionalScore,
        finalScore: result.finalScore,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await saveAnswer(
    candidate,
    attemptId,
    {
      questionId,
      code: input.sourceCode,
      language: input.language,
      answer: input.sourceCode,
    },
    { lastIp: '' }
  );

  queueAIEvaluation({ attemptId: attempt.id, questionId, adapter });

  return {
    status: sub.status,
    execution: {
      status: result.status,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      runtimeMs: result.runtimeMs,
      memoryKb: result.memoryKb,
    },
    grading: {
      functionalScore: result.functionalScore,
      finalScore: result.finalScore,
    },
  };
};

export const getSQLSchema = async (candidate, attemptId, questionId) => {
  const { assignment } = await ownAttempt(candidate, attemptId);
  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (questionSnapshot.type !== 'sql') throw new AppError('Question is not an SQL question', 400);

  return getSQLQuestionSchema(questionSnapshot);
};

export const runSQLQuestion = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (questionSnapshot.type !== 'sql') throw new AppError('Question is not an SQL question', 400);

  const result = await executePublicSQLQuery({
    sqlQuery: input.sqlQuery,
    question: questionSnapshot,
  });

  await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: 'sql',
      sqlQuery: input.sqlQuery,
      status: 'running',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result;
};

export const submitSQLQuestion = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (questionSnapshot.type !== 'sql') throw new AppError('Question is not an SQL question', 400);

  const result = await executeAllSQLTests({
    sqlQuery: input.sqlQuery,
    question: questionSnapshot,
  });

  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: 'sql',
      sqlQuery: input.sqlQuery,
      status: 'submitted',
      submittedAt: new Date(),
      execution: {
        status: result.status,
        runtimeMs: result.executionTimeMs,
        testResults: [result.matchDetails],
      },
      grading: {
        functionalScore: result.functionalScore,
        finalScore: result.finalScore,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await saveAnswer(
    candidate,
    attemptId,
    {
      questionId,
      code: input.sqlQuery,
      language: 'sql',
      answer: input.sqlQuery,
    },
    { lastIp: '' }
  );

  return {
    status: sub.status,
    passed: result.passed,
    reason: result.reason,
    grading: {
      functionalScore: result.functionalScore,
      finalScore: result.finalScore,
    },
  };
};

export const runDebuggingQuestion = async (candidate, attemptId, questionId, input, adapter = null) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (questionSnapshot.type !== 'debugging') {
    throw new AppError('Question is not a debugging question', 400);
  }

  const result = await runDebuggingTests({
    sourceCode: input.sourceCode,
    language: input.language,
    question: questionSnapshot,
    adapter,
  });

  const originalSourceCode = getOriginalBuggyCode(questionSnapshot, input.language);

  await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: 'debugging',
      language: input.language,
      sourceCode: input.sourceCode,
      originalSourceCode,
      bugCategory: result.bugCategory,
      status: 'running',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result;
};

export const submitDebuggingQuestion = async (candidate, attemptId, questionId, input, adapter = null) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  if (isAttemptExpired(attempt)) {
    await submitAttempt(candidate, attemptId, 'time-expired');
    throw new AppError('Assessment time has expired', 409);
  }

  const questionSnapshot = assignment.assessmentSnapshot.questions.find(
    (q) => getQId(q) === (questionId || '').toString()
  );
  if (!questionSnapshot) throw new AppError('Question not found in assessment snapshot', 404);
  if (questionSnapshot.type !== 'debugging') {
    throw new AppError('Question is not a debugging question', 400);
  }

  const result = await submitDebuggingFix({
    sourceCode: input.sourceCode,
    language: input.language,
    question: questionSnapshot,
    adapter,
  });

  const originalSourceCode = getOriginalBuggyCode(questionSnapshot, input.language);

  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt: attempt.id, question: questionId },
    {
      assessment: assignment.assessment,
      assignment: assignment.id,
      attempt: attempt.id,
      question: questionId,
      candidate,
      type: 'debugging',
      language: input.language,
      sourceCode: input.sourceCode,
      originalSourceCode,
      bugCategory: result.bugCategory,
      status: 'submitted',
      submittedAt: new Date(),
      execution: {
        status: result.status,
        passedTests: result.passedTests,
        totalTests: result.totalTests,
        runtimeMs: result.runtimeMs,
        memoryKb: result.memoryKb,
        testResults: result.testResults,
      },
      grading: {
        functionalScore: result.functionalScore,
        finalScore: result.finalScore,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await saveAnswer(
    candidate,
    attemptId,
    {
      questionId,
      code: input.sourceCode,
      language: input.language,
      answer: input.sourceCode,
    },
    { lastIp: '' }
  );

  queueAIEvaluation({ attemptId: attempt.id, questionId, adapter });

  return {
    status: sub.status,
    execution: {
      status: result.status,
      passedTests: result.passedTests,
      totalTests: result.totalTests,
      runtimeMs: result.runtimeMs,
      memoryKb: result.memoryKb,
    },
    grading: {
      functionalScore: result.functionalScore,
      finalScore: result.finalScore,
    },
  };
};

export const saveSystemDesignDraft = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  return saveSystemDesignSubmission({
    attempt: attempt.id,
    questionId,
    candidate,
    assessment: assignment.assessment,
    assignment: assignment.id,
    systemDesignInput: input,
    isFinal: false,
  });
};

export const submitSystemDesignResponse = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  return saveSystemDesignSubmission({
    attempt: attempt.id,
    questionId,
    candidate,
    assessment: assignment.assessment,
    assignment: assignment.id,
    systemDesignInput: input,
    isFinal: true,
  });
};

export const saveWorkSampleDraft = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  return saveWorkSampleSubmission({
    attempt: attempt.id,
    questionId,
    candidate,
    assessment: assignment.assessment,
    assignment: assignment.id,
    workSampleInput: input,
    isFinal: false,
  });
};

export const submitWorkSampleResponse = async (candidate, attemptId, questionId, input) => {
  const { attempt, assignment } = await ownAttempt(candidate, attemptId);
  if (attempt.status !== 'in-progress') throw new AppError('Attempt is not active', 409);
  return saveWorkSampleSubmission({
    attempt: attempt.id,
    questionId,
    candidate,
    assessment: assignment.assessment,
    assignment: assignment.id,
    workSampleInput: input,
    isFinal: true,
  });
};





