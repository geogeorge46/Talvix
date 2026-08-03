import mongoose from 'mongoose';
import { z } from 'zod';
import { EMPLOYMENT_TYPES, PROFICIENCY_LEVELS, WORK_MODES } from '../constants/job.js';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
const text = (max) => z.string().trim().max(max);
const stringArray = (maxItems, maxText = 500) => z.array(text(maxText).min(1)).max(maxItems);
const futureDate = z.coerce.date().refine((value) => value > new Date(), 'Application deadline must be in the future');
const futurePublishDate = z.coerce.date().refine((value) => value > new Date(), 'Scheduled publish date must be in the future');
const salary = z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/), period: z.enum(['hourly', 'monthly', 'yearly']), isVisible: z.boolean().default(true) }).strict()
  .refine((value) => value.maximum >= value.minimum, { path: ['maximum'], message: 'Maximum salary cannot be lower than minimum salary' });
const skill = z.object({ name: text(100).min(1), required: z.boolean().default(true), minimumProficiency: z.enum(PROFICIENCY_LEVELS).default('beginner'), minimumYearsOfExperience: z.number().min(0).max(60).default(0), weight: z.number().int().min(1).max(100) }).strict();
const question = z.object({ question: text(500).min(1), type: z.enum(['text', 'textarea', 'number', 'boolean', 'single-choice', 'multiple-choice']), required: z.boolean().default(false), options: stringArray(20, 200).default([]) }).strict().superRefine((value, context) => {
  const needsOptions = ['single-choice', 'multiple-choice'].includes(value.type);
  if (needsOptions && value.options.length < 2) context.addIssue({ code: 'custom', path: ['options'], message: 'Choice questions require at least two options' });
  if (!needsOptions && value.options.length) context.addIssue({ code: 'custom', path: ['options'], message: 'Options are only supported for choice questions' });
});
const baseJobFields = {
  title: text(150).min(1), description: text(10000).min(1), responsibilities: stringArray(50), requirements: stringArray(50), preferredQualifications: stringArray(50),
  skills: z.array(skill).max(50).refine((items) => new Set(items.map((item) => item.name.toLowerCase())).size === items.length, 'Skill names must be unique'),
  employmentType: z.enum(EMPLOYMENT_TYPES), workMode: z.enum(WORK_MODES),
  location: z.object({ city: text(100).optional(), state: text(100).optional(), country: text(100).optional() }).strict().optional(), salary: salary.optional(),
  minimumExperience: z.number().min(0).max(60), maximumExperience: z.number().min(0).max(60).optional(), educationRequirements: stringArray(20, 300),
  openings: z.number().int().positive().max(10000), applicationDeadline: futureDate.optional(), applicationQuestions: z.array(question).max(30), assessmentRequired: z.boolean(), resumeRequired: z.boolean(), minimumProfileCompletion: z.number().min(0).max(100),
  department: text(100).optional(),
  hiringManager: objectId.optional(),
  scheduledPublishAt: futurePublishDate.optional().nullable(),
};
const rangeCheck = (value, context) => {
  if (value.maximumExperience !== undefined && value.minimumExperience !== undefined && value.maximumExperience < value.minimumExperience) context.addIssue({ code: 'custom', path: ['maximumExperience'], message: 'Maximum experience cannot be lower than minimum experience' });
};
export const jobCreateSchema = z.object({
  ...baseJobFields,
  responsibilities: baseJobFields.responsibilities.default([]),
  requirements: baseJobFields.requirements.default([]),
  preferredQualifications: baseJobFields.preferredQualifications.default([]),
  skills: baseJobFields.skills.default([]),
  minimumExperience: baseJobFields.minimumExperience.default(0),
  educationRequirements: baseJobFields.educationRequirements.default([]),
  openings: baseJobFields.openings.default(1),
  applicationQuestions: baseJobFields.applicationQuestions.default([]),
  assessmentRequired: baseJobFields.assessmentRequired.default(false),
  resumeRequired: baseJobFields.resumeRequired.default(true),
  minimumProfileCompletion: baseJobFields.minimumProfileCompletion.default(0),
  scheduledPublishAt: baseJobFields.scheduledPublishAt.default(null),
}).strict().superRefine(rangeCheck);
export const jobUpdateSchema = z.object(baseJobFields).partial().strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required').superRefine(rangeCheck);
export const jobIdParamsSchema = z.object({ jobId: objectId }).strict();
export const rejectJobSchema = z.object({ reason: text(2000).min(1) }).strict();
export const jobSearchSchema = z.object({
  page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(10), search: text(100).optional(),
  skills: z.string().trim().max(500).optional().transform((v) => v?.split(',').map((x) => x.trim()).filter(Boolean)), company: objectId.optional(), location: text(120).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(), workMode: z.enum(WORK_MODES).optional(), minimumSalary: z.coerce.number().nonnegative().optional(), maximumExperience: z.coerce.number().min(0).max(60).optional(),
  postedWithin: z.coerce.number().int().positive().max(3650).optional(), sort: z.enum(['newest', 'oldest', 'salary-high', 'salary-low', 'relevance', 'deadline']).default('newest'),
}).strict();

export const aiGenerateDescriptionSchema = z.object({
  title: text(150).min(1),
  keyRequirements: text(3000).optional().default('')
}).strict();

export const aiSuggestSkillsSchema = z.object({
  title: text(150).min(1),
  description: text(10000).min(1)
}).strict();

export const aiSafetyCheckSchema = z.object({
  title: text(150).min(1),
  description: text(10000).min(1)
}).strict();

