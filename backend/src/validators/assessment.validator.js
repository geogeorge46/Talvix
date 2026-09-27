import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { ASSESSMENT_STATUSES, ASSESSMENT_TYPES, ASSIGNMENT_STATUSES, DELIVERABLE_TYPES, MAX_ANSWER_SIZE, MAX_CODE_SIZE, MAX_DELIVERABLE_FILE_BYTES, MAX_DELIVERABLE_FILES, MAX_RUBRIC_CRITERIA, QUESTION_DIFFICULTIES, QUESTION_TYPES, SUPPORTED_CODE_LANGUAGES } from '../constants/assessment.js';
import { DOCUMENT_MIMES } from '../constants/document.js';
const objectId = z.string().refine(mongoose.isObjectIdOrHexString, 'Invalid MongoDB ObjectId'); const text = (max) => z.string().trim().max(max); const pagination = { page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(10) };
const option = z.object({ id: z.string().min(1).max(100).optional(), text: text(2000).min(1) }).strict();
const testCase = z.object({ input: z.unknown(), expectedOutput: z.unknown(), isHidden: z.boolean().default(false), weight: z.number().positive().max(100) }).strict();
const coding = z.object({ languageSupport: z.array(z.enum(SUPPORTED_CODE_LANGUAGES)).min(1).transform((v) => [...new Set(v)]), starterCode: z.record(z.string(), z.string().max(MAX_CODE_SIZE)).default({}), functionName: text(100).min(1), testCases: z.array(testCase).min(1).max(100), timeLimit: z.number().positive().max(10).optional(), memoryLimit: z.number().positive().max(1024000).optional(), cpuLimit: z.number().positive().max(4).optional(), maxOutputSize: z.number().positive().max(10 * 1024 * 1024).optional(), maxSourceSize: z.number().positive().max(5 * 1024 * 1024).optional() }).strict();
const rubricCriterion = z.object({ name: text(100).min(1), description: text(500).optional().default(''), maxMarks: z.number().positive().max(10000), weight: z.number().int().min(1).max(100) }).strict();
const rubricConfig = z.object({ criteria: z.array(rubricCriterion).min(1).max(MAX_RUBRIC_CRITERIA).refine((arr) => arr.reduce((sum, c) => sum + c.weight, 0) === 100, { message: 'Rubric criteria weights must sum to 100' }), evaluationNotes: text(3000).optional().default('') }).strict();
const referenceAsset = z.object({ name: text(200).min(1), url: z.string().url().max(2000), description: text(500).optional().default('') }).strict();
const deliverableConfig = z.object({ type: z.enum(DELIVERABLE_TYPES), instructions: text(5000).min(1), allowedFormats: z.array(z.string().max(20)).max(30).default([]), maxFiles: z.number().int().min(0).max(MAX_DELIVERABLE_FILES).default(1), maxFileSizeBytes: z.number().int().min(1024).max(MAX_DELIVERABLE_FILE_BYTES).default(10 * 1024 * 1024), referenceAssets: z.array(referenceAsset).max(10).default([]) }).strict().superRefine((val, ctx) => { if (['file', 'mixed'].includes(val.type) && val.maxFiles < 1) ctx.addIssue({ code: 'custom', path: ['maxFiles'], message: 'File deliverables require maxFiles >= 1' }); });
const correctAnswer = z.union([z.object({ optionId: z.string().min(1) }).strict(), z.object({ optionIds: z.array(z.string().min(1)).min(1) }).strict(), z.object({ value: z.boolean() }).strict(), z.object({ acceptedAnswers: z.array(text(1000).min(1)).min(1).max(100), caseSensitive: z.boolean().default(false), trimWhitespace: z.boolean().default(true) }).strict()]);
export const questionBodySchema = z.object({ type: z.enum(QUESTION_TYPES), title: text(200).optional(), prompt: text(10000).min(1), description: text(10000).optional(), skills: z.array(text(100).min(1)).max(30).default([]), difficulty: z.enum(QUESTION_DIFFICULTIES), defaultMarks: z.number().positive().max(10000), options: z.array(option).max(20).default([]), correctAnswer: correctAnswer.optional(), coding: coding.optional(), rubric: rubricConfig.optional(), deliverable: deliverableConfig.optional(), explanation: text(5000).optional(), isReusable: z.boolean().default(true) }).strict().superRefine((value, context) => {
  value.options.forEach((item) => { item.id ??= randomUUID(); }); const ids = value.options.map((item) => item.id); if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Option IDs must be unique' });
  if (['single-choice', 'multiple-choice', 'output-prediction'].includes(value.type) && value.options.length < 2) context.addIssue({ code: 'custom', path: ['options'], message: 'At least two options are required' });
  if (['single-choice', 'output-prediction'].includes(value.type) && (!value.correctAnswer?.optionId || !ids.includes(value.correctAnswer.optionId))) context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'A valid correct option is required' });
  if (value.type === 'multiple-choice' && (!value.correctAnswer?.optionIds?.length || value.correctAnswer.optionIds.some((id) => !ids.includes(id)) || new Set(value.correctAnswer.optionIds).size !== value.correctAnswer.optionIds.length)) context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Valid unique correct options are required' });
  if (value.type === 'true-false' && typeof value.correctAnswer?.value !== 'boolean') context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'A boolean correct answer is required' });
  if (value.type === 'short-answer' && !value.correctAnswer?.acceptedAnswers?.length) context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Accepted answers are required' });
  if (['long-answer', 'file-upload'].includes(value.type) && value.correctAnswer) context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Subjective answers cannot define a correct answer' });
  if (['coding', 'sql', 'debugging'].includes(value.type) && !value.coding) context.addIssue({ code: 'custom', path: ['coding'], message: 'Coding configuration is required' });
  if (value.type === 'work-sample' && !value.deliverable) context.addIssue({ code: 'custom', path: ['deliverable'], message: 'Work-sample questions require a deliverable configuration' });
  if (value.type === 'work-sample' && !value.rubric) context.addIssue({ code: 'custom', path: ['rubric'], message: 'Work-sample questions require a rubric' });
  if (value.type === 'work-sample' && value.correctAnswer) context.addIssue({ code: 'custom', path: ['correctAnswer'], message: 'Work-sample questions cannot define a correct answer' });
}).transform((value) => ({ ...value, skills: [...new Set(value.skills.map((skill) => skill.toLowerCase()))] }));
const safeQuestionUpdateSchema = z.object({ title: text(200).optional(), prompt: text(10000).min(1).optional(), description: text(10000).optional(), skills: z.array(text(100).min(1)).max(30).optional(), difficulty: z.enum(QUESTION_DIFFICULTIES).optional(), defaultMarks: z.number().positive().max(10000).optional(), explanation: text(5000).optional(), isReusable: z.boolean().optional(), changeLog: text(1000).optional() }).strict().refine((v) => Object.keys(v).length, 'At least one field is required');
export const questionUpdateSchema = z.union([questionBodySchema, safeQuestionUpdateSchema]);
export const questionIdSchema = z.object({ questionId: objectId }).strict(); export const assessmentIdSchema = z.object({ assessmentId: objectId }).strict(); export const assignmentIdSchema = z.object({ assignmentId: objectId }).strict(); export const attemptIdSchema = z.object({ attemptId: objectId }).strict();
export const assessmentQuestionParamsSchema = z.object({ assessmentId: objectId, questionId: objectId }).strict();
export const attemptQuestionParamsSchema = z.object({ attemptId: objectId, questionId: objectId }).strict();
export const questionQuerySchema = z.object({ ...pagination, search: text(100).optional(), type: z.enum(QUESTION_TYPES).optional(), difficulty: z.enum(QUESTION_DIFFICULTIES).optional(), skills: text(500).optional().transform((v) => v?.split(',').filter(Boolean)), active: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'), reusable: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'), sort: z.enum(['newest', 'oldest', 'difficulty', 'usage-high', 'usage-low']).default('newest') }).strict();
const attachments = z.object({ enabled: z.boolean().default(false), maximumFiles: z.number().int().min(0).max(10).default(0), maximumFileBytes: z.number().int().min(1024).max(100 * 1024 * 1024).default(10 * 1024 * 1024), maximumTotalBytes: z.number().int().min(1024).max(200 * 1024 * 1024).default(20 * 1024 * 1024), allowedMimeTypes: z.array(z.enum(DOCUMENT_MIMES)).max(DOCUMENT_MIMES.length).transform((values) => [...new Set(values)]).default([]) }).strict().superRefine((value, context) => { if (value.enabled && value.maximumFiles < 1) context.addIssue({ code: 'custom', path: ['maximumFiles'], message: 'At least one attachment must be allowed' }); if (value.enabled && !value.allowedMimeTypes.length) context.addIssue({ code: 'custom', path: ['allowedMimeTypes'], message: 'At least one MIME type must be allowed' }); if (value.maximumFileBytes > value.maximumTotalBytes) context.addIssue({ code: 'custom', path: ['maximumFileBytes'], message: 'Per-file limit cannot exceed total limit' }); });
export const assessmentBodySchema = z.object({ title: text(200).min(1), description: text(3000).optional(), instructions: text(5000).optional(), type: z.enum(ASSESSMENT_TYPES), skills: z.array(text(100).min(1)).max(30).default([]), durationMinutes: z.number().int().min(0).max(1440), passingPercentage: z.number().min(0).max(100), maximumAttempts: z.number().int().min(1).max(5).default(1), shuffleQuestions: z.boolean().default(false), shuffleOptions: z.boolean().default(false), showResultImmediately: z.boolean().default(false), allowBackNavigation: z.boolean().default(true), negativeMarking: z.boolean().default(false), negativeMarkValue: z.number().nonnegative().default(0), attachments: attachments.default({ enabled: false, maximumFiles: 0, maximumFileBytes: 10 * 1024 * 1024, maximumTotalBytes: 20 * 1024 * 1024, allowedMimeTypes: [] }) }).strict();
export const assessmentUpdateSchema = assessmentBodySchema.partial().refine((v) => Object.keys(v).length, 'At least one field is required');
export const assessmentQuestionSchema = z.object({ questionId: objectId, marks: z.number().positive().max(10000), order: z.number().int().nonnegative().optional(), isRequired: z.boolean().default(true) }).strict();
export const reorderSchema = z.object({ questions: z.array(z.object({ questionId: objectId, order: z.number().int().nonnegative() }).strict()).min(1) }).strict();
export const assessmentQuerySchema = z.object({ ...pagination, search: text(100).optional(), status: z.enum(ASSESSMENT_STATUSES).optional(), type: z.enum(ASSESSMENT_TYPES).optional(), sort: z.enum(['newest', 'oldest', 'title']).default('newest') }).strict();
export const assignmentBodySchema = z.object({ assessmentId: objectId, applicationId: objectId, availableFrom: z.coerce.date(), expiresAt: z.coerce.date() }).strict().refine((v) => v.expiresAt > v.availableFrom, { path: ['expiresAt'], message: 'Expiry must follow availability' });
export const bulkAssignmentSchema = z.object({ assessmentId: objectId, applicationIds: z.array(objectId).min(1).max(100), availableFrom: z.coerce.date(), expiresAt: z.coerce.date() }).strict().refine((v) => v.expiresAt > v.availableFrom, { path: ['expiresAt'], message: 'Expiry must follow availability' });
export const checkEligibilitySchema = z.object({ assessmentId: objectId, applicationIds: z.array(objectId).min(1).max(100) }).strict();
export const assignmentQuerySchema = z.object({ ...pagination, assessmentId: objectId.optional(), applicationId: objectId.optional(), candidate: objectId.optional(), status: z.enum(ASSIGNMENT_STATUSES).optional(), passed: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'), availableFrom: z.coerce.date().optional(), expiresBefore: z.coerce.date().optional(), sort: z.enum(['newest', 'oldest', 'expiry']).default('newest') }).strict();
export const cohortLeaderboardQuerySchema = z.object({
  jobId: objectId.optional(),
  status: z.enum(['not-started', 'in-progress', 'overdue', 'under-review', 'completed', 'result-released', 'cancelled']).optional(),
  category: text(100).optional(),
  sortBy: z.enum(['rank', 'score', 'submittedAt', 'candidateName']).default('rank'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).strict();
export const candidateAssignmentQuerySchema = z.object({ ...pagination, status: z.enum(ASSIGNMENT_STATUSES).optional() }).strict();
export const reasonSchema = z.object({ reason: text(2000).min(1) }).strict(); export const extendSchema = z.object({ expiresAt: z.coerce.date(), reason: text(2000).min(1) }).strict();
const answerValue = z.union([z.string().max(MAX_ANSWER_SIZE), z.boolean(), z.array(z.string().max(100)).max(20)]);
export const saveAnswerSchema = z.object({ questionId: objectId, answer: answerValue.optional(), code: z.string().max(MAX_CODE_SIZE).optional(), language: z.enum(SUPPORTED_CODE_LANGUAGES).optional(), submittedUrls: z.array(z.string().url().max(2000)).max(10).optional(), timeSpentSeconds: z.number().int().nonnegative().max(86400).default(0), flaggedForReview: z.boolean().default(false) }).strict();
const rubricScoreEntry = z.object({ criterionName: text(100).min(1), awardedMarks: z.number().nonnegative(), feedback: text(1000).optional().default('') }).strict();
export const reviewSchema = z.object({ awardedMarks: z.number().nonnegative().optional(), feedback: text(3000).optional(), rubricScores: z.array(rubricScoreEntry).min(1).max(MAX_RUBRIC_CRITERIA).optional() }).strict().refine((v) => v.awardedMarks !== undefined || v.rubricScores !== undefined, { message: 'Either awardedMarks or rubricScores is required' });
export const reviewCompleteSchema = z.object({ reason: text(2000).optional() }).strict();
export const adminQuerySchema = z.object({ ...pagination, company: objectId.optional(), candidate: objectId.optional(), status: z.string().optional() }).strict();
export const promoteCandidatesSchema = z.object({
  applicationIds: z.array(objectId).min(1).max(100),
  targetStage: z.enum(['shortlisted', 'interview-scheduled', 'under-review']),
  reason: text(1000).optional().default('Promoted from assessment review'),
  allowProvisional: z.boolean().default(false),
}).strict();

export const suspiciousEventSchema = z.object({
  type: z.enum(['tab-switch', 'window-blur', 'copy-paste', 'copy', 'paste', 'right-click', 'multiple-login', 'other']),
  detail: text(500).optional()
}).strict();

export const executeCodeSchema = z.object({
  questionId: objectId,
  code: z.string().max(MAX_CODE_SIZE),
  language: z.enum(SUPPORTED_CODE_LANGUAGES)
}).strict();

export const generateQuestionsSchema = z.object({
  topic: text(200).min(2),
  skills: z.array(text(100)).max(20).optional().default([]),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  type: z.enum([
    'single-choice',
    'multiple-choice',
    'true-false',
    'short-answer',
    'coding',
    'work-sample',
    'mixed'
  ]).default('mixed'),
  count: z.number().int().min(1).max(10).default(3)
}).strict();
