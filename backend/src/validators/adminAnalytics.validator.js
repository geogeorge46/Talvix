import { z } from 'zod';
import { ANALYTICS_INTERVALS, ANALYTICS_PRESETS, ANALYTICS_REPORTS } from '../constants/analytics.js';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const analyticsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  preset: z.enum(ANALYTICS_PRESETS).optional(),
  timezone: z.literal('UTC').default('UTC'),
  interval: z.enum(ANALYTICS_INTERVALS).optional(),
  companyId: objectId.optional(),
  jobId: objectId.optional(),
  role: z.enum(['candidate', 'recruiter', 'admin']).optional(),
  status: z.string().trim().max(50).optional(),
  category: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(150).optional(),
  workMode: z.enum(['onsite', 'remote', 'hybrid']).optional(),
  employmentType: z.string().trim().max(50).optional(),
  eventType: z.string().trim().max(100).optional(),
  recruiterId: objectId.optional(),
  department: z.string().trim().max(100).optional(),
  university: z.string().trim().max(150).optional(),
  assessmentId: objectId.optional(),
  search: z.string().trim().optional(),
  page: z.preprocess((v) => parseInt(String(v || 1), 10), z.number().int().min(1).default(1)),
  limit: z.preprocess((v) => parseInt(String(v || 20), 10), z.number().int().min(1).max(100).default(20)),
  sortBy: z.string().trim().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).strict().superRefine((value, context) => {
  if (Boolean(value.from) !== Boolean(value.to)) context.addIssue({ code: 'custom', message: 'from and to must be provided together', path: ['from'] });
  if (value.preset && value.from) context.addIssue({ code: 'custom', message: 'preset cannot be combined with custom dates', path: ['preset'] });
});

export const exportQuery = analyticsQuery.extend({ report: z.enum(ANALYTICS_REPORTS), format: z.enum(['json', 'csv']).default('json') });
