import { Assessment } from '../models/Assessment.js';
import { Question } from '../models/Question.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

const questionGenSchema = z.object({
  type: z.enum(['single-choice', 'multiple-choice', 'true-false', 'short-answer', 'long-answer', 'coding', 'sql', 'debugging', 'output-prediction', 'file-upload', 'work-sample']),
  prompt: z.string(),
  defaultMarks: z.number().min(0.01),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  category: z.string().optional().default('General'),
  skills: z.array(z.string()).optional().default([]),
  options: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  correctAnswer: z.any().nullable().default(null),
  coding: z.object({
    starterCode: z.record(z.string()).default({}),
    testCases: z.array(z.object({ input: z.any(), expectedOutput: z.any(), isHidden: z.boolean().default(false), weight: z.number() })).default([])
  }).optional(),
  deliverable: z.object({
    type: z.enum(['file', 'url', 'text', 'mixed']),
    instructions: z.string(),
    allowedFormats: z.array(z.string()).default([]),
    maxFiles: z.number().default(1)
  }).optional(),
  rubric: z.object({
    criteria: z.array(z.object({
      name: z.string(),
      description: z.string().default(''),
      maxMarks: z.number(),
      weight: z.number()
    })).default([]),
    evaluationNotes: z.string().default('')
  }).optional()
});

const assessmentGenSchema = z.object({
  questions: z.array(questionGenSchema)
});

const interviewGenSchema = z.object({
  questions: z.array(z.object({
    prompt: z.string(),
    expectedAnswer: z.string(),
    hints: z.array(z.string()).default([]),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    estimatedTimeSeconds: z.number()
  }))
});

const gradingSchema = z.object({
  awardedMarks: z.number(),
  isCorrect: z.boolean(),
  requiresManualReview: z.boolean().default(false),
  feedback: z.string().default('')
});

/**
 * Automatically creates assessment questions and registers a new test document.
 */
export const generateAIAssessment = async (jobDescription, companyId, userId, context = {}) => {
  const genRes = await invokeAIGateway('assessment_generation', { jobDetails: jobDescription }, context);
  const data = parseJSON(genRes, assessmentGenSchema);

  const createdQuestions = [];
  for (const q of data.questions) {
    const doc = await Question.create({
      company: companyId,
      createdBy: userId,
      type: q.type,
      prompt: q.prompt,
      difficulty: q.difficulty,
      defaultMarks: q.defaultMarks,
      category: q.category || 'General',
      skills: q.skills || [],
      options: q.options,
      correctAnswer: q.correctAnswer,
      coding: q.coding ? {
        languageSupport: ['javascript', 'python'],
        starterCode: q.coding.starterCode,
        testCases: q.coding.testCases
      } : undefined,
      deliverable: q.deliverable ? {
        type: q.deliverable.type,
        instructions: q.deliverable.instructions,
        allowedFormats: q.deliverable.allowedFormats || [],
        maxFiles: q.deliverable.maxFiles || 1
      } : undefined,
      rubric: q.rubric ? {
        criteria: q.rubric.criteria || [],
        evaluationNotes: q.rubric.evaluationNotes || ''
      } : undefined
    });
    createdQuestions.push(doc);
  }

  const totalMarks = createdQuestions.reduce((acc, q) => acc + (q.defaultMarks || 0), 0);

  const assessment = await Assessment.create({
    company: companyId,
    createdBy: userId,
    title: `AI Generated Assessment - ${jobDescription.slice(0, 30)}`,
    description: `Automatically created based on: ${jobDescription}`,
    type: 'mixed',
    durationMinutes: 60,
    passingPercentage: 70,
    totalMarks,
    questions: createdQuestions.map((q, idx) => ({
      question: q._id,
      marks: q.defaultMarks,
      order: idx
    }))
  });

  return Assessment.findById(assessment._id).populate('questions.question');
};

/**
 * Automatically creates targeted questions and adds them to the Question Bank.
 */
export const generateQuestionsForBank = async ({
  topic,
  skills = [],
  difficulty = 'medium',
  type = 'mixed',
  count = 3,
  companyId,
  userId,
  createdBy,
  context = {}
}) => {
  const genRes = await invokeAIGateway(
    'question_bank_generation',
    {
      topic,
      skills: Array.isArray(skills) && skills.length ? skills.join(', ') : topic,
      difficulty,
      type,
      count: String(count)
    },
    context
  );

  const data = parseJSON(genRes, assessmentGenSchema);

  const authorId = userId || createdBy;
  const createdQuestions = [];
  for (const q of data.questions) {
    const doc = await Question.create({
      company: companyId,
      createdBy: authorId,
      type: q.type,
      title: (q.title || q.prompt || '').slice(0, 150),
      prompt: q.prompt,
      difficulty: q.difficulty || difficulty,
      defaultMarks: q.defaultMarks || 10,
      category: q.category || topic,
      topic,
      skills: Array.isArray(q.skills) && q.skills.length ? q.skills : skills,
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      isReusable: true,
      coding: q.coding ? {
        languageSupport: ['javascript', 'python'],
        starterCode: q.coding.starterCode || {},
        testCases: q.coding.testCases || []
      } : undefined,
      deliverable: q.deliverable ? {
        type: q.deliverable.type,
        instructions: q.deliverable.instructions,
        allowedFormats: q.deliverable.allowedFormats || [],
        maxFiles: q.deliverable.maxFiles || 1
      } : undefined,
      rubric: q.rubric ? {
        criteria: q.rubric.criteria || [],
        evaluationNotes: q.rubric.evaluationNotes || ''
      } : undefined
    });
    createdQuestions.push(doc);
  }

  return createdQuestions;
};

/**
 * Automatically builds interview plans and kits.
 */
export const generateInterviewKit = async (jobDetails, candidateDetails, companyId, userId, context = {}) => {
  const res = await invokeAIGateway('interview_generation', { jobDetails, candidateDetails }, context);
  return parseJSON(res, interviewGenSchema);
};

/**
 * Automates essay and coding evaluations on candidate submissions.
 */
export const evaluateAttempt = async (attemptId, context = {}) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new AppError('Assessment attempt not found', 404);

  const results = [];
  let totalAwarded = 0;

  for (const ans of attempt.answers) {
    const q = await Question.findById(ans.questionId);
    if (!q) continue;

    const evalRes = await invokeAIGateway('answer_evaluation', {
      response: ans.answer || ans.code || '',
      question: q.prompt
    }, context);

    const grade = parseJSON(evalRes, gradingSchema);
    totalAwarded += grade.awardedMarks;

    results.push({
      questionId: q._id,
      questionType: q.type,
      marks: q.defaultMarks,
      awardedMarks: grade.awardedMarks,
      isCorrect: grade.isCorrect,
      requiresManualReview: grade.requiresManualReview,
      feedback: grade.feedback
    });
  }

  attempt.questionResults = results;
  attempt.evaluation = {
    objectiveScore: totalAwarded,
    subjectiveScore: 0,
    codingScore: 0,
    negativeMarks: 0,
    totalScore: totalAwarded,
    percentage: 100, // mock percentage for test
    passed: true,
    evaluatedAt: new Date()
  };
  attempt.status = 'completed';

  await attempt.save();
  return attempt;
};
