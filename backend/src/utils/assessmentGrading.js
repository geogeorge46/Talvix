import { executeCode } from '../services/codeExecution.service.js';

const sameSet = (left = [], right = []) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
const normalize = (value, config = {}) => {
  let result = String(value ?? '');
  if (config.trimWhitespace !== false) result = result.trim();
  if (!config.caseSensitive) result = result.toLowerCase();
  return result;
};

const extractOptionId = (val) => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') return String(val.optionId ?? val.id ?? val.value ?? '').trim();
  return String(val).trim();
};

export const gradeAttempt = async (snapshot, answers, adapter) => {
  let objectiveScore = 0;
  let codingScore = 0;
  let negativeMarks = 0;
  let manual = false;
  const questionResults = [];

  for (const question of snapshot.questions) {
    const qId = String(question.questionId || question.id || question._id || '');
    const answer = answers.find((item) => (item.questionId || '').toString() === qId);
    let correct = false;
    let awarded = 0;
    let requiresManualReview = false;
    let codingResult;

    if (['single-choice', 'output-prediction'].includes(question.type)) {
      const expectedOpt = extractOptionId(question.correctAnswer);
      const candidateOpt = extractOptionId(answer?.answer);
      correct = Boolean(expectedOpt && candidateOpt && expectedOpt.toLowerCase() === candidateOpt.toLowerCase());
    } else if (question.type === 'multiple-choice') {
      const expectedOpts = Array.isArray(question.correctAnswer?.optionIds)
        ? question.correctAnswer.optionIds.map(extractOptionId)
        : Array.isArray(question.correctAnswer)
        ? question.correctAnswer.map(extractOptionId)
        : question.correctAnswer ? [extractOptionId(question.correctAnswer)] : [];
      const candidateOpts = Array.isArray(answer?.answer)
        ? answer.answer.map(extractOptionId)
        : answer?.answer ? [extractOptionId(answer.answer)] : [];
      correct = sameSet(candidateOpts.filter(Boolean), expectedOpts.filter(Boolean));
    } else if (question.type === 'true-false') {
      const expectedBool = question.correctAnswer?.value !== undefined
        ? Boolean(question.correctAnswer.value)
        : typeof question.correctAnswer === 'boolean'
        ? question.correctAnswer
        : String(question.correctAnswer).toLowerCase() === 'true';
      const candidateBool = typeof answer?.answer === 'boolean'
        ? answer.answer
        : String(answer?.answer).toLowerCase() === 'true';
      correct = Boolean(answer && candidateBool === expectedBool);
    } else if (question.type === 'short-answer') {
      const accepted = Array.isArray(question.correctAnswer?.acceptedAnswers)
        ? question.correctAnswer.acceptedAnswers
        : Array.isArray(question.correctAnswer)
        ? question.correctAnswer
        : typeof question.correctAnswer === 'string'
        ? [question.correctAnswer]
        : [];
      const conf = typeof question.correctAnswer === 'object' && question.correctAnswer !== null ? question.correctAnswer : {};
      correct = accepted.map((value) => normalize(value, conf)).includes(normalize(answer?.answer, conf));
    } else if (['long-answer', 'file-upload', 'work-sample'].includes(question.type)) {
      requiresManualReview = true;
    } else if (['coding', 'sql', 'debugging'].includes(question.type)) {
      codingResult = await executeCode({
        code: answer?.code,
        language: answer?.language,
        testCases: question.coding?.testCases || [],
        limits: { timeLimit: question.coding?.timeLimit, memoryLimit: question.coding?.memoryLimit },
        functionName: question.coding?.functionName,
        executionMode: question.coding?.executionMode
      }, adapter);
      if (codingResult.status === 'completed') {
        const totalWeight = question.coding?.testCases?.reduce((sum, test) => sum + test.weight, 0) || 0;
        const passedWeight = codingResult.testResults.reduce((sum, test) => sum + (test.passed ? test.weight : 0), 0);
        awarded = totalWeight ? (question.marks * passedWeight / totalWeight) : 0;
        codingScore += awarded;
        correct = awarded === question.marks;
      } else {
        requiresManualReview = true;
      }
    }

    if (!['long-answer', 'file-upload', 'work-sample', 'coding', 'sql', 'debugging'].includes(question.type)) {
      if (correct) {
        awarded = question.marks;
        objectiveScore += awarded;
      } else if (answer && snapshot.negativeMarking) {
        negativeMarks += Math.min(snapshot.negativeMarkValue, question.marks);
      }
    }

    manual ||= requiresManualReview;
    const resultEntry = {
      questionId: qId,
      questionType: question.type,
      marks: question.marks,
      awardedMarks: awarded,
      isCorrect: requiresManualReview ? undefined : correct,
      requiresManualReview,
      codingResult
    };

    if (question.type === 'work-sample' && question.rubric?.criteria?.length) {
      resultEntry.rubricScores = question.rubric.criteria.map((c) => ({
        criterionName: c.name,
        awardedMarks: 0,
        maxMarks: c.maxMarks,
        feedback: ''
      }));
    }
    questionResults.push(resultEntry);
  }

  const roundNum = (n) => Math.round((n || 0) * 100) / 100;
  const totalScore = roundNum(Math.max(0, objectiveScore + codingScore - negativeMarks));
  const rawPercentage = snapshot.totalMarks ? (totalScore / snapshot.totalMarks) * 100 : 0;
  const percentage = Math.min(100, Math.max(0, roundNum(rawPercentage)));

  return {
    questionResults,
    manual,
    evaluation: {
      objectiveScore: roundNum(objectiveScore),
      subjectiveScore: 0,
      codingScore: roundNum(codingScore),
      negativeMarks: roundNum(negativeMarks),
      totalScore,
      percentage,
      passed: percentage >= snapshot.passingPercentage,
      evaluatedAt: new Date()
    }
  };
};
