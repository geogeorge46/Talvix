import { z } from 'zod';
import { normalizeSkills } from '../utils/skillNormalizer.js';

const SKILL_CATEGORIES = [
  'frontend', 'backend', 'devops', 'database', 'cloud', 
  'mobile', 'qa-testing', 'security', 'data-ai', 'architecture', 
  'soft-skill', 'domain-knowledge', 'general'
];

export const extractedSkillSchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.string().trim().toLowerCase().default('general').transform((val) => 
    SKILL_CATEGORIES.includes(val) ? val : 'general'
  ),
  requirementType: z.enum(['required', 'preferred']).default('required'),
  importance: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  evidence: z.string().trim().max(500).default(''),
  source: z.enum(['explicit', 'inferred']).default('explicit')
}).strict();

export const assessmentRecommendationSchema = z.object({
  category: z.string().trim().min(1).max(100),
  domain: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).default(''),
  source: z.enum(['explicit', 'inferred']).default('inferred')
}).strict();

export const structuredJobIntelligenceSchema = z.object({
  jobTitle: z.string().trim().max(150).default('Unknown'),
  seniorityLevel: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase().replace('_', '-') : val),
    z.enum(['intern', 'entry', 'mid', 'senior', 'lead', 'executive', 'unknown']).catch('unknown')
  ).default('unknown'),
  employmentType: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase().replace('_', '-') : val),
    z.enum(['full-time', 'part-time', 'contract', 'internship', 'freelance', 'unknown']).catch('unknown')
  ).default('unknown'),
  minimumExperience: z.preprocess(
    (val) => (typeof val === 'number' ? val : typeof val === 'string' ? parseInt(val, 10) || 0 : 0),
    z.number().min(0).max(60).catch(0)
  ).default(0),
  maximumExperience: z.preprocess(
    (val) => (typeof val === 'number' ? val : typeof val === 'string' ? parseInt(val, 10) || null : null),
    z.number().min(0).max(60).optional().nullable()
  ).optional().nullable(),
  requiredSkills: z.array(extractedSkillSchema).default([]),
  preferredSkills: z.array(extractedSkillSchema).default([]),
  responsibilities: z.array(z.object({
    text: z.string().trim().min(1).max(1000),
    source: z.enum(['explicit', 'inferred']).default('explicit')
  }).passthrough()).default([]),
  qualifications: z.array(z.object({
    text: z.string().trim().min(1).max(1000),
    source: z.enum(['explicit', 'inferred']).default('explicit')
  }).passthrough()).default([]),
  educationRequirements: z.array(z.string().trim().max(300)).default([]),
  domainKnowledge: z.array(z.string().trim().max(200)).default([]),
  assessmentRecommendations: z.array(assessmentRecommendationSchema).default([]),
  extractionMetadata: z.object({
    schemaVersion: z.number().default(1),
    promptVersion: z.number().default(1),
    extractedAt: z.coerce.date().optional(),
    confidenceScore: z.number().min(0).max(100).default(85),
    model: z.string().optional()
  }).passthrough().optional()
}).passthrough().transform((data) => {
  // Apply skill normalization and deduplication
  const allSkills = normalizeSkills([...data.requiredSkills, ...data.preferredSkills]);
  
  return {
    ...data,
    requiredSkills: allSkills.filter(s => s.requirementType === 'required'),
    preferredSkills: allSkills.filter(s => s.requirementType === 'preferred')
  };
});
