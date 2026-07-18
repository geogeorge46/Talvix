import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { NotificationOutbox } from '../models/NotificationOutbox.js';
import { createNotification } from './notification.service.js';
import { notificationInputForEvent } from './workflowNotification.service.js';
import { isReminderCurrent } from './reminderValidation.service.js';

const defaultDependencies = { createNotification, notificationInputForEvent, isReminderCurrent };
let dependencies = { ...defaultDependencies };
export const configureNotificationOutboxDependencies = (overrides = {}) => { dependencies = { ...defaultDependencies, ...overrides }; };
export const resetNotificationOutboxDependencies = () => { dependencies = { ...defaultDependencies }; };

export const enqueueEvent = async (input, session) => { try { const [event] = await NotificationOutbox.create([{ ...input, maxAttempts: input.maxAttempts ?? env.EMAIL_MAX_ATTEMPTS }], { session }); return event; } catch (error) { if (error.code === 11000) return NotificationOutbox.findOne({ deduplicationKey: input.deduplicationKey }); throw error; } };
export const releaseStaleLocks = () => NotificationOutbox.updateMany({ status: 'processing', lockedAt: { $lt: new Date(Date.now() - 300000) } }, { $set: { status: 'pending', lockedAt: null, lockedBy: null } });
export const claimPendingEvent = () => NotificationOutbox.findOneAndUpdate({ status: 'pending', availableAt: { $lte: new Date() }, $expr: { $lt: ['$attempts','$maxAttempts'] } }, { $set: { status: 'processing', lockedAt: new Date(), lockedBy: randomUUID() }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { availableAt: 1 } });
const delays = [60000, 300000, 1800000];
export const processEvent = async (event) => { try { if (!await dependencies.isReminderCurrent(event)) { event.status = 'cancelled'; event.processedAt = new Date(); event.lastError = 'Stale reminder skipped'; } else { for (const recipientId of event.recipientIds) { const key = event.deduplicationKey ? `${event.deduplicationKey}:${recipientId}` : `outbox:${event.id}:${recipientId}`; await dependencies.createNotification({ ...dependencies.notificationInputForEvent(event.eventType, event.payload), recipientId, company: event.company, deduplicationKey: key }); } event.status = 'completed'; event.processedAt = new Date(); event.lastError = undefined; } } catch (error) { event.lastError = String(error.message).slice(0, 1000); if (event.attempts >= event.maxAttempts) event.status = 'failed'; else { event.status = 'pending'; event.availableAt = new Date(Date.now() + delays[Math.min(event.attempts - 1, delays.length - 1)]); } } event.lockedAt = undefined; event.lockedBy = undefined; await event.save(); return event; };
export const processOutboxBatch = async (limit = 20) => { await releaseStaleLocks(); const results = []; for (let index = 0; index < Math.min(limit, 20); index += 1) { const event = await claimPendingEvent(); if (!event) break; results.push(await processEvent(event)); } return results; };
export const retryEvent = (id) => NotificationOutbox.findOneAndUpdate({ _id: id, status: 'failed', $expr: { $lt: ['$attempts','$maxAttempts'] } }, { $set: { status: 'pending', availableAt: new Date(), lastError: null } }, { returnDocument: 'after' });
export const cancelEvent = (id) => NotificationOutbox.findOneAndUpdate({ _id: id, status: { $in: ['pending','failed'] } }, { $set: { status: 'cancelled' } }, { returnDocument: 'after' });
