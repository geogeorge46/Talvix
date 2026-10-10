import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { analyzeJobQuality, computeJobContentHash } from './ai.service.js';

/**
 * Get stored job quality analysis for a managed job.
 */
export const getJobQualityService = async (companyId, jobId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId }).select('title description quality status');
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const currentHash = computeJobContentHash(job.title, job.description);
  let quality = job.quality?.toObject ? job.quality.toObject() : (job.quality || { status: 'none' });

  if (quality.status === 'completed' && quality.contentHash && quality.contentHash !== currentHash) {
    quality.status = 'stale';
  }

  return {
    jobId: job._id,
    jobTitle: job.title,
    jobStatus: job.status,
    quality
  };
};

/**
 * Analyze or refresh job quality analysis for an existing job.
 */
export const analyzeAndPersistJobQuality = async (companyId, jobId, options = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const currentHash = computeJobContentHash(job.title, job.description);

  // Return cached result if fresh and not forced
  if (
    !options.forceRefresh &&
    job.quality &&
    job.quality.status === 'completed' &&
    job.quality.contentHash === currentHash
  ) {
    return {
      jobId: job._id,
      cached: true,
      quality: job.quality
    };
  }

  // Prevent duplicate concurrent analysis calls
  if (job.quality?.status === 'pending' && !options.forceRefresh) {
    const elapsedMs = Date.now() - (job.quality.analyzedAt ? new Date(job.quality.analyzedAt).getTime() : 0);
    if (elapsedMs < 30000) {
      throw new AppError('Job quality analysis is already in progress for this job', 409);
    }
  }

  job.quality = {
    schemaVersion: 1,
    promptVersion: 1,
    status: 'pending',
    analyzedAt: new Date(),
    contentHash: currentHash,
    overallScore: job.quality?.overallScore || 0,
    categoryScores: job.quality?.categoryScores || {},
    findings: job.quality?.findings || [],
    summary: job.quality?.summary || '',
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

    const analysisResult = await analyzeJobQuality(job.title, job.description, context);

    job.quality = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'completed',
      analyzedAt: new Date(),
      contentHash: currentHash,
      overallScore: analysisResult.overallScore,
      categoryScores: analysisResult.categoryScores,
      findings: analysisResult.findings,
      summary: analysisResult.summary,
      error: ''
    };
    await job.save();

    return {
      jobId: job._id,
      cached: false,
      quality: job.quality
    };
  } catch (error) {
    job.quality = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'failed',
      analyzedAt: new Date(),
      contentHash: currentHash,
      overallScore: job.quality?.overallScore || 0,
      categoryScores: job.quality?.categoryScores || {},
      findings: job.quality?.findings || [],
      summary: job.quality?.summary || '',
      error: error.message || 'Job quality analysis failed'
    };
    await job.save();

    throw error;
  }
};

/**
 * Ad-hoc preview quality analysis for unpersisted job drafts.
 */
export const previewJobQuality = async (title, description, context = {}) => {
  return await analyzeJobQuality(title, description, context);
};
