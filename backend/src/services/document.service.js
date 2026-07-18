import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { DOCUMENT_MIMES, IMAGE_MIMES } from '../constants/document.js';
import { Document } from '../models/Document.js';
import { FileUploadSession } from '../models/FileUploadSession.js';
import { AppError } from '../shared/errors/AppError.js';
import { calculateFileChecksum } from '../utils/fileChecksum.js';
import { validateFile } from '../utils/fileValidation.js';
import { buildPagination } from '../utils/pagination.js';
import { serializeDocument } from '../utils/documentSerializer.js';
import { createSignedDownloadUrl, deleteFile, uploadFile } from './fileStorageProvider.service.js';
import { commitStorageReservation, releaseStorageReservation, reserveStorage } from './storageReservation.service.js';
import { deleteDocumentAssetIfUnreferenced } from './documentRetention.service.js';

const maximum = (category) => (category === 'assessment-attachment'
  ? env.FILE_MAX_ASSESSMENT_ATTACHMENT_MB
  : ['profile-photo', 'company-logo'].includes(category) ? env.FILE_MAX_IMAGE_MB : env.FILE_MAX_DOCUMENT_MB) * 1024 * 1024;
const mimes = (category) => ['profile-photo', 'company-logo'].includes(category) ? IMAGE_MIMES : DOCUMENT_MIMES;

export const createUploadSession = async (user, input) => {
  const entityId = input.entityId ?? user.id;
  const key = input.idempotencyKey ?? `upload:${user.id}:${randomUUID()}`;
  try {
    return await FileUploadSession.create({ createdBy: user.id, owner: user.id, category: input.category, entityType: input.entityType, entityId, purpose: input.purpose, expectedMimeTypes: mimes(input.category), maximumBytes: maximum(input.category), idempotencyKey: key, expiresAt: new Date(Date.now() + 15 * 60000) });
  } catch (error) {
    if (error.code === 11000) return FileUploadSession.findOne({ idempotencyKey: key, createdBy: user.id });
    throw error;
  }
};

export const getActiveUploadSession = async (user, id) => {
  const uploadSession = await FileUploadSession.findOne({ _id: id, createdBy: user.id });
  if (!uploadSession) throw new AppError('Upload session not found', 404);
  if (uploadSession.status === 'completed') return uploadSession;
  if (uploadSession.status !== 'created' || uploadSession.expiresAt <= new Date()) throw new AppError('Upload session is no longer active', 409);
  return uploadSession;
};

const uploadDocumentUnlocked = async (user, fields, file, replaced, overrides = {}) => {
  const uploadSession = await getActiveUploadSession(user, fields.uploadSessionId);
  if (uploadSession.status === 'completed') return Document.findById(uploadSession.completedDocument);
  if (uploadSession.category !== fields.category) throw new AppError('Upload category does not match the session', 400);
  const info = validateFile(file, uploadSession.category, uploadSession.maximumBytes);
  const checksum = calculateFileChecksum(file.buffer);
  if (await Document.exists({ owner: user.id, checksum, category: uploadSession.category, entityType: uploadSession.entityType, entityId: uploadSession.entityId, status: 'active', ...(replaced && { _id: { $ne: replaced.id } }) })) throw new AppError('This file has already been uploaded', 409);
  const reservation = await reserveStorage({ user: user.id, uploadSession: uploadSession.id, bytes: file.size, expiresAt: uploadSession.expiresAt });
  uploadSession.status = 'uploading'; await uploadSession.save();
  let stored; let document; let databaseCommitted = false;
  try {
    stored = await uploadFile({ buffer: file.buffer, fileName: info.name, mimeType: file.mimetype, folder: `talvix/${user.role}/${user.id}`, resourceType: info.mediaType === 'image' ? 'image' : 'raw', accessMode: overrides.access ?? fields.access ?? 'private', metadata: { category: uploadSession.category } });
    const databaseSession = await mongoose.startSession();
    try {
      await databaseSession.withTransaction(async () => {
        if (replaced) {
          const result = await Document.updateOne({ _id: replaced.id, status: 'active', isCurrent: true }, { $set: { status: 'replaced', isCurrent: false }, $push: { statusHistory: { from: 'active', to: 'replaced', changedBy: user.id, reason: 'Document replaced' } } }, { session: databaseSession });
          if (!result.modifiedCount) throw new AppError('Document was replaced by another request', 409, 'DOCUMENT_CONFLICT');
        }
        [document] = await Document.create([{ owner: user.id, ownerRole: user.role, uploadedBy: user.id, company: overrides.company, category: uploadSession.category, purpose: fields.purpose, entityType: overrides.entityType ?? uploadSession.entityType, entityId: overrides.entityId ?? uploadSession.entityId, originalFileName: info.name, displayName: fields.displayName ?? fields.purpose, extension: info.extension, mimeType: file.mimetype, mediaType: info.mediaType, sizeBytes: file.size, checksum, storage: stored, access: overrides.access ?? fields.access ?? 'private', verification: overrides.verification, version: replaced ? replaced.version + 1 : 1, parentDocument: replaced?.id }], { session: databaseSession });
        if (replaced) await Document.updateOne({ _id: replaced.id }, { $set: { replacedBy: document.id } }, { session: databaseSession });
        if (overrides.reference) {
          const referenceFilter = { _id: overrides.reference.id, ...(replaced ? { [overrides.reference.field]: replaced.id } : { [overrides.reference.field]: null }) };
          const result = await overrides.reference.model.updateOne(referenceFilter, { $set: { [overrides.reference.field]: document.id } }, { session: databaseSession });
          if (!result.modifiedCount) throw new AppError('Document reference changed during upload', 409, 'DOCUMENT_REFERENCE_CONFLICT');
        }
        uploadSession.status = 'completed'; uploadSession.completedDocument = document.id; await uploadSession.save({ session: databaseSession });
        await commitStorageReservation(reservation.id, databaseSession);
      });
      databaseCommitted = true;
    } finally { await databaseSession.endSession(); }
    return document;
  } catch (error) {
    if (databaseCommitted && document) await Document.deleteOne({ _id: document.id }).catch(() => {});
    uploadSession.status = 'failed'; uploadSession.failureCode = 'UPLOAD_FAILED'; uploadSession.failureMessage = 'Document upload failed'; await uploadSession.save().catch(() => {});
    if (stored) await deleteFile({ publicId: stored.publicId, resourceType: stored.resourceType }).catch(() => {});
    await releaseStorageReservation(reservation.id, 'released', 'UPLOAD_FAILED').catch(() => {});
    throw error;
  }
};

const uploadLocks = new Map();
export const uploadDocument = async (...args) => {
  const key = String(args[0].id);
  const previous = uploadLocks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise((resolve) => { release = resolve; });
  uploadLocks.set(key, current);
  await previous;
  try { return await uploadDocumentUnlocked(...args); }
  finally { release(); if (uploadLocks.get(key) === current) uploadLocks.delete(key); }
};

const own = async (user, id) => { const document = await Document.findOne({ _id: id, owner: user.id, status: { $ne: 'deleted' } }); if (!document) throw new AppError('Document not found', 404); return document; };
export const listDocuments = async (user, query) => { const filter = { owner: user.id, status: query.status ?? 'active' }; if (query.category) filter.category = query.category; const [rows, total] = await Promise.all([Document.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), Document.countDocuments(filter)]); return { documents: rows.map(serializeDocument), pagination: buildPagination(query.page, query.limit, total) }; };
export const getDocument = async (user, id) => serializeDocument(await own(user, id));
export const downloadDocument = async (user, id) => { const document = await own(user, id); if (!['active', 'archived'].includes(document.status) || ['suspicious', 'infected'].includes(document.malwareScan.status)) throw new AppError('Document is unavailable for download', 409); return createSignedDownloadUrl({ publicId: document.storage.publicId, resourceType: document.storage.resourceType, expiresAt: new Date(Date.now() + env.FILE_SIGNED_URL_TTL_SECONDS * 1000), attachment: true }); };
export const updateDocument = async (user, id, input) => { const document = await own(user, id); document.set(input); await document.save(); return serializeDocument(document); };
export const replaceDocument = async (user, id, fields, file, overrides) => uploadDocument(user, fields, file, await own(user, id), overrides);
export const setState = async (user, id, state, reason) => { const document = await own(user, id); const allowed = { active: ['archived', 'deleted'], archived: ['active', 'deleted'] }; if (!allowed[document.status]?.includes(state)) throw new AppError('Invalid document status transition', 409); if (state === 'deleted' && !['user', 'candidate-profile', 'recruiter-profile'].includes(document.entityType)) throw new AppError('Workflow documents follow their entity retention policy', 409, 'DOCUMENT_REFERENCE_CONFLICT'); const from = document.status; document.status = state; document.isCurrent = state === 'active'; if (state === 'archived') document.archivedAt = new Date(); if (state === 'deleted') document.deletedAt = new Date(); document.statusHistory.push({ from, to: state, changedBy: user.id, reason }); await document.save(); if (state === 'deleted') await deleteDocumentAssetIfUnreferenced(document); return serializeDocument(document); };
