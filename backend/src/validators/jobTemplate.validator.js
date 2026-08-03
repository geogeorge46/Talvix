import mongoose from 'mongoose';
import { z } from 'zod';
import { EMPLOYMENT_TYPES, PROFICIENCY_LEVELS, WORK_MODES } from '../constants/job.js';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
const text = (max) => z.string().trim().max(max);
const stringArray = (maxItems, maxText = 500) => z.array(text(maxText).min(1)).max(maxItems);

const salary = z.object({
  minimum: z.number().nonnegative(),
  maximum: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  period: z.enum(['hourly', 'monthly', 'yearly']),
  isVisible: z.boolean().default(true)
}).strict().refine((value) => value.maximum >= value.minimum, { path: ['maximum'], message: 'Maximum salary cannot be lower than minimum salary' });

const skill = z.object({
  name: text(100).min(1),
  required: z.boolean().default(true),
  minimumProficiency: z.enum(PROFICIENCY_LEVELS).default('beginner'),
  minimumYearsOfExperience: z.number().min(0).max(60).default(0),
  weight: z.number().int().min(1).max(100)
}).strict();

const question = z.object({
  question: text(500).min(1),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'single-choice', 'multiple-choice']),
  required: z.boolean().default(false),
  options: stringArray(20, 200).default([])
}).strict().superRefine((value, context) => {
  const needsOptions = ['single-choice', 'multiple-choice'].includes(value.type);
  if (needsOptions && value.options.length < 2) context.addIssue({ code: 'custom', path: ['options'], message: 'Choice questions require at least two options' });
  if (!needsOptions && value.options.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Options are only supported for choice questions' });
});

const templateFields = {
  name: text(200).min(1),
  description: text(3000).optional().default(''),
  title: text(150).min(1),
  jobDescription: text(10000).optional().default(''),
  responsibilities: stringArray(50).default([]),
  requirements: stringArray(50).default([]),
  preferredQualifications: stringArray(50).default([]),
  skills: z.array(skill).max(50).default([]),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  workMode: z.enum(WORK_MODES),
  location: z.object({ city: text(100).optional(), state: text(100).optional(), country: text(100).optional() }).strict().optional(),
  salary: salary.optional(),
  minimumExperience: z.number().min(0).max(60).default(0),
  maximumExperience: z.number().min(0).max(60).optional(),
  educationRequirements: stringArray(20, 300).default([]),
  applicationQuestions: z.array(question).max(30).default([]),
  assessmentRequired: z.boolean().default(false),
  resumeRequired: z.boolean().default(true),
  minimumProfileCompletion: z.number().min(0).max(100).default(0),
  department: text(100).optional().default(''),
};

const rangeCheck = (value, context) => {
  if (value.maximumExperience !== undefined && value.minimumExperience !== undefined && value.maximumExperience < value.minimumExperience) context.addIssue({ code: 'custom', path: ['maximumExperience'], message: 'Maximum experience cannot be lower than minimum experience' });
};

export const createTemplateSchema = z.object(templateFields).strict().superRefine(rangeCheck);
export const updateTemplateSchema = z.object(templateFields).partial().strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required').superRefine(rangeCheck);
export const createTemplateFromJobSchema = z.object({ templateName: text(200).min(1) }).strict();
export const templateIdParamsSchema = z.object({ templateId: objectId }).strict();
export const templateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: text(100).optional()
}).strict();
