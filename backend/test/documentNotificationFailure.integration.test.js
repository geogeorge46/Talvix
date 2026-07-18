import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notification } from '../src/models/Notification.js';
import { NotificationOutbox } from '../src/models/NotificationOutbox.js';
import { User } from '../src/models/User.js';
import { publishOptionalDomainEvent } from '../src/services/domainEvent.service.js';
import { configureNotificationOutboxDependencies, processEvent, resetNotificationOutboxDependencies } from '../src/services/notificationOutbox.service.js';
import { DOMAIN_EVENTS } from '../src/constants/domainEvents.js';

let replicaSet;
const userId = () => new mongoose.Types.ObjectId();
const event = (recipient, attempts = 1, maxAttempts = 3) => NotificationOutbox.create({ eventType: DOMAIN_EVENTS.DOCUMENT_VERIFIED, recipientIds: [recipient], payload: { documentId: String(userId()) }, status: 'processing', attempts, maxAttempts, deduplicationKey: `failure:${userId()}`, lockedAt: new Date(), lockedBy: 'test' });

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([User.init(), Notification.init(), NotificationOutbox.init()]); });
beforeEach(async () => Promise.all([User.deleteMany({}), Notification.deleteMany({}), NotificationOutbox.deleteMany({})]));
afterEach(() => { resetNotificationOutboxDependencies(); vi.restoreAllMocks(); });
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('document notification failure isolation', () => {
  it('isolates domain-event publication failure without malformed persistence', async () => { vi.spyOn(NotificationOutbox, 'create').mockRejectedValueOnce(new Error('private database detail')); const result = await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.DOCUMENT_VERIFIED, recipientIds: [String(userId())], payload: { documentId: String(userId()) }, deduplicationKey: `publication:${userId()}` }); expect(result).toBeNull(); expect(await NotificationOutbox.countDocuments()).toBe(0); });

  it.each([
    ['recipient resolution', 'RECIPIENT_RESOLUTION_FAILED'],
    ['template lookup', 'TEMPLATE_NOT_FOUND'],
    ['template rendering', 'TEMPLATE_RENDER_FAILED'],
    ['notification persistence', 'NOTIFICATION_PERSIST_FAILED'],
    ['outbox processing', 'OUTBOX_PROCESSING_FAILED'],
    ['temporary email delivery', 'EMAIL_TEMPORARY_FAILURE'],
  ])('records and bounds retryable %s failure', async (_layer, code) => { const recipient = userId(); const row = await event(recipient); configureNotificationOutboxDependencies({ createNotification: async () => { throw new Error(code); } }); const processed = await processEvent(row); expect(processed.status).toBe('pending'); expect(processed.lastError).toBe(code); expect(processed.availableAt.getTime()).toBeGreaterThan(Date.now()); expect(processed.availableAt.getTime()).toBeLessThanOrEqual(Date.now() + 61000); expect(await Notification.countDocuments()).toBe(0); expect(JSON.stringify(processed)).not.toMatch(/publicId|checksum|secureUrl|api[_-]?key|buffer/i); });

  it('terminates permanent email failure without duplicate notification or infinite retry', async () => { const row = await event(userId(), 3, 3); configureNotificationOutboxDependencies({ createNotification: async () => { throw new Error('EMAIL_PERMANENT_FAILURE'); } }); const processed = await processEvent(row); expect(processed.status).toBe('failed'); expect(processed.lastError).toBe('EMAIL_PERMANENT_FAILURE'); expect(await Notification.countDocuments()).toBe(0); });
});
