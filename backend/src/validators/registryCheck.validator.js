import mongoose from 'mongoose';
import { z } from 'zod';

const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');

export const runRegistryCheckSchema = z.object({
  checkType: z.enum([
    'company_registration',
    'gst_registration',
    'msme_registration',
    'domain_risk',
    'identity_cross_check'
  ]).default('company_registration'),
  provider: z.string().trim().max(100).default('mock_registry'),
  options: z.object({
    simulateMismatch: z.boolean().optional(),
    simulateNotFound: z.boolean().optional(),
    simulateUnavailable: z.boolean().optional()
  }).optional()
}).strict();

export const checkIdParamsSchema = z.object({
  companyId: objectId,
  checkId: objectId
}).strict();

export const overrideRegistryCheckSchema = z.object({
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters long').max(1000)
}).strict();
