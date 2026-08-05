import * as service from '../services/resumeIntelligence.service.js';
import { Document } from '../models/Document.js';
import { ResumeProfile } from '../models/ResumeProfile.js';
import { createSignedDownloadUrl } from '../services/fileStorageProvider.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { env } from '../config/env.js';
import crypto from 'crypto';
import mongoose from 'mongoose';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });

export const uploadAndParse = handle(async (request, response) => {
  // Extract user context
  const userId = request.user.id;
  const file = request.file;

  if (!file) throw new AppError('File is required', 400);

  const checksum = crypto.createHash('sha256').update(file.buffer || Buffer.from('Mock')).digest('hex');

  // Store in Document Model (Mongoose transactional storage reservation)
  const doc = await Document.create({
    owner: userId,
    ownerRole: 'candidate',
    uploadedBy: userId,
    category: 'resume',
    purpose: 'Resume Upload',
    entityType: 'candidate-profile',
    entityId: new mongoose.Types.ObjectId(),
    originalFileName: file.originalname,
    displayName: file.originalname,
    mimeType: file.mimeType || 'application/pdf',
    mediaType: 'document',
    sizeBytes: file.size || 100,
    checksum,
    storage: {
      provider: 'memory',
      publicId: `resume_${userId}_${Date.now()}`,
      resourceType: 'raw'
    },
    buffer: file.buffer,
    access: 'private',
    status: 'active',
    isCurrent: true
  });

  // Queue background parse task
  const job = await service.queueResumeParsing(userId, doc._id, {
    userId,
    companyId: request.company?.id || null,
    ipAddress: request.ip || 'Unknown',
    userAgent: request.headers['user-agent'] || 'Unknown'
  });

  return ok(response, 'Resume uploaded and parsing queued', { documentId: doc._id, jobId: job._id }, 201);
});

export const getResumeProfile = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId }).populate('document');
  if (!profile) throw new AppError('Resume Profile not found', 404);
  return ok(response, 'Resume Profile retrieved successfully', { profile });
});

export const reparseResume = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('No parsed resume found to reparse', 404);

  const job = await service.queueResumeParsing(userId, profile.document, {
    userId,
    companyId: request.company?.id || null,
    ipAddress: request.ip || 'Unknown',
    userAgent: request.headers['user-agent'] || 'Unknown'
  });

  return ok(response, 'Reparse queued successfully', { jobId: job._id });
});

export const listVersions = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);

  const versions = await ResumeProfile.db.model('ResumeVersion')
    .find({ resumeProfile: profile._id })
    .select('version createdAt document')
    .sort({ version: -1 });

  return ok(response, 'Resume versions listed successfully', { versions });
});

export const restoreVersion = handle(async (request, response) => {
  const userId = request.user.id;
  const { version } = request.params;

  const profile = await service.restoreResumeVersion(userId, Number(version));
  return ok(response, `Resume restored to version ${version}`, { profile });
});

export const downloadOriginal = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);

  const doc = await Document.findById(profile.document);
  if (!doc) throw new AppError('Document asset not found', 404);

  const downloadUrl = await createSignedDownloadUrl({
    publicId: doc.storage.publicId,
    resourceType: doc.storage.resourceType,
    expiresAt: new Date(Date.now() + env.FILE_SIGNED_URL_TTL_SECONDS * 1000),
    attachment: true
  });

  return ok(response, 'Download URL generated successfully', { downloadUrl });
});

export const downloadParsedJson = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);
  return response.json(profile);
});

export const search = handle(async (request, response) => {
  const filters = request.query;
  const results = await service.searchResumes(filters, {
    userId: request.user.id,
    companyId: request.company?.id || null,
    ipAddress: request.ip || 'Unknown',
    userAgent: request.headers['user-agent'] || 'Unknown'
  });
  return ok(response, 'Search completed successfully', { results });
});

export const deleteResume = handle(async (request, response) => {
  const userId = request.user.id;
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);

  await Promise.all([
    ResumeProfile.deleteOne({ _id: profile._id }),
    ResumeProfile.db.model('ResumeVersion').deleteMany({ resumeProfile: profile._id }),
    ResumeProfile.db.model('ResumeEmbedding').deleteMany({ resumeProfile: profile._id })
  ]);

  return ok(response, 'Resume profile and history deleted successfully');
});

export const compareVersions = handle(async (request, response) => {
  const userId = request.user.id;
  const { v1, v2 } = request.query;

  if (!v1 || !v2) throw new AppError('v1 and v2 query parameters are required', 400);

  const comparison = await service.compareResumeVersions(userId, Number(v1), Number(v2));
  return ok(response, 'Resume comparison generated', comparison);
});
