import mongoose from 'mongoose';
import { z } from 'zod';

import { AppError } from '../shared/errors/AppError.js';

const currentYear = new Date().getUTCFullYear();
const text = (maximum) => z.string().trim().max(maximum);
const requiredText = (maximum) => text(maximum).min(1);
const optionalUrl = z.url().max(2048).optional();
const date = z.coerce.date();
const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), {
  message: 'Invalid MongoDB ObjectId',
});
const jobType = z.enum(['internship', 'full-time', 'part-time', 'contract', 'freelance']);

const locationSchema = z
  .object({ city: text(100).optional(), state: text(100).optional(), country: text(100).optional() })
  .strict();
const assetSchema = z.object({ url: z.url().max(2048), publicId: text(255).optional() }).strict();
const salarySchema = z
  .object({
    minimum: z.number().nonnegative().max(1_000_000_000),
    maximum: z.number().nonnegative().max(1_000_000_000),
    currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Currency must be a three-letter ISO code'),
  })
  .strict()
  .refine((salary) => salary.maximum >= salary.minimum, {
    message: 'Maximum salary cannot be lower than minimum salary',
    path: ['maximum'],
  });

export const candidateProfileUpdateSchema = z
  .object({
    headline: text(120).optional(),
    bio: text(1500).optional(),
    phone: z.string().trim().regex(/^[+()\-\s\d]{7,20}$/, 'Invalid phone number').optional(),
    location: locationSchema.optional(),
    dateOfBirth: date.max(new Date(), 'Date of birth cannot be in the future').optional(),
    gender: z.enum(['female', 'male', 'non-binary', 'prefer-not-to-say']).optional(),
    profilePhoto: assetSchema.nullable().optional(),
    resume: z
      .object({
        url: z.url().max(2048),
        publicId: text(255).optional(),
        fileName: requiredText(255),
        uploadedAt: date.max(new Date()).default(() => new Date()),
      })
      .strict()
      .nullable()
      .optional(),
    socialLinks: z
      .object({ github: optionalUrl, linkedin: optionalUrl, portfolio: optionalUrl })
      .strict()
      .optional(),
    preferredRoles: z.array(requiredText(100)).max(20).optional(),
    preferredJobTypes: z.array(jobType).max(5).optional(),
    preferredLocations: z.array(requiredText(120)).max(20).optional(),
    expectedSalary: salarySchema.nullable().optional(),
    availability: z.enum(['immediately', 'notice-period', 'unavailable']).optional(),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    profileVisibility: z.enum(['public', 'recruiters-only', 'private']).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'At least one profile field is required')
  .superRefine((data, context) => {
    if (data.availability === 'notice-period' && !data.noticePeriodDays) {
      context.addIssue({
        code: 'custom',
        path: ['noticePeriodDays'],
        message: 'Notice period days are required for notice-period availability',
      });
    }
  });

const educationBase = z
  .object({
    institution: requiredText(200),
    degree: requiredText(150),
    fieldOfStudy: text(150).optional(),
    startYear: z.number().int().min(1950).max(currentYear + 5),
    endYear: z.number().int().min(1950).max(currentYear + 10).optional(),
    currentlyStudying: z.boolean().default(false),
    grade: text(50).optional(),
    description: text(1000).optional(),
  })
  .strict();

const validateEducationDates = (entry, context) => {
  if (entry.currentlyStudying && entry.endYear !== undefined) {
    context.addIssue({ code: 'custom', path: ['endYear'], message: 'Current education cannot have an end year' });
  }
  if (entry.endYear !== undefined && entry.startYear !== undefined && entry.endYear < entry.startYear) {
    context.addIssue({ code: 'custom', path: ['endYear'], message: 'End year cannot precede start year' });
  }
};

export const educationCreateSchema = educationBase.superRefine(validateEducationDates);
export const educationUpdateSchema = educationBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one education field is required')
  .superRefine(validateEducationDates);

const skillBase = z
  .object({
    name: requiredText(100),
    proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    yearsOfExperience: z.number().min(0).max(60).default(0),
  })
  .strict();
export const skillsCreateSchema = z
  .union([skillBase, z.array(skillBase).min(1).max(50)])
  .transform((value) => (Array.isArray(value) ? value : [value]));
export const skillUpdateSchema = skillBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one skill field is required');

const experienceBase = z
  .object({
    company: requiredText(200),
    title: requiredText(150),
    employmentType: jobType.optional(),
    location: text(150).optional(),
    startDate: date,
    endDate: date.optional(),
    currentlyWorking: z.boolean().default(false),
    description: text(2000).optional(),
    skills: z.array(requiredText(100)).max(30).default([]),
  })
  .strict();
const validateDateRange = (entry, context, currentField) => {
  if (entry[currentField] && entry.endDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'Current entry cannot have an end date' });
  }
  if (entry.startDate && entry.endDate && entry.endDate < entry.startDate) {
    context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date cannot precede start date' });
  }
};
export const experienceCreateSchema = experienceBase.superRefine((entry, context) =>
  validateDateRange(entry, context, 'currentlyWorking'),
);
export const experienceUpdateSchema = experienceBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one experience field is required')
  .superRefine((entry, context) => validateDateRange(entry, context, 'currentlyWorking'));

const projectBase = z
  .object({
    title: requiredText(200),
    description: text(2000).optional(),
    technologies: z.array(requiredText(100)).max(30).default([]),
    githubUrl: optionalUrl,
    liveUrl: optionalUrl,
    startDate: date.optional(),
    endDate: date.optional(),
  })
  .strict();
export const projectCreateSchema = projectBase.superRefine((entry, context) =>
  validateDateRange(entry, context, 'currentlyWorking'),
);
export const projectUpdateSchema = projectBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one project field is required')
  .superRefine((entry, context) => validateDateRange(entry, context, 'currentlyWorking'));

const certificationBase = z
  .object({
    name: requiredText(200),
    issuingOrganization: requiredText(200),
    issueDate: date.optional(),
    expirationDate: date.optional(),
    credentialId: text(200).optional(),
    credentialUrl: optionalUrl,
  })
  .strict();
const validateCertificationDates = (entry, context) => {
  if (entry.issueDate && entry.expirationDate && entry.expirationDate < entry.issueDate) {
    context.addIssue({ code: 'custom', path: ['expirationDate'], message: 'Expiration date cannot precede issue date' });
  }
};
export const certificationCreateSchema = certificationBase.superRefine(validateCertificationDates);
export const certificationUpdateSchema = certificationBase
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one certification field is required')
  .superRefine(validateCertificationDates);

export const candidateIdParamsSchema = z.object({ candidateId: objectId }).strict();
export const nestedIdParamsSchema = (parameterName) =>
  z.object({ [parameterName]: objectId }).strict();

export const candidateSearchSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    search: text(100).optional(),
    skills: z.string().trim().max(500).optional().transform((value) => value?.split(',').map((item) => item.trim()).filter(Boolean)),
    location: text(120).optional(),
    preferredRole: text(100).optional(),
    jobType: jobType.optional(),
    availability: z.enum(['immediately', 'notice-period', 'unavailable']).optional(),
    minimumExperience: z.coerce.number().min(0).max(60).optional(),
    sort: z.enum(['newest', 'oldest', 'completion-desc', 'completion-asc']).default('newest'),
  })
  .strict();

const formatIssues = (error) =>
  error.issues.map((issue) => ({ field: issue.path.join('.') || 'request', message: issue.message }));

/** Validates and normalizes a request body. */
export const validateCandidateBody = (schema) => (request, _response, next) => {
  const result = schema.safeParse(request.body);
  if (!result.success) return next(new AppError('Validation failed', 400, formatIssues(result.error)));
  request.body = result.data;
  return next();
};

/** Validates route parameters, including nested Mongoose IDs. */
export const validateCandidateParams = (schema) => (request, _response, next) => {
  const result = schema.safeParse(request.params);
  if (!result.success) return next(new AppError('Validation failed', 400, formatIssues(result.error)));
  return next();
};

/** Validates and normalizes candidate-search query parameters. */
export const validateCandidateQuery = (request, _response, next) => {
  const result = candidateSearchSchema.safeParse(request.query);
  if (!result.success) return next(new AppError('Validation failed', 400, formatIssues(result.error)));
  request.validatedQuery = result.data;
  return next();
};
