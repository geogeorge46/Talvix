import { z } from 'zod';

export const QUALITY_CATEGORIES = [
  'clarity',
  'responsibilities',
  'skillSeparation',
  'seniorityConsistency',
  'qualificationRelevance',
  'compensationTransparency',
  'requirementSpecificity',
  'titleConsistency',
  'fairnessAndInclusion'
];

export const CATEGORY_WEIGHTS = {
  clarity: 0.15,
  responsibilities: 0.15,
  skillSeparation: 0.15,
  seniorityConsistency: 0.15,
  qualificationRelevance: 0.10,
  compensationTransparency: 0.05,
  requirementSpecificity: 0.10,
  titleConsistency: 0.10,
  fairnessAndInclusion: 0.05
};

export const jobQualityFindingSchema = z.object({
  id: z.string().trim().nullable().optional().transform((val) => val || `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
  category: z.string().trim().nullable().optional().transform((val) => 
    val && QUALITY_CATEGORIES.includes(val) ? val : 'clarity'
  ),
  severity: z.enum(['critical', 'high', 'medium', 'low']).catch('medium'),
  evidence: z.string().trim().nullable().optional().transform((val) => val ?? ''),
  explanation: z.string().trim().nullable().optional().transform((val) => val || 'Review recommended for this section.'),
  recommendation: z.string().trim().nullable().optional().transform((val) => val || 'Improve specificity and role alignment.'),
  proposedReplacement: z.string().trim().nullable().optional().transform((val) => val ?? ''),
  requiresHumanReview: z.boolean().nullable().optional().transform((val) => val ?? true)
}).passthrough();

export const categoryScoresSchema = z.object({
  clarity: z.number().min(0).max(100).default(80),
  responsibilities: z.number().min(0).max(100).default(80),
  skillSeparation: z.number().min(0).max(100).default(80),
  seniorityConsistency: z.number().min(0).max(100).default(80),
  qualificationRelevance: z.number().min(0).max(100).default(80),
  compensationTransparency: z.number().min(0).max(100).default(80),
  requirementSpecificity: z.number().min(0).max(100).default(80),
  titleConsistency: z.number().min(0).max(100).default(80),
  fairnessAndInclusion: z.number().min(0).max(100).default(85)
}).passthrough();

/**
 * Calculates deterministic overall score from weighted category scores.
 */
export const calculateOverallScore = (categoryScores) => {
  if (!categoryScores || typeof categoryScores !== 'object') return 80;
  
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [cat, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    const score = typeof categoryScores[cat] === 'number' ? categoryScores[cat] : 80;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const calculated = Math.round(weightedSum / totalWeight);
  return Math.min(100, Math.max(0, calculated));
};

export const jobQualityAnalysisSchema = z.object({
  categoryScores: categoryScoresSchema.default({
    clarity: 80,
    responsibilities: 80,
    skillSeparation: 80,
    seniorityConsistency: 80,
    qualificationRelevance: 80,
    compensationTransparency: 80,
    requirementSpecificity: 80,
    titleConsistency: 80,
    fairnessAndInclusion: 85
  }),
  findings: z.array(jobQualityFindingSchema).default([]),
  summary: z.string().trim().default('Job quality evaluation complete.'),
  analysisMetadata: z.object({
    schemaVersion: z.number().default(1),
    promptVersion: z.number().default(1),
    analyzedAt: z.coerce.date().optional(),
    model: z.string().optional()
  }).passthrough().optional()
}).passthrough().transform((data) => {
  const overallScore = calculateOverallScore(data.categoryScores);
  return {
    ...data,
    overallScore
  };
});
