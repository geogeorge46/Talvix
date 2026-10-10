import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { extractJobIntelligence, computeJobContentHash } from './ai.service.js';

/**
 * Process job parse background job payload.
 */
export const processJobParse = async (payload = {}) => {
  if (payload.companyId && payload.jobId) {
    return extractAndPersistJobIntelligence(payload.companyId, payload.jobId, payload.options);
  }
  return { success: true, payload };
};

/**
 * Get stored job intelligence for a managed job.
 */
export const getJobIntelligenceService = async (companyId, jobId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId }).select('title description intelligence status');
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  // Check if content hash matches current job title & description
  const currentHash = computeJobContentHash(job.title, job.description);
  let intelligence = job.intelligence?.toObject ? job.intelligence.toObject() : (job.intelligence || { status: 'none' });

  if (intelligence.status === 'completed' && intelligence.contentHash && intelligence.contentHash !== currentHash) {
    intelligence.status = 'stale';
  }

  return {
    jobId: job._id,
    jobTitle: job.title,
    jobStatus: job.status,
    intelligence
  };
};

/**
 * Extract or refresh structured job intelligence for an existing job.
 */
export const extractAndPersistJobIntelligence = async (companyId, jobId, options = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const currentHash = computeJobContentHash(job.title, job.description);

  // Return cached result if fresh and not forced
  if (
    !options.forceRefresh &&
    job.intelligence &&
    job.intelligence.status === 'completed' &&
    job.intelligence.contentHash === currentHash &&
    job.intelligence.data
  ) {
    return {
      jobId: job._id,
      cached: true,
      intelligence: job.intelligence
    };
  }

  // Prevent duplicate concurrent extraction requests if status is pending
  if (job.intelligence?.status === 'pending' && !options.forceRefresh) {
    const elapsedMs = Date.now() - (job.intelligence.extractedAt ? new Date(job.intelligence.extractedAt).getTime() : 0);
    // If pending for less than 30 seconds, reject duplicate call
    if (elapsedMs < 30000) {
      throw new AppError('AI intelligence extraction is already in progress for this job', 409);
    }
  }

  // Mark as pending
  job.intelligence = {
    schemaVersion: 1,
    promptVersion: 1,
    status: 'pending',
    extractedAt: new Date(),
    contentHash: currentHash,
    data: job.intelligence?.data || null,
    error: ''
  };
  await job.save();

  try {
    const context = {
      companyId,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    };

    const extractedData = await extractJobIntelligence(job.title, job.description, context);

    job.intelligence = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'completed',
      extractedAt: new Date(),
      contentHash: currentHash,
      data: extractedData,
      error: ''
    };
    await job.save();

    return {
      jobId: job._id,
      cached: false,
      intelligence: job.intelligence
    };
  } catch (error) {
    // Save failure state without breaking job document or altering authoritative fields
    job.intelligence = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'failed',
      extractedAt: new Date(),
      contentHash: currentHash,
      data: job.intelligence?.data || null,
      error: error.message || 'AI extraction failed'
    };
    await job.save();

    throw error;
  }
};

/**
 * Ad-hoc preview extraction for unpersisted job drafts.
 */
export const previewJobIntelligence = async (title, description, context = {}) => {
  return await extractJobIntelligence(title, description, context);
};
