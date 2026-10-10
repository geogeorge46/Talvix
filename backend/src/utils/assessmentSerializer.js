import { getRemainingSeconds } from './assessmentTiming.js';

const publicQuestion = (question, optionOrder) => {
  if (!question) return null;
  const qId = String(question.questionId || question.id || question._id || '');
  const output = {
    id: qId,
    questionId: qId,
    type: question.type,
    title: question.title,
    prompt: question.prompt,
    description: question.description,
    marks: question.marks,
    isRequired: question.isRequired,
    options: question.options,
  };

  if (optionOrder?.length && question.options?.length) {
    output.options = optionOrder.map((id) => question.options.find((item) => item.id === id)).filter(Boolean);
  }

  if (question.coding) {
    output.coding = {
      languageSupport: question.coding.languageSupport,
      starterCode: question.coding.starterCode,
      buggyCode: question.coding.buggyCode,
      functionName: question.coding.functionName,
      testCases: (question.coding.testCases || [])
        .filter((item) => !item.isHidden)
        .map((item) => ({
          input: item.input,
          expectedOutput: item.expectedOutput,
          weight: item.weight,
        })),
    };
  }

  if (question.sqlConfig || question.type === 'sql') {
    output.sql = {
      datasetId: question.sqlConfig?.datasetId,
      schemaInfo: question.sqlConfig?.schemaInfo,
      sampleQueries: question.sqlConfig?.sampleQueries,
    };
  }

  if (question.debugging || question.type === 'debugging') {
    output.debugging = {
      starterCode: question.debugging?.starterCode || question.coding?.starterCode,
      buggyCode: question.debugging?.buggyCode || question.coding?.buggyCode || question.debugging?.brokenCode,
      bugCategory: question.debugging?.bugCategory || question.coding?.bugCategory,
    };
  }

  if (question.deliverable) {
    output.deliverable = {
      type: question.deliverable.type,
      instructions: question.deliverable.instructions,
      allowedFormats: question.deliverable.allowedFormats,
      maxFiles: question.deliverable.maxFiles,
      maxFileSizeBytes: question.deliverable.maxFileSizeBytes,
      referenceAssets: question.deliverable.referenceAssets,
    };
  }

  if (question.rubric?.criteria?.length) {
    output.rubricCriteria = question.rubric.criteria.map((c) => ({
      name: c.name,
      maxMarks: c.maxMarks,
      weight: c.weight,
    }));
  }

  return output;
};

export const serializeCandidateAssignment = (assignment) => {
  let status = assignment.status;
  if (['assigned', 'available', 'in-progress'].includes(status) && assignment.expiresAt && new Date(assignment.expiresAt) < new Date()) {
    status = 'expired';
  }
  return {
    id: assignment.id,
    assessmentId: assignment.assessment,
    title: assignment.assessmentSnapshot.title,
    description: assignment.assessmentSnapshot.description,
    instructions: assignment.assessmentSnapshot.instructions,
    durationMinutes: assignment.assessmentSnapshot.durationMinutes,
    totalMarks: assignment.assessmentSnapshot.totalMarks,
    attemptsUsed: assignment.attemptsUsed,
    attemptsRemaining: Math.max(0, assignment.assessmentSnapshot.maximumAttempts - assignment.attemptsUsed),
    availableFrom: assignment.availableFrom,
    expiresAt: assignment.expiresAt,
    status,
    latestAttempt: assignment.latestAttempt,
  };
};

export const serializeActiveAttempt = (attempt, snapshot) => {
  const answersList = Array.isArray(attempt.answers) ? attempt.answers : [];
  const answersMap = {};
  for (const a of answersList) {
    if (a?.questionId) {
      answersMap[a.questionId.toString()] = a;
    }
  }

  const getQId = (q) => String(q?.questionId || q?.id || q?._id || '');

  let rawOrder = attempt.questionOrder || [];
  let validOrder = rawOrder.filter((id) => id !== null && id !== undefined && String(id) !== 'null' && String(id) !== 'undefined');
  if (validOrder.length !== snapshot.questions.length) {
    validOrder = snapshot.questions.map(getQId);
  }

  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    remainingSeconds: getRemainingSeconds(attempt),
    allowBackNavigation: snapshot.allowBackNavigation,
    seed: attempt.seed,
    questions: validOrder
      .map((id) => publicQuestion(snapshot.questions.find((q) => getQId(q) === String(id)), attempt.optionOrders?.[String(id)]))
      .filter(Boolean),
    answers: answersList,
    answersMap,
    questionResponses: attempt.questionResponses || {},
  };
};

export const serializeCandidateResult = (attempt, assignment) => ({
  score: attempt.evaluation.totalScore,
  totalMarks: assignment.assessmentSnapshot.totalMarks,
  percentage: attempt.evaluation.percentage,
  passed: attempt.evaluation.passed,
  completedAt: attempt.completedAt,
  questionResults: (attempt.questionResults || []).map(({ questionId, questionType, marks, awardedMarks, feedback, codingResult, rubricScores }) => ({
    questionId,
    questionType,
    marks,
    awardedMarks,
    feedback,
    ...(codingResult && {
      codingResult: {
        status: codingResult.status,
        passedTests: codingResult.passedTests,
        totalTests: codingResult.totalTests,
      },
    }),
    ...(rubricScores?.length && {
      rubricScores: rubricScores.map(({ criterionName, awardedMarks: am, maxMarks }) => ({
        criterionName,
        awardedMarks: am,
        maxMarks,
      })),
    }),
  })),
});
