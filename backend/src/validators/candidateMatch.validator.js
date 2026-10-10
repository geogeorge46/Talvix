import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');

export const applicantMatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  minScore: z.coerce.number().min(0).max(100).optional(),
  skill: z.string().trim().max(100).optional(),
  sort: z.enum(['score-desc', 'score-asc', 'newest']).default('score-desc')
}).strict();

export const candidateMatchParamsSchema = z.object({
  jobId: objectId,
  candidateId: objectId
}).strict();

export const applicationMatchParamsSchema = z.object({
  applicationId: objectId
}).strict();

export const jobMatchParamsSchema = z.object({
  jobId: objectId
}).strict();
