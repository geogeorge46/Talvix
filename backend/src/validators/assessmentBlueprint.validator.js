import { z } from 'zod';
import { QUESTION_TYPES, QUESTION_DIFFICULTIES } from '../constants/assessment.js';

export const blueprintSectionSchema = z.object({
  id: z.string().trim().min(1).default(() => `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
  title: z.string().trim().min(1).max(200),
  purpose: z.string().trim().max(1000).default(''),
  skillsEvaluated: z.array(z.string().trim().min(1)).default([]),
  questionType: z.string().trim().transform((val) => 
    QUESTION_TYPES.includes(val) ? val : 'multiple-choice'
  ),
  questionCount: z.number().int().min(1).max(50).default(3),
  difficulty: z.enum(QUESTION_DIFFICULTIES).default('medium'),
  durationMinutes: z.number().min(1).max(180).default(20),
  sectionMarks: z.number().min(1).max(500).default(30),
  evaluationCriteria: z.array(z.string().trim()).default([]),
  relevanceExplanation: z.string().trim().max(1000).default('Mapped directly to job skill requirements.'),
  proposedQuestions: z.array(z.object({
    prompt: z.string().trim().min(1),
    type: z.string().trim().optional(),
    difficulty: z.enum(QUESTION_DIFFICULTIES).optional(),
    defaultMarks: z.number().optional(),
    options: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    starterCode: z.record(z.string()).optional(),
    testCases: z.array(z.object({ input: z.any(), expectedOutput: z.any(), weight: z.number().optional() })).optional()
  })).default([])
}).strict();

export const skillCoverageSchema = z.object({
  skill: z.string().trim().min(1),
  requirementType: z.enum(['required', 'preferred']).default('required'),
  coveragePercentage: z.number().min(0).max(100).default(100),
  isCovered: z.boolean().default(true)
}).strict();

export const assessmentBlueprintDataSchema = z.object({
  targetSeniority: z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'executive', 'unknown']).default('unknown'),
  experienceRange: z.object({
    minimum: z.number().min(0).max(60).default(0),
    maximum: z.number().min(0).max(60).optional().nullable()
  }).default({ minimum: 0 }),
  objectives: z.array(z.string().trim()).default([]),
  skillCoverage: z.array(skillCoverageSchema).default([]),
  sections: z.array(blueprintSectionSchema).min(1),
  recommendedTypes: z.array(z.string().trim()).default([]),
  difficultyDistribution: z.object({
    easy: z.number().min(0).max(100).default(20),
    medium: z.number().min(0).max(100).default(60),
    hard: z.number().min(0).max(100).default(20)
  }).default({ easy: 20, medium: 60, hard: 20 }),
  totalDurationMinutes: z.number().min(5).max(360).default(60),
  totalMarks: z.number().min(1).max(1000).default(100),
  rubric: z.object({
    criteria: z.array(z.object({
      name: z.string().trim().min(1),
      description: z.string().trim().default(''),
      maxMarks: z.number().min(1).default(25),
      weight: z.number().min(1).max(100).default(25)
    })).default([]),
    evaluationNotes: z.string().trim().default('')
  }).default({ criteria: [], evaluationNotes: '' }),
  recommendedPassingPercentage: z.number().min(0).max(100).default(70),
  passCriteriaExplanation: z.string().trim().default('Candidates scoring 70% or higher demonstrate required technical competency.'),
  unsupportedRecommendations: z.array(z.string().trim()).default([])
}).strict().transform((data) => {
  // Re-calculate totals from sections deterministically
  const computedDuration = data.sections.reduce((acc, sec) => acc + sec.durationMinutes, 0);
  const computedMarks = data.sections.reduce((acc, sec) => acc + sec.sectionMarks, 0);

  return {
    ...data,
    totalDurationMinutes: computedDuration > 0 ? computedDuration : data.totalDurationMinutes,
    totalMarks: computedMarks > 0 ? computedMarks : data.totalMarks
  };
});
