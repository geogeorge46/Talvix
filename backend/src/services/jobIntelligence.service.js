import { JobIntelligence } from '../models/JobIntelligence.js';
import { JobVersion } from '../models/JobVersion.js';
import { JobEmbedding } from '../models/JobEmbedding.js';
import { Job } from '../models/Job.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { generateEmbedding } from './embedding.service.js';
import { queueJob } from './backgroundJobs.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

// Zod Schema for Job Intelligence Validation
const jobIntelligenceSchema = z.object({
  skills: z.object({
    required: z.array(z.string()).default([]),
    preferred: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([])
  }),
  responsibilities: z.array(z.string()).default([]),
  experience: z.object({
    minYears: z.number().default(0),
    maxYears: z.number().optional(),
    preferredDescription: z.string().optional()
  }).default({}),
  education: z.object({
    degrees: z.array(z.string()).default([]),
    branches: z.array(z.string()).default([]),
    preferredDescription: z.string().optional()
  }).default({}),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.object({
    language: z.string(),
    proficiency: z.string()
  })).default([]),
  industry: z.string().optional(),
  employmentType: z.string().optional(),
  location: z.object({
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional(),
    type: z.enum(['onsite', 'remote', 'hybrid']).default('onsite')
  }).default({}),
  salaryRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    currency: z.string().default('USD')
  }).default({}),
  benefits: z.array(z.string()).default([]),
  hiringSummary: z.string().optional(),
  riskFlags: z.array(z.object({
    category: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high']).default('low')
  })).default([]),
  searchTokens: z.array(z.string()).default([])
});

/**
 * Queues a job parsing background task.
 */
export const queueJobParsing = async (jobId, companyId, userId, context = {}) => {
  const job = await Job.findById(jobId);
  if (!job) throw new AppError('Job not found', 404);

  return await queueJob({
    type: 'JOB_PARSE',
    priority: 'HIGH',
    payload: {
      jobId,
      companyId,
      userId,
      context
    }
  });
};

/**
 * Handles the actual background execution of the job parsing pipeline.
 */
export const processJobParse = async (payload) => {
  const { jobId, companyId, userId, context } = payload;
  const job = await Job.findById(jobId);
  if (!job) return;

  const jobText = `Title: ${job.title}\nDescription: ${job.description || ''}\nRequirements: ${job.keyRequirements || ''}`;

  // 1. Invoke gateway
  const promptResponse = await invokeAIGateway('job_parse', { jobText }, context);

  // 2. Parse and Validate output
  const parsedData = parseJSON(promptResponse, jobIntelligenceSchema);

  // 3. Save / Update Intelligence & versions
  let intel = await JobIntelligence.findOne({ job: jobId });
  let nextVersion = 1;

  if (intel) {
    nextVersion = intel.currentVersion + 1;
    intel.skills = parsedData.skills;
    intel.responsibilities = parsedData.responsibilities;
    intel.experience = parsedData.experience;
    intel.education = parsedData.education;
    intel.certifications = parsedData.certifications;
    intel.languages = parsedData.languages;
    intel.industry = parsedData.industry;
    intel.employmentType = parsedData.employmentType;
    intel.location = parsedData.location;
    intel.salaryRange = parsedData.salaryRange;
    intel.benefits = parsedData.benefits;
    intel.hiringSummary = parsedData.hiringSummary;
    intel.riskFlags = parsedData.riskFlags;
    intel.searchTokens = parsedData.searchTokens;
    intel.currentVersion = nextVersion;
    await intel.save();
  } else {
    await JobIntelligence.create({
      job: jobId,
      company: companyId,
      ...parsedData,
      currentVersion: nextVersion
    });
  }

  // Save historical snapshot
  await JobVersion.create({
    job: jobId,
    version: nextVersion,
    parsedData,
    createdBy: userId
  });

  // 4. Generate Embeddings for semantic job queries
  const vectorText = [
    job.title,
    parsedData.skills.required.join(' '),
    parsedData.hiringSummary || ''
  ].join(' ');

  const vector = await generateEmbedding(vectorText, context);

  await JobEmbedding.findOneAndUpdate(
    { job: jobId, version: nextVersion },
    { vector, dimensions: 768 },
    { upsert: true, new: true }
  );
};

/**
 * Restores a historical job version.
 */
export const restoreJobVersion = async (jobId, companyId, versionNumber) => {
  const intel = await JobIntelligence.findOne({ job: jobId, company: companyId });
  if (!intel) throw new AppError('Job intelligence not found', 404);

  const hist = await JobVersion.findOne({ job: jobId, version: versionNumber });
  if (!hist) throw new AppError(`Version ${versionNumber} not found`, 404);

  const data = hist.parsedData;
  intel.skills = data.skills;
  intel.responsibilities = data.responsibilities;
  intel.experience = data.experience;
  intel.education = data.education;
  intel.certifications = data.certifications;
  intel.languages = data.languages;
  intel.industry = data.industry;
  intel.employmentType = data.employmentType;
  intel.location = data.location;
  intel.salaryRange = data.salaryRange;
  intel.benefits = data.benefits;
  intel.hiringSummary = data.hiringSummary;
  intel.riskFlags = data.riskFlags;
  intel.searchTokens = data.searchTokens;
  await intel.save();

  return intel;
};

/**
 * Compares two job intelligence versions side by side.
 */
export const compareJobVersions = async (jobId, companyId, v1, v2) => {
  const intel = await JobIntelligence.findOne({ job: jobId, company: companyId });
  if (!intel) throw new AppError('Job intelligence not found', 404);

  const [hist1, hist2] = await Promise.all([
    JobVersion.findOne({ job: jobId, version: v1 }),
    JobVersion.findOne({ job: jobId, version: v2 })
  ]);

  if (!hist1 || !hist2) throw new AppError('One of the specified versions does not exist', 404);

  return {
    version1: hist1.parsedData,
    version2: hist2.parsedData
  };
};
export { jobIntelligenceSchema };
