import mongoose from 'mongoose';
import { z } from 'zod';
import { APPLICATION_STATUSES, MAX_APPLICATION_ASSIGNEES, REJECTION_CATEGORIES } from '../constants/application.js';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
const text = (max) => z.string().trim().max(max);
const answerValue = z.union([z.string().max(10000), z.number().finite(), z.boolean(), z.array(z.string().max(1000)).max(50)]);
export const applicationSubmitSchema = z.object({ jobId: objectId, coverLetter: text(5000).optional(), answers: z.array(z.object({ questionId: objectId, answer: answerValue }).strict()).max(50).default([]) }).strict();
export const applicationIdParamsSchema = z.object({ applicationId: objectId }).strict();
export const applicationJobParamsSchema = z.object({ jobId: objectId }).strict();
export const noteParamsSchema = z.object({ applicationId: objectId, noteId: objectId }).strict();
export const withdrawalSchema = z.object({ reason: text(1000).min(1) }).strict();
export const candidateOfferStatusSchema = z.object({ status: z.enum(['offer-accepted', 'offer-declined']), reason: text(1000).optional() }).strict();
export const recruiterStatusSchema = z.object({ status: z.enum(APPLICATION_STATUSES), reason: text(2000).optional(), rejectionCategory: z.enum(REJECTION_CATEGORIES).optional() }).strict();
export const adminStatusSchema = z.object({ status: z.enum(APPLICATION_STATUSES), reason: text(2000).min(1) }).strict();
export const noteSchema = z.object({ note: text(3000).min(1), isPrivate: z.boolean().default(true) }).strict();
export const noteUpdateSchema = z.object({ note: text(3000).min(1).optional(), isPrivate: z.boolean().optional() }).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required');
export const ratingSchema = z.object({ rating: z.number().int().min(1).max(5) }).strict();
export const tagsSchema = z.object({ tags: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)).max(20).transform((values) => [...new Set(values)]) }).strict();
export const assigneesSchema = z.object({ recruiterIds: z.array(objectId).max(MAX_APPLICATION_ASSIGNEES).transform((values) => [...new Set(values)]) }).strict();

const pagination = { page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(10) };
export const candidateApplicationsQuerySchema = z.object({ ...pagination, status: z.enum(APPLICATION_STATUSES).optional(), company: objectId.optional(), search: text(100).optional(), sort: z.enum(['newest', 'oldest', 'status', 'match-high', 'match-low']).default('newest') }).strict();
export const recruiterApplicationsQuerySchema = z.object({
  ...pagination, jobId: objectId.optional(), status: z.enum(APPLICATION_STATUSES).optional(), search: text(100).optional(),
  skills: z.string().trim().max(500).optional().transform((v) => v?.split(',').map((x) => x.trim()).filter(Boolean)),
  minimumMatchScore: z.coerce.number().min(0).max(100).optional(), maximumMatchScore: z.coerce.number().min(0).max(100).optional(), minimumRating: z.coerce.number().min(1).max(5).optional(),
  tags: z.string().trim().max(500).optional().transform((v) => v?.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean)), assignedRecruiter: objectId.optional(),
  submittedFrom: z.coerce.date().optional(), submittedTo: z.coerce.date().optional(), sort: z.enum(['newest', 'oldest', 'match-high', 'match-low', 'rating-high', 'rating-low', 'candidate-name']).default('newest'),
}).strict().superRefine((value, context) => { if (value.minimumMatchScore !== undefined && value.maximumMatchScore !== undefined && value.maximumMatchScore < value.minimumMatchScore) context.addIssue({ code: 'custom', path: ['maximumMatchScore'], message: 'Maximum match score cannot be lower than minimum' }); if (value.submittedFrom && value.submittedTo && value.submittedTo < value.submittedFrom) context.addIssue({ code: 'custom', path: ['submittedTo'], message: 'End date cannot precede start date' }); });
export const pipelineQuerySchema = z.object({ jobId: objectId.optional() }).strict();
export const adminApplicationsQuerySchema = z.object({ ...pagination, company: objectId.optional(), job: objectId.optional(), candidate: objectId.optional(), status: z.enum(APPLICATION_STATUSES).optional(), submittedFrom: z.coerce.date().optional(), submittedTo: z.coerce.date().optional(), archived: z.enum(['true', 'false']).transform((value) => value === 'true').default(false) }).strict();

export const bulkOperationSchema = z.object({
  applicationIds: z.array(objectId).min(1).max(100),
  action: z.enum(['move-stage', 'reject', 'assign-recruiter', 'add-tags', 'archive']),
  payload: z.object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    reason: text(2000).optional(),
    rejectionCategory: z.enum(REJECTION_CATEGORIES).optional(),
    recruiterIds: z.array(objectId).optional(),
    tags: z.array(z.string().trim()).optional(),
  }).strict().optional().default(() => ({})),
}).strict().superRefine((val, ctx) => {
  if (val.action === 'move-stage' && !val.payload?.status) {
    ctx.addIssue({ code: 'custom', path: ['payload', 'status'], message: 'Status is required for move-stage action' });
  }
  if (val.action === 'reject' && !val.payload?.reason) {
    ctx.addIssue({ code: 'custom', path: ['payload', 'reason'], message: 'Reason is required for rejection action' });
  }
  if (val.action === 'assign-recruiter' && !val.payload?.recruiterIds) {
    ctx.addIssue({ code: 'custom', path: ['payload', 'recruiterIds'], message: 'Recruiter IDs are required for assignment action' });
  }
  if (val.action === 'add-tags' && !val.payload?.tags) {
    ctx.addIssue({ code: 'custom', path: ['payload', 'tags'], message: 'Tags are required for tagging action' });
  }
});

export const commentCreateSchema = z.object({
  content: text(5000).min(1),
  parentId: objectId.optional().nullable()
}).strict();

export const commentParamsSchema = z.object({
  applicationId: objectId,
  commentId: objectId
}).strict();

export const companyTagCreateSchema = z.object({
  name: text(50).min(1),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional()
}).strict();

export const companyTagParamsSchema = z.object({
  tagId: objectId
}).strict();
