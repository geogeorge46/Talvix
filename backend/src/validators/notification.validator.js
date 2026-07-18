import { z } from 'zod';

import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES, OUTBOX_STATUSES } from '../constants/notification.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
const timezone = z.string().trim().min(1).max(100).refine((value) => {
  try { Intl.DateTimeFormat(undefined, { timeZone: value }); return true; } catch { return false; }
}, 'Invalid IANA timezone');
const channelSetting = z.object({ inApp: z.boolean(), email: z.boolean() }).strict();
const categorySettings = z.object(Object.fromEntries(NOTIFICATION_CATEGORIES.map((key) => [key, channelSetting.optional()]))).strict();

export const notificationIdParams = z.object({ notificationId: objectId }).strict();
export const templateIdParams = z.object({ templateId: objectId }).strict();
export const eventIdParams = z.object({ eventId: objectId }).strict();
export const inboxQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(10), read: booleanQuery.optional(), archived: booleanQuery.optional(), category: z.enum(NOTIFICATION_CATEGORIES).optional(), type: z.enum(NOTIFICATION_TYPES).optional(), priority: z.enum(NOTIFICATION_PRIORITIES).optional(), sort: z.enum(['newest', 'oldest', 'priority']).default('newest') }).strict();
export const bulkBody = z.object({ notificationIds: z.array(objectId).min(1).max(100) }).strict();
export const preferenceBody = z.object({
  global: z.object({ inAppEnabled: z.boolean(), emailEnabled: z.boolean() }).strict().optional(),
  categories: categorySettings.optional(),
  types: z.record(z.enum(NOTIFICATION_TYPES), channelSetting).optional(),
  digest: z.object({ enabled: z.boolean(), frequency: z.enum(['daily', 'weekly']), timezone, preferredHour: z.number().int().min(0).max(23) }).strict().optional(),
  quietHours: z.object({ enabled: z.boolean(), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(0).max(23), timezone }).strict().optional(),
}).strict();
const variable = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(50);
export const templateBody = z.object({ key: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120), type: z.enum(NOTIFICATION_TYPES), channel: z.enum(['in-app', 'email']), name: z.string().trim().min(1).max(200), subject: z.string().trim().max(300).optional(), title: z.string().trim().max(200).optional(), body: z.string().min(1).max(20000), variables: z.array(variable).max(50).default([]), description: z.string().max(2000).optional(), locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).default('en'), isSystem: z.boolean().optional() }).strict().superRefine((value, context) => {
  if (value.channel === 'email' && !value.subject) context.addIssue({ code: 'custom', path: ['subject'], message: 'Subject is required for email templates' });
  if (value.channel === 'in-app' && !value.title) context.addIssue({ code: 'custom', path: ['title'], message: 'Title is required for in-app templates' });
});
export const templateUpdateBody = z.object({ name: z.string().trim().min(1).max(200), subject: z.string().trim().max(300), title: z.string().trim().max(200), body: z.string().min(1).max(20000), variables: z.array(variable).max(50), description: z.string().max(2000), locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/) }).partial().strict();
export const previewBody = z.object({ variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])) }).strict();
export const processBody = z.object({ limit: z.number().int().min(1).max(20).default(20) }).strict();
export const adminQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20), recipient: objectId.optional(), company: objectId.optional(), type: z.enum(NOTIFICATION_TYPES).optional(), category: z.enum(NOTIFICATION_CATEGORIES).optional(), priority: z.enum(NOTIFICATION_PRIORITIES).optional(), emailStatus: z.enum(['not-requested','pending','processing','sent','delivered','failed','suppressed','cancelled']).optional(), outboxStatus: z.enum(OUTBOX_STATUSES).optional() }).strict();
