import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Document } from '../src/models/Document.js';
import { FileUploadSession } from '../src/models/FileUploadSession.js';
import { Notification } from '../src/models/Notification.js';
import { NotificationOutbox } from '../src/models/NotificationOutbox.js';
import { StorageReservation } from '../src/models/StorageReservation.js';
import { User } from '../src/models/User.js';
import { UserStorageUsage } from '../src/models/UserStorageUsage.js';
import { processOutboxBatch } from '../src/services/notificationOutbox.service.js';
import { resetMemoryStorage } from '../src/services/fileStorageProvider.service.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { notificationInputForEvent } from '../src/services/workflowNotification.service.js';
import { DOMAIN_EVENTS } from '../src/constants/domainEvents.js';

let replicaSet; let sequence = 0;
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const register = async () => { sequence += 1; const response = await request(app).post('/api/v1/auth/register').send({ fullName: `Quarantine ${sequence}`, email: `quarantine.${sequence}@talvix.test`, password: 'Strong!Pass123', role: 'candidate' }).expect(201); return { token: response.body.data.accessToken, user: response.body.data.user }; };
const upload = async (actor) => { const session = (await api('post', '/api/v1/documents/upload-session', actor.token).send({ category: 'resume', entityType: 'user', purpose: 'Security test' }).expect(201)).body.data.uploadSession.id; return (await api('post', '/api/v1/documents/upload', actor.token).field('uploadSessionId', session).field('category', 'resume').field('purpose', 'Security test').attach('file', Buffer.from(`%PDF-1.4\nSecurity ${sequence}`), { filename: 'security.pdf', contentType: 'application/pdf' }).expect(201)).body.data.document.id; };

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([User.init(), Document.init(), FileUploadSession.init(), StorageReservation.init(), UserStorageUsage.init(), NotificationOutbox.init(), Notification.init()]); });
beforeEach(async () => { await Promise.all([User.deleteMany({}), Document.deleteMany({}), FileUploadSession.deleteMany({}), StorageReservation.deleteMany({}), UserStorageUsage.deleteMany({}), NotificationOutbox.deleteMany({}), Notification.deleteMany({})]); resetMemoryStorage(); });
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('document quarantine notification safety', () => {
  it('uses distinct candidate-safe suspicious, quarantined, and infected wording', () => { const suspicious = notificationInputForEvent(DOMAIN_EVENTS.DOCUMENT_QUARANTINED, { status: 'suspicious' }).message; const quarantined = notificationInputForEvent(DOMAIN_EVENTS.DOCUMENT_QUARANTINED, { status: 'quarantined' }).message; const infected = notificationInputForEvent(DOMAIN_EVENTS.DOCUMENT_QUARANTINED, { status: 'infected' }).message; expect(suspicious).toBe('The document was flagged for security review.'); expect(suspicious).not.toMatch(/malware confirmed|infected|virus detected/i); expect(quarantined).toBe('The document has been temporarily restricted while it is reviewed.'); expect(quarantined).not.toMatch(/infected|virus/i); expect(infected).toMatch(/unsafe/); });
  it('notifies only the owner, excludes private metadata, and deduplicates identical scan actions and outbox retries', async () => { const owner = await register(); const unrelated = await register(); const admin = await register(); await User.updateOne({ _id: admin.user._id }, { role: 'admin' }); admin.token = generateAccessToken(admin.user._id); const id = await upload(owner); await NotificationOutbox.deleteMany({}); await api('patch', `/api/v1/documents/admin/${id}/scan-status`, admin.token).send({ status: 'suspicious', reason: 'Internal scanner response: signature 123' }).expect(200); await api('patch', `/api/v1/documents/admin/${id}/scan-status`, admin.token).send({ status: 'suspicious', reason: 'Repeated private detail' }).expect(200); const events = await NotificationOutbox.find({ eventType: 'document.quarantined' }).lean(); expect(events).toHaveLength(1); expect(events[0].recipientIds.map(String)).toEqual([owner.user._id]); expect(events[0].recipientIds.map(String)).not.toContain(unrelated.user._id); expect(events[0].recipientIds.map(String)).not.toContain(admin.user._id); expect(JSON.stringify(events[0])).not.toMatch(/scanner response|signature 123|publicId|checksum|secureUrl|signedUrl|provider/i); await processOutboxBatch(20); await processOutboxBatch(20); expect(await Notification.countDocuments({ recipient: owner.user._id, type: 'document-quarantined' })).toBe(1); expect((await Notification.findOne({ recipient: owner.user._id })).message).toBe('The document was flagged for security review.'); });
});
