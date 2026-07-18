import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
export const recruiterUpdateSchema = z.object({
  designation: z.string().trim().max(150).optional(), department: z.string().trim().max(150).optional(),
  phone: z.string().trim().regex(/^[+()\-\s\d]{7,20}$/).optional(),
  profilePhoto: z.object({ url: z.url(), publicId: z.string().trim().max(255).optional() }).strict().nullable().optional(),
  linkedinUrl: z.url().optional(), bio: z.string().trim().max(1000).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required');
export const recruiterIdParamsSchema = z.object({ recruiterId: objectId }).strict();
export const adminRecruiterActionSchema = z.object({ reason: z.string().trim().max(1000).optional() }).strict();
export const pendingRecruiterQuerySchema = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(10) }).strict();
