import { ResumeProfile } from '../models/ResumeProfile.js';
import { ResumeEmbedding } from '../models/ResumeEmbedding.js';
import { JobIntelligence } from '../models/JobIntelligence.js';
import { JobEmbedding } from '../models/JobEmbedding.js';
import { Application } from '../models/Application.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { generateEmbedding, cosineSimilarity } from './embedding.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

// Zod schema for Candidate Matching score details
const matchingScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillsScore: z.number().min(0).max(100),
  experienceScore: z.number().min(0).max(100),
  educationScore: z.number().min(0).max(100),
  projectScore: z.number().min(0).max(100),
  certificationScore: z.number().min(0).max(100),
  softSkillScore: z.number().min(0).max(100),
  languageScore: z.number().min(0).max(100),
  locationScore: z.number().min(0).max(100),
  salaryScore: z.number().min(0).max(100),
  availabilityScore: z.number().min(0).max(100),
  reasoning: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  hiringRecommendation: z.string().default('Interview'),
  interviewReadiness: z.string().default('Medium'),
  offerReadiness: z.string().default('Low'),
  riskFactors: z.array(z.string()).default([])
});

// Zod schema for Skill Gap report
const skillGapSchema = z.object({
  matchedSkills: z.array(z.string()).default([]),
  missingSkills: z.array(z.string()).default([]),
  criticalMissingSkills: z.array(z.string()).default([]),
  recommendedSkills: z.array(z.string()).default([]),
  learningRoadmap: z.array(z.string()).default([]),
  certificationRecommendations: z.array(z.string()).default([]),
  estimatedLearningTime: z.string().default('N/A'),
  priorityRanking: z.array(z.string()).default([])
});

// Zod schema for Search Query translation
const searchQuerySchema = z.object({
  query: z.string(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().default(0),
  location: z.string().default('')
});

/**
 * Executes semantic matching between a candidate resume profile and job intelligence constraints.
 */
export const matchCandidate = async (resumeProfileId, jobIntelligenceId, context = {}) => {
  const [resume, jobIntel] = await Promise.all([
    ResumeProfile.findById(resumeProfileId),
    JobIntelligence.findById(jobIntelligenceId)
  ]);

  if (!resume || !jobIntel) throw new AppError('Resume Profile or Job Intelligence not found', 404);

  // 1. Invoke Gateway to compute semantic match parameters
  const resumeDetails = JSON.stringify({
    fullName: resume.personalInfo.fullName,
    headline: resume.professionalSummary.headline,
    skills: resume.skills,
    experience: resume.experience.map(e => ({ position: e.position, duration: e.durationMonths })),
    education: resume.education,
    projects: resume.projects,
    certifications: resume.certifications
  });

  const jobDetails = JSON.stringify({
    title: jobIntel.hiringSummary,
    skills: jobIntel.skills,
    experience: jobIntel.experience,
    education: jobIntel.education,
    certifications: jobIntel.certifications
  });

  const matchRes = await invokeAIGateway('candidate_matching', { resumeDetails, jobDetails }, context);
  const matchResult = parseJSON(matchRes, matchingScoreSchema);

  // 2. Fetch embeddings and compute cosine similarity vector distances
  let semanticDistance = 0.5; // default fallback
  const [resumeEmb, jobEmb] = await Promise.all([
    ResumeEmbedding.findOne({ resumeProfile: resume._id, version: resume.currentVersion }),
    JobEmbedding.findOne({ job: jobIntel.job, version: jobIntel.currentVersion })
  ]);

  if (resumeEmb && jobEmb) {
    semanticDistance = cosineSimilarity(resumeEmb.vector, jobEmb.vector);
  }

  // Multiply overallScore with vector cosine distance to align AI reasoning with geometric vector match
  matchResult.overallScore = Math.round((matchResult.overallScore + (semanticDistance * 100)) / 2);

  // 3. Compute Skill Gap details
  const resumeSkills = resume.skills.technical.join(', ');
  const jobSkills = jobIntel.skills.required.join(', ');
  const gapRes = await invokeAIGateway('skill_gap_analysis', { resumeSkills, jobSkills }, context);
  const gapResult = parseJSON(gapRes, skillGapSchema);

  return {
    resumeProfile: resume._id,
    jobIntelligence: jobIntel._id,
    semanticSimilarity: semanticDistance,
    scores: matchResult,
    skillGap: gapResult
  };
};

/**
 * Compiles a ranked list of all applicants for a specified job.
 */
export const rankJobApplicants = async (jobId, companyId, context = {}) => {
  const applications = await Application.find({ job: jobId, isArchived: false });
  if (!applications.length) return [];

  const jobIntel = await JobIntelligence.findOne({ job: jobId, company: companyId });
  if (!jobIntel) throw new AppError('Job Intelligence details not found', 404);

  const list = [];
  for (const app of applications) {
    const resume = await ResumeProfile.findOne({ candidate: app.candidate });
    if (!resume) continue;

    const match = await matchCandidate(resume._id, jobIntel._id, context);
    list.push({
      applicationId: app._id,
      candidateId: app.candidate,
      fullName: resume.personalInfo.fullName,
      email: resume.personalInfo.email,
      match
    });
  }

  // Sort descending by overallScore
  list.sort((a, b) => b.match.scores.overallScore - a.match.scores.overallScore);

  // Calculate percentiles
  const total = list.length;
  return list.map((item, idx) => {
    item.rank = idx + 1;
    item.percentile = Math.round(((total - idx) / total) * 100);
    return item;
  });
};

/**
 * Performs natural language semantic and hybrid query search over resume profiles.
 */
export const recruiterSearchAI = async (queryText, companyId, context = {}) => {
  // 1. Translate query text into search parameters using AI Gateway
  const res = await invokeAIGateway('parse_search_query', { query: queryText }, context);
  const searchParams = parseJSON(res, searchQuerySchema);

  const mongoQuery = {};

  if (searchParams.skills.length) {
    mongoQuery['skills.technical'] = { $in: searchParams.skills };
  }
  if (searchParams.location) {
    mongoQuery['personalInfo.city'] = new RegExp(searchParams.location, 'i');
  }

  const matches = await ResumeProfile.find(mongoQuery)
    .populate('candidate', 'fullName email')
    .limit(20);

  // Apply vector similarity weighting
  if (matches.length > 0) {
    const queryVector = await generateEmbedding(queryText, context);
    const candidateIds = matches.map(m => m._id);

    const embeddings = await ResumeEmbedding.find({
      resumeProfile: { $in: candidateIds }
    });

    const scoreMap = new Map();
    for (const emb of embeddings) {
      const score = cosineSimilarity(queryVector, emb.vector);
      scoreMap.set(String(emb.resumeProfile), score);
    }

    return matches
      .map(m => {
        const item = m.toObject();
        item.semanticScore = scoreMap.get(String(m._id)) || 0.5;
        return item;
      })
      .sort((a, b) => b.semanticScore - a.semanticScore);
  }

  return matches;
};

/**
 * Recommends candidates similar to a target candidate profile.
 */
export const findSimilarCandidates = async (targetResumeId, companyId, limit = 5, _context = {}) => {
  const targetProfile = await ResumeProfile.findById(targetResumeId);
  if (!targetProfile) throw new AppError('Target candidate resume profile not found', 404);

  const targetEmbedding = await ResumeEmbedding.findOne({
    resumeProfile: targetResumeId,
    version: targetProfile.currentVersion
  });

  if (!targetEmbedding) throw new AppError('Vector representations not generated for this profile', 400);

  // Fetch candidate profiles
  const allProfiles = await ResumeProfile.find({ _id: { $ne: targetResumeId } });
  if (!allProfiles.length) return [];

  const candidateIds = allProfiles.map(p => p._id);
  const embeddings = await ResumeEmbedding.find({
    resumeProfile: { $in: candidateIds }
  });

  const rankedList = [];
  for (const emb of embeddings) {
    const score = cosineSimilarity(targetEmbedding.vector, emb.vector);
    const p = allProfiles.find(profile => profile._id.equals(emb.resumeProfile));
    if (p) {
      rankedList.push({
        resumeProfileId: p._id,
        fullName: p.personalInfo.fullName,
        similarityScore: score,
        explanation: `Candidate matches ${Math.round(score * 100)}% of target candidate's technical skills profile.`
      });
    }
  }

  return rankedList
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
};

/**
 * Background Task execution for Embeddings generation.
 */
export const executeEmbeddingJob = async (jobPayload) => {
  const { resumeProfileId, jobId, context } = jobPayload;
  
  if (resumeProfileId) {
    const resume = await ResumeProfile.findById(resumeProfileId);
    if (!resume) return;

    const skillsText = resume.skills.technical.join(' ');
    const vector = await generateEmbedding(skillsText, context);

    await ResumeEmbedding.findOneAndUpdate(
      { resumeProfile: resume._id, version: resume.currentVersion },
      { vector, dimensions: 768 },
      { upsert: true }
    );
  } else if (jobId) {
    const job = await JobIntelligence.findOne({ job: jobId });
    if (!job) return;

    const reqText = job.skills.required.join(' ');
    const vector = await generateEmbedding(reqText, context);

    await JobEmbedding.findOneAndUpdate(
      { job: jobId, version: job.currentVersion },
      { vector, dimensions: 768 },
      { upsert: true }
    );
  }
};
