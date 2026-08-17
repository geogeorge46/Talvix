import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
const text = (max) => z.string().trim().max(max);

export const talentPoolQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
  search: text(100).optional(),
  status: z.enum(['sourced', 'interested', 'contacted', 'silver-medalist', 'archived']).optional(),
  skills: z.string().trim().max(500).optional().transform((v) => v?.split(',').map((x) => x.trim()).filter(Boolean)),
  matchJobId: objectId.optional(),
}).strict();

export const addTalentPoolMemberSchema = z.object({
  candidateId: objectId,
  status: z.enum(['sourced', 'interested', 'contacted', 'silver-medalist', 'archived']).optional().default('sourced'),
  tags: z.array(objectId).optional().default([]),
}).strict();

export const updateTalentPoolMemberSchema = z.object({
  status: z.enum(['sourced', 'interested', 'contacted', 'silver-medalist', 'archived']).optional(),
  tags: z.array(objectId).optional(),
}).strict();

export const talentPoolNoteSchema = z.object({
  content: text(2000).min(1),
}).strict();

export const talentPoolIdParamsSchema = z.object({
  id: objectId,
}).strict();

export const createCompanyTagSchema = z.object({
  name: text(50).min(1),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color code').optional().default('#6366F1'),
}).strict();
