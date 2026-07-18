import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Notification } from '../src/models/Notification.js';
import { NotificationOutbox } from '../src/models/NotificationOutbox.js';
import { NotificationPreference } from '../src/models/NotificationPreference.js';
import { NotificationTemplate } from '../src/models/NotificationTemplate.js';
import { User } from '../src/models/User.js';
import { createNotification } from '../src/services/notification.service.js';
import { processOutboxBatch } from '../src/services/notificationOutbox.service.js';
import { claimPendingEvent } from '../src/services/notificationOutbox.service.js';
import { publishDomainEvent } from '../src/services/domainEvent.service.js';
import { DOMAIN_EVENTS } from '../src/constants/domainEvents.js';
import { NOTIFICATION_TYPES } from '../src/constants/notification.js';
import { seedNotificationTemplates } from '../src/scripts/seedNotificationTemplates.js';

let replicaSet;
let sequence = 0;
const register = async (role = 'candidate') => { sequence += 1; const response = await request(app).post('/api/v1/auth/register').send({ fullName: `User ${sequence}`, email: `notify.${sequence}@talvix.test`, password: 'Strong!Pass123', role }).expect(201); return { token: response.body.data.accessToken, user: response.body.data.user }; };
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([User.init(), Notification.init(), NotificationOutbox.init(), NotificationPreference.init(), NotificationTemplate.init()]); });
beforeEach(async () => Promise.all([User.deleteMany({}), Notification.deleteMany({}), NotificationOutbox.deleteMany({}), NotificationPreference.deleteMany({}), NotificationTemplate.deleteMany({})]));
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('notification inbox and outbox', () => {
  it('rejects unknown internal payload fields and does not claim future events', async () => { const account = await register(); await NotificationOutbox.deleteMany({}); await expect(publishDomainEvent({ type: DOMAIN_EVENTS.ACCOUNT_SECURITY_ALERT, recipientIds: [account.user._id], deduplicationKey: 'security:test', payload: { userId: account.user._id, password: 'forbidden' } })).rejects.toBeTruthy(); await publishDomainEvent({ type: DOMAIN_EVENTS.ASSESSMENT_REMINDER, recipientIds: [account.user._id], deduplicationKey: 'assessment.reminder:test:24h', availableAt: new Date(Date.now() + 3600000), payload: { assignmentId: account.user._id, reminderOffset: '24h' } }); expect(await claimPendingEvent()).toBeNull(); });
  it('returns the atomically updated outbox document with modern Mongoose options', async () => { const account = await register(); await NotificationOutbox.deleteMany({}); const event = await publishDomainEvent({ type: DOMAIN_EVENTS.ACCOUNT_SECURITY_ALERT, recipientIds: [account.user._id], deduplicationKey: 'security:claim', payload: { userId: account.user._id } }); const claimed = await claimPendingEvent(); expect(claimed.id).toBe(event.id); expect(claimed.status).toBe('processing'); expect(claimed.attempts).toBe(1); });
  it('persists registration events and processes them idempotently', async () => { const account = await register(); expect(await NotificationOutbox.countDocuments()).toBe(1); await processOutboxBatch(20); await processOutboxBatch(20); expect(await Notification.countDocuments({ recipient: account.user._id, type: 'account-welcome' })).toBe(1); });
  it('isolates inboxes and supports unread, read, archive, and counts', async () => { const first = await register(); const second = await register(); await processOutboxBatch(20); const listed = await auth('get', '/api/v1/notifications', first.token).expect(200); expect(listed.body.data.notifications).toHaveLength(1); expect(listed.body.data.notifications[0].data).not.toHaveProperty('password'); const id = listed.body.data.notifications[0].id; await auth('patch', `/api/v1/notifications/${id}/read`, second.token).expect(404); await auth('patch', `/api/v1/notifications/${id}/read`, first.token).expect(200); expect((await auth('get', '/api/v1/notifications/unread-count', first.token).expect(200)).body.data.unreadCount).toBe(0); await auth('patch', `/api/v1/notifications/${id}/archive`, first.token).expect(200); });
  it('deduplicates notification creation and rejects external action URLs', async () => { const account = await register(); const input = { recipientId: account.user._id, type: 'admin-alert', title: 'Alert', message: 'Safe', source: 'admin', deduplicationKey: 'one-alert' }; await Promise.all([createNotification(input), createNotification(input)]); expect(await Notification.countDocuments({ deduplicationKey: 'one-alert' })).toBe(1); await expect(createNotification({ ...input, deduplicationKey: 'bad-url', data: { actionUrl: 'https://evil.example' } })).rejects.toMatchObject({ statusCode: 400 }); });
});

describe('preferences, templates, and administration', () => {
  it('seeds every system template idempotently without overwriting versions', async () => { const first = await seedNotificationTemplates(); const second = await seedNotificationTemplates(); expect(first.inserted).toBe(NOTIFICATION_TYPES.length * 2); expect(second.inserted).toBe(0); expect(await NotificationTemplate.countDocuments()).toBe(NOTIFICATION_TYPES.length * 2); });
  it('validates preferences and preserves mandatory security delivery', async () => { const account = await register(); await auth('put', '/api/v1/notifications/preferences', account.token).send({ types: { invented: { inApp: false, email: false } } }).expect(400); await auth('put', '/api/v1/notifications/preferences', account.token).send({ digest: { enabled: true, frequency: 'daily', timezone: 'Invalid/Zone', preferredHour: 9 } }).expect(400); const updated = await auth('put', '/api/v1/notifications/preferences', account.token).send({ global: { inAppEnabled: false, emailEnabled: false } }).expect(200); expect(updated.body.data.preferences.mandatorySecurityEmails).toBe(true); });
  it('restricts template management to admins and escapes previews', async () => { const candidate = await register(); const admin = await register(); await User.updateOne({ _id: admin.user._id }, { role: 'admin' }); const body = { key: 'welcome-email', type: 'account-welcome', channel: 'email', name: 'Welcome', subject: 'Hello {{name}}', body: '<p>Hello {{name}}</p>', variables: ['name'] }; await auth('post', '/api/v1/notifications/admin/templates', candidate.token).send(body).expect(403); const created = await auth('post', '/api/v1/notifications/admin/templates', admin.token).send(body).expect(201); const id = created.body.data.template._id; const preview = await auth('post', `/api/v1/notifications/admin/templates/${id}/preview`, admin.token).send({ variables: { name: '<script>alert(1)</script>' } }).expect(200); expect(preview.body.data.html).toContain('&lt;script&gt;'); await auth('post', '/api/v1/notifications/admin/templates', admin.token).send({ ...body, key: 'unsafe-email', body: '<img onerror="alert(1)">' }).expect(400); });
});
