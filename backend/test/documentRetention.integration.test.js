import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Document } from '../src/models/Document.js';
import { UserStorageUsage } from '../src/models/UserStorageUsage.js';
import { deleteDocumentAssetIfUnreferenced, retryProviderCleanup } from '../src/services/documentRetention.service.js';
import { getFileMetadata, resetMemoryStorage, uploadFile } from '../src/services/fileStorageProvider.service.js';

let replicaSet;
const id = () => new mongoose.Types.ObjectId();
const documentData = ({ owner, publicId, status = 'archived', suffix = '' }) => ({ owner, ownerRole: 'candidate', uploadedBy: owner, category: 'resume', purpose: `Retained ${suffix}`, entityType: 'candidate-profile', entityId: id(), originalFileName: `resume-${suffix}.pdf`, displayName: 'Resume', extension: 'pdf', mimeType: 'application/pdf', mediaType: 'document', sizeBytes: 20, checksum: String(id()).padEnd(64, 'a'), storage: { provider: 'memory', publicId, resourceType: 'raw' }, access: 'private', status, isCurrent: false });

beforeAll(async () => { replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(replicaSet.getUri()); await Promise.all([Document.init(), UserStorageUsage.init()]); });
beforeEach(async () => { await Promise.all([Document.deleteMany({}), UserStorageUsage.deleteMany({})]); resetMemoryStorage(); });
afterAll(async () => { await mongoose.disconnect(); await replicaSet.stop(); });

describe('provider-reference retention and cleanup retries', () => {
  it('retains a shared same-owner asset until the final reference and decrements usage once', async () => { const owner = id(); const stored = await uploadFile({ buffer: Buffer.from('%PDF-1.4\nShared'), fileName: 'shared.pdf', mimeType: 'application/pdf', folder: `talvix/candidate/${owner}`, resourceType: 'raw' }); const [first, final] = await Document.create([documentData({ owner, publicId: stored.publicId, suffix: 'application' }), documentData({ owner, publicId: stored.publicId, suffix: 'profile' })]); await UserStorageUsage.create({ user: owner, usedBytes: 20, documentCount: 1 }); expect(await deleteDocumentAssetIfUnreferenced(first)).toMatchObject({ deleted: false, skipped: 'referenced' }); expect(await getFileMetadata({ publicId: stored.publicId })).not.toBeNull(); await Document.updateOne({ _id: first.id }, { status: 'deleted' }); expect(await deleteDocumentAssetIfUnreferenced(final)).toMatchObject({ deleted: true }); expect(await getFileMetadata({ publicId: stored.publicId })).toBeNull(); const usage = await UserStorageUsage.findOne({ user: owner }); expect(usage.toObject()).toMatchObject({ usedBytes: 0, documentCount: 0 }); expect(await retryProviderCleanup(final.id)).toMatchObject({ absent: true }); expect((await UserStorageUsage.findOne({ user: owner })).usedBytes).toBe(0); });
  it('fails closed across users and rechecks references before a pending cleanup retry', async () => { const owner = id(); const other = id(); const invalidPublicId = `talvix/candidate/${owner}/../unsafe`; const first = await Document.create(documentData({ owner, publicId: invalidPublicId, suffix: 'failed' })); await UserStorageUsage.create({ user: owner, usedBytes: 20, documentCount: 1 }); expect(await deleteDocumentAssetIfUnreferenced(first)).toMatchObject({ pending: true }); expect((await Document.findById(first.id)).metadata.providerCleanup).toMatchObject({ status: 'pending', reason: 'provider-unavailable' }); await Document.create(documentData({ owner: other, publicId: invalidPublicId, suffix: 'cross-user-reference' })); expect(await retryProviderCleanup(first.id)).toMatchObject({ deleted: false, skipped: 'referenced' }); expect((await Document.findById(first.id)).metadata.providerCleanup.status).toBe('skipped'); expect((await UserStorageUsage.findOne({ user: owner })).usedBytes).toBe(20); });
});
