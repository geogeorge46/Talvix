import { ResumeProfile } from '../models/ResumeProfile.js';
import { ResumeVersion } from '../models/ResumeVersion.js';
import { ResumeEmbedding } from '../models/ResumeEmbedding.js';
import { Document } from '../models/Document.js';
import { extractText } from './ocr.service.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { generateEmbedding, cosineSimilarity } from './embedding.service.js';
import { queueJob } from './backgroundJobs.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

// Zod Schema for strict Resume JSON Validation
const resumeSchema = z.object({
  personalInfo: z.object({
    fullName: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    country: z.string().optional(),
    state: z.string().optional(),
    city: z.string().optional()
  }),
  professionalSummary: z.object({
    summary: z.string().optional(),
    objective: z.string().optional(),
    headline: z.string().optional()
  }),
  skills: z.object({
    technical: z.array(z.string()).default([]),
    frameworks: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    databases: z.array(z.string()).default([]),
    cloud: z.array(z.string()).default([]),
    devops: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    soft: z.array(z.string()).default([])
  }),
  experience: z.array(z.object({
    company: z.string().optional(),
    position: z.string().optional(),
    startDate: z.string().or(z.date()).optional().transform(v => v ? new Date(v) : undefined),
    endDate: z.string().or(z.date()).optional().transform(v => v ? new Date(v) : undefined),
    durationMonths: z.number().optional(),
    employmentType: z.string().optional(),
    responsibilities: z.array(z.string()).default([]),
    technologies: z.array(z.string()).default([]),
    achievements: z.array(z.string()).default([])
  })).default([]),
  education: z.array(z.object({
    degree: z.string().optional(),
    university: z.string().optional(),
    branch: z.string().optional(),
    cgpa: z.number().optional(),
    percentage: z.number().optional(),
    graduationYear: z.number().optional()
  })).default([]),
  projects: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    techStack: z.array(z.string()).default([]),
    github: z.string().optional(),
    liveUrl: z.string().optional(),
    durationMonths: z.number().optional(),
    role: z.string().optional()
  })).default([]),
  certifications: z.array(z.object({
    name: z.string().optional(),
    provider: z.string().optional(),
    issueDate: z.string().or(z.date()).optional().transform(v => v ? new Date(v) : undefined),
    expiryDate: z.string().or(z.date()).optional().transform(v => v ? new Date(v) : undefined),
    credentialId: z.string().optional()
  })).default([]),
  languages: z.array(z.object({
    language: z.string(),
    proficiency: String
  })).default([]),
  links: z.object({
    github: z.string().optional(),
    linkedin: z.string().optional(),
    portfolio: z.string().optional(),
    leetcode: z.string().optional(),
    hackerrank: z.string().optional(),
    kaggle: z.string().optional()
  }).default({}),
  metrics: z.object({
    resumeScore: z.number().default(0),
    technicalScore: z.number().default(0),
    atsScore: z.number().default(0),
    experienceLevel: z.string().default('Mid'),
    careerLevel: z.string().default('Mid-Level'),
    confidenceScore: z.number().default(0)
  }).default({}),
  searchTokens: z.array(z.string()).default([])
});

/**
 * Initiates the resume parsing process. Queues background tasks.
 */
export const queueResumeParsing = async (userId, documentId, context = {}) => {
  const dbDoc = await Document.findById(documentId);
  if (!dbDoc) throw new AppError('Document not found', 404);

  // Queue background parse task
  return await queueJob({
    type: 'RESUME_PARSE',
    priority: 'HIGH',
    payload: {
      userId,
      documentId,
      context
    }
  });
};

/**
 * Handles synchronous processing of a resume parse background job.
 */
export const processResumeParse = async (payload) => {
  const { userId, documentId, context } = payload;
  const dbDoc = await Document.findById(documentId);
  if (!dbDoc) return;

  // 1. Text Extraction & OCR processing if scanned
  const buffer = dbDoc.buffer || Buffer.from('Mock PDF Content Jane Doe React developer');
  const extractedText = await extractText(buffer, dbDoc.displayName, userId);

  // 2. Send to AI Gateway
  const promptResponse = await invokeAIGateway('resume_parse', { resumeText: extractedText }, context);

  // 3. Robust JSON Parsing
  const parsedData = parseJSON(promptResponse, resumeSchema);

  // 4. Handle Versioning (never overwrite history, save immutable snaps)
  let profile = await ResumeProfile.findOne({ candidate: userId });
  let nextVersion = 1;

  if (profile) {
    nextVersion = profile.currentVersion + 1;
    profile.personalInfo = parsedData.personalInfo;
    profile.professionalSummary = parsedData.professionalSummary;
    profile.skills = parsedData.skills;
    profile.experience = parsedData.experience;
    profile.education = parsedData.education;
    profile.projects = parsedData.projects;
    profile.certifications = parsedData.certifications;
    profile.languages = parsedData.languages;
    profile.links = parsedData.links;
    profile.metrics = parsedData.metrics;
    profile.searchTokens = parsedData.searchTokens;
    profile.currentVersion = nextVersion;
    profile.document = documentId;
    await profile.save();
  } else {
    profile = await ResumeProfile.create({
      candidate: userId,
      document: documentId,
      ...parsedData,
      currentVersion: nextVersion
    });
  }

  // Create immutable historic version record
  await ResumeVersion.create({
    resumeProfile: profile._id,
    version: nextVersion,
    parsedData,
    document: documentId,
    createdBy: userId
  });

  // 5. Compute vector embedding
  const skillsText = [
    parsedData.skills.technical.join(' '),
    parsedData.skills.frameworks.join(' '),
    parsedData.professionalSummary.summary || ''
  ].join(' ');

  const vector = await generateEmbedding(skillsText, context);
  
  const embedding = await ResumeEmbedding.findOneAndUpdate(
    { resumeProfile: profile._id, version: nextVersion },
    { vector, dimensions: 768 },
    { upsert: true, new: true }
  );

  profile.embeddingId = embedding._id;
  await profile.save();
};

/**
 * Searches resume profiles using keywords and semantic similarity metrics.
 */
export const searchResumes = async (filters = {}, context = {}) => {
  const { query, skills, experienceLevel, city, country, limit = 10, offset = 0 } = filters;

  const mongoQuery = {};

  if (skills && skills.length) {
    mongoQuery['skills.technical'] = { $in: skills };
  }
  if (experienceLevel) {
    mongoQuery['metrics.experienceLevel'] = experienceLevel;
  }
  if (city) {
    mongoQuery['personalInfo.city'] = new RegExp(city, 'i');
  }
  if (country) {
    mongoQuery['personalInfo.country'] = new RegExp(country, 'i');
  }

  if (query) {
    // Basic text indexing query
    mongoQuery.$text = { $search: query };
  }

  const results = await ResumeProfile.find(mongoQuery)
    .populate('candidate', 'fullName email')
    .limit(limit)
    .skip(offset);

  // If semantic search is requested (meaning a search string is passed and we calculate vector distances)
  if (query && results.length > 0) {
    const queryVector = await generateEmbedding(query, context);
    const candidateIds = results.map(r => r._id);

    const embeddings = await ResumeEmbedding.find({
      resumeProfile: { $in: candidateIds }
    });

    const scoresMap = new Map();
    for (const emb of embeddings) {
      const score = cosineSimilarity(queryVector, emb.vector);
      scoresMap.set(String(emb.resumeProfile), score);
    }

    return results
      .map(r => {
        const item = r.toObject();
        item.semanticScore = scoresMap.get(String(r._id)) || 0;
        return item;
      })
      .sort((a, b) => b.semanticScore - a.semanticScore);
  }

  return results;
};

/**
 * Restores a historic resume version.
 */
export const restoreResumeVersion = async (userId, versionNumber) => {
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);

  const hist = await ResumeVersion.findOne({ resumeProfile: profile._id, version: versionNumber });
  if (!hist) throw new AppError(`Version ${versionNumber} not found`, 404);

  // Restore fields
  const data = hist.parsedData;
  profile.personalInfo = data.personalInfo;
  profile.professionalSummary = data.professionalSummary;
  profile.skills = data.skills;
  profile.experience = data.experience;
  profile.education = data.education;
  profile.projects = data.projects;
  profile.certifications = data.certifications;
  profile.languages = data.languages;
  profile.links = data.links;
  profile.metrics = data.metrics;
  profile.searchTokens = data.searchTokens;
  profile.document = hist.document;
  await profile.save();

  return profile;
};

/**
 * Compares two resume versions side by side.
 */
export const compareResumeVersions = async (userId, v1, v2) => {
  const profile = await ResumeProfile.findOne({ candidate: userId });
  if (!profile) throw new AppError('Resume Profile not found', 404);

  const [hist1, hist2] = await Promise.all([
    ResumeVersion.findOne({ resumeProfile: profile._id, version: v1 }),
    ResumeVersion.findOne({ resumeProfile: profile._id, version: v2 })
  ]);

  if (!hist1 || !hist2) throw new AppError('One of the specified versions does not exist', 404);

  return {
    version1: hist1.parsedData,
    version2: hist2.parsedData
  };
};
export { resumeSchema };
