import { executeCode } from '../services/codeExecution.service.js';
const sameSet = (left = [], right = []) => left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
const normalize = (value, config) => { let result = String(value ?? ''); if (config.trimWhitespace !== false) result = result.trim(); if (!config.caseSensitive) result = result.toLowerCase(); return result; };
export const gradeAttempt = async (snapshot, answers, adapter) => {
  let objectiveScore = 0; let codingScore = 0; let negativeMarks = 0; let manual = false; const questionResults = [];
  for (const question of snapshot.questions) {
    const answer = answers.find((item) => item.questionId.toString() === question.questionId.toString()); let correct = false; let awarded = 0; let requiresManualReview = false; let codingResult;
    if (question.type === 'single-choice') correct = answer?.answer === question.correctAnswer?.optionId;
    else if (question.type === 'multiple-choice') correct = sameSet(answer?.answer, question.correctAnswer?.optionIds);
    else if (question.type === 'true-false') correct = answer?.answer === question.correctAnswer?.value;
    else if (question.type === 'short-answer') correct = question.correctAnswer.acceptedAnswers.map((value) => normalize(value, question.correctAnswer)).includes(normalize(answer?.answer, question.correctAnswer));
    else if (question.type === 'long-answer') requiresManualReview = true;
    else if (question.type === 'coding') { codingResult = await executeCode({ code: answer?.code, language: answer?.language, testCases: question.coding.testCases }, adapter); if (codingResult.status === 'completed') { const totalWeight = question.coding.testCases.reduce((sum, test) => sum + test.weight, 0); const passedWeight = codingResult.testResults.reduce((sum, test) => sum + (test.passed ? test.weight : 0), 0); awarded = question.marks * passedWeight / totalWeight; codingScore += awarded; correct = awarded === question.marks; } else requiresManualReview = true; }
    if (!['long-answer', 'coding'].includes(question.type)) { if (correct) { awarded = question.marks; objectiveScore += awarded; } else if (answer && snapshot.negativeMarking) negativeMarks += Math.min(snapshot.negativeMarkValue, question.marks); }
    manual ||= requiresManualReview; questionResults.push({ questionId: question.questionId, questionType: question.type, marks: question.marks, awardedMarks: awarded, isCorrect: requiresManualReview ? undefined : correct, requiresManualReview, codingResult });
  }
  const totalScore = Math.max(0, objectiveScore + codingScore - negativeMarks); const percentage = Math.min(100, Math.max(0, snapshot.totalMarks ? totalScore / snapshot.totalMarks * 100 : 0));
  return { questionResults, manual, evaluation: { objectiveScore, subjectiveScore: 0, codingScore, negativeMarks, totalScore, percentage, passed: percentage >= snapshot.passingPercentage, evaluatedAt: new Date() } };
};
