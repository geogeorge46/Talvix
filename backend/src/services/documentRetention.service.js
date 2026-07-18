import { Document } from '../models/Document.js';
import { deleteFile } from './fileStorageProvider.service.js';
import { decrementStoredUsage } from './storageReservation.service.js';

const cleanupLocks = new Map();
const providerFilter = (document) => ({ _id: { $ne: document.id }, 'storage.provider': document.storage.provider, 'storage.publicId': document.storage.publicId, status: { $ne: 'deleted' } });
const cleanupState = (status, extra = {}) => ({ 'metadata.providerCleanup': { status, updatedAt: new Date(), ...extra } });

export const countRetainedProviderReferences = (document) => Document.countDocuments(providerFilter(document));
export const canDeleteProviderAsset = async (document) => await countRetainedProviderReferences(document) === 0;

const deleteUnlocked = async (document) => {
  if (document.metadata?.providerCleanup?.status === 'completed') return { deleted: false, absent: true };
  if (!await canDeleteProviderAsset(document)) {
    await Document.updateOne({ _id: document.id }, { $set: cleanupState('skipped', { reason: 'retained-reference' }) });
    return { deleted: false, skipped: 'referenced' };
  }
  try {
    const result = await deleteFile({ publicId: document.storage.publicId, resourceType: document.storage.resourceType });
    if (result.deleted) await decrementStoredUsage(document.owner, document.sizeBytes);
    await Document.updateOne({ _id: document.id }, { $set: cleanupState(result.deleted ? 'completed' : 'absent') });
    return result.deleted ? result : { ...result, absent: true };
  } catch {
    const attempts = Number(document.metadata?.providerCleanup?.attempts ?? 0) + 1;
    await Document.updateOne({ _id: document.id }, { $set: cleanupState('pending', { attempts, reason: 'provider-unavailable' }) });
    return { deleted: false, pending: true };
  }
};

export const deleteDocumentAssetIfUnreferenced = async (document) => {
  const key = `${document.storage.provider}:${document.storage.publicId}`;
  const previous = cleanupLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  cleanupLocks.set(key, current);
  await previous;
  try { return await deleteUnlocked(document); }
  finally { release(); if (cleanupLocks.get(key) === current) cleanupLocks.delete(key); }
};

export const retryProviderCleanup = async (documentId) => {
  const document = await Document.findById(documentId);
  if (!document) return { deleted: false, absent: true };
  return deleteDocumentAssetIfUnreferenced(document);
};
