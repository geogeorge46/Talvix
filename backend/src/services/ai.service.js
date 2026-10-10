import crypto from 'node:crypto';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { z } from 'zod';
import { structuredJobIntelligenceSchema } from '../validators/jobIntelligence.validator.js';
import { jobQualityAnalysisSchema } from '../validators/jobQuality.validator.js';
import { assessmentBlueprintDataSchema, blueprintSectionSchema } from '../validators/assessmentBlueprint.validator.js';
import { AppError } from '../shared/errors/AppError.js';

export const generateJobDescription = async (input, secondArg = {}, thirdArg = {}) => {
  let title = '';
  let keyRequirements = '';
  let department = '';
  let employmentType = '';
  let workMode = '';
  let skills = [];
  let requiredSkills = [];
  let preferredSkills = [];
  let responsibilities = [];
  let educationRequirements = [];
  let recruiterNotes = '';
  let minimumExperience;
  let maximumExperience;
  let location = '';
  let context = {};

  if (typeof input === 'string') {
    title = input;
    keyRequirements = typeof secondArg === 'string' ? secondArg : '';
    context = typeof secondArg === 'object' && secondArg !== null && !('title' in secondArg) ? secondArg : (thirdArg || {});
  } else if (input && typeof input === 'object') {
    title = input.title || '';
    keyRequirements = input.keyRequirements || '';
    department = input.department || '';
    employmentType = input.employmentType || '';
    workMode = input.workMode || '';
    skills = Array.isArray(input.skills) ? input.skills : [];
    requiredSkills = Array.isArray(input.requiredSkills) ? input.requiredSkills : (skills.length ? skills : []);
    preferredSkills = Array.isArray(input.preferredSkills) ? input.preferredSkills : [];
    responsibilities = Array.isArray(input.responsibilities) ? input.responsibilities : [];
    educationRequirements = Array.isArray(input.educationRequirements) ? input.educationRequirements : [];
    recruiterNotes = input.recruiterNotes || input.additionalInstructions || input.notes || '';
    minimumExperience = input.minimumExperience;
    maximumExperience = input.maximumExperience;
    location = input.location || '';
    context = secondArg || {};
  }

  const company = context.company || {};
  const companyName = company.name || 'Our Company';
  const companyIndustry = company.industry || 'Technology';
  const companyAbout = company.description || '';
  const companyBenefits = Array.isArray(company.benefits) && company.benefits.length > 0 ? company.benefits.join(', ') : '';
  const companyTechnologies = Array.isArray(company.technologies) && company.technologies.length > 0 ? company.technologies.join(', ') : '';
  const hq = company.headquarters;
  const companyLocation = location || (hq?.city ? [hq.city, hq.state, hq.country].filter(Boolean).join(', ') : '');

  const promptVariables = {
    title,
    keyRequirements,
    department,
    employmentType,
    workMode,
    skills: skills.join(', '),
    requiredSkills: requiredSkills.join(', '),
    preferredSkills: preferredSkills.join(', '),
    responsibilities: responsibilities.join('; '),
    educationRequirements: educationRequirements.join('; '),
    recruiterNotes,
    experience: minimumExperience !== undefined ? `${minimumExperience}${maximumExperience !== undefined ? `-${maximumExperience}` : '+'} years` : '',
    companyName,
    companyIndustry,
    companyAbout,
    companyBenefits,
    companyTechnologies,
    companyLocation
  };

  return await invokeAIGateway('generate_job_description', promptVariables, context);
};


export const suggestSkills = async (title, description, context = {}) => {
  const resultText = await invokeAIGateway('suggest_skills', { title, description }, context);
  return resultText.split(',').map(s => s.trim()).filter(Boolean);
};

export const performScamCheck = async (title, description, context = {}) => {
  const resultText = await invokeAIGateway('perform_scam_check', { title, description }, context);
  
  let data;
  try {
    data = parseJSON(resultText);
  } catch (err) {
    data = { isSafe: true, riskScore: 10, issues: [] };
  }

  // Unwrap nested structures
  if (data && typeof data === 'object' && !('isSafe' in data) && !('riskScore' in data)) {
    const keys = Object.keys(data);
    if (keys.length === 1 && data[keys[0]] && typeof data[keys[0]] === 'object') {
      data = data[keys[0]];
    }
  }

  const normalized = {
    isSafe: true,
    riskScore: 0,
    issues: []
  };

  if (data && typeof data === 'object') {
    // Normalize isSafe
    if ('isSafe' in data) {
      normalized.isSafe = Boolean(data.isSafe);
    } else if ('safe' in data) {
      normalized.isSafe = Boolean(data.safe);
    } else if ('is_safe' in data) {
      normalized.isSafe = Boolean(data.is_safe);
    }

    // Normalize riskScore
    if ('riskScore' in data) {
      normalized.riskScore = Number(data.riskScore);
    } else if ('risk' in data) {
      normalized.riskScore = Number(data.risk);
    } else if ('risk_score' in data) {
      normalized.riskScore = Number(data.risk_score);
    } else if ('score' in data) {
      normalized.riskScore = Number(data.score);
    }

    // Normalize issues
    if (Array.isArray(data.issues)) {
      normalized.issues = data.issues.map(String);
    } else if (Array.isArray(data.reasons)) {
      normalized.issues = data.reasons.map(String);
    } else if (Array.isArray(data.alerts)) {
      normalized.issues = data.alerts.map(String);
    } else if (data.issues && typeof data.issues === 'string') {
      normalized.issues = [data.issues];
    } else if (data.reason && typeof data.reason === 'string') {
      normalized.issues = [data.reason];
    }
  }

  const schema = z.object({
    isSafe: z.boolean(),
    riskScore: z.number().min(0).max(100),
    issues: z.array(z.string())
  });

  return schema.parse(normalized);
};

export const generateCandidateAnalysis = async (jobDetails, candidateDetails, context = {}) => {
  const resultText = await invokeAIGateway('generate_candidate_analysis', { jobDetails, candidateDetails }, context);
  const schema = z.object({
    matchScore: z.number().min(0).max(100),
    summary: z.string(),
    skillGap: z.array(z.string()),
    suggestedStage: z.string()
  });
  return parseJSON(resultText, schema);
};

export const analyzeOfferWithAI = async (jobDetails, candidateDetails, offerDetails, context = {}) => {
  const resultText = await invokeAIGateway('analyze_offer', { jobDetails, candidateDetails, offerDetails }, context);
  const schema = z.object({
    salaryBenchmarking: z.object({
      status: z.string(),
      percentile: z.number(),
      marketAverage: z.number()
    }),
    compensationRecommendations: z.array(z.string()),
    offerQualityAnalysis: z.object({
      score: z.number(),
      details: z.string()
    }),
    missingClauses: z.array(z.string()),
    complianceChecks: z.object({
      status: z.string(),
      issues: z.array(z.string())
    }),
    offerRiskAnalysis: z.object({
      riskLevel: z.string(),
      indicators: z.array(z.string())
    })
  });
  return parseJSON(resultText, schema);
};

export const evaluateAssessmentAttemptWithAI = async (attemptDetails, candidateDetails, questionsDetails, context = {}) => {
  const resultText = await invokeAIGateway('evaluate_assessment', { attemptDetails, candidateDetails, questionsDetails }, context);
  const schema = z.object({
    codeQualityAnalysis: z.object({
      score: z.number(),
      comments: z.string()
    }),
    complexityEstimation: z.object({
      timeComplexity: z.string(),
      spaceComplexity: z.string()
    }),
    styleAnalysis: z.object({
      comments: z.string()
    }),
    bugDetection: z.object({
      count: z.number(),
      issues: z.array(z.string())
    }),
    duplicateCodeDetection: z.object({
      hasDuplicates: z.boolean(),
      matches: z.array(z.string())
    }),
    skillInference: z.array(z.string()),
    candidateSummary: z.string()
  });
  return parseJSON(resultText, schema);
};

export const computeJobContentHash = (title, description, extra = '') => {
  const content = `${(title || '').trim().toLowerCase()}\n${(description || '').trim()}\n${extra}`;
  return crypto.createHash('sha256').update(content).digest('hex');
};

export const extractJobIntelligence = async (title, description, context = {}) => {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new AppError('Job title is required for AI intelligence extraction', 400);
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new AppError('Job description is required for AI intelligence extraction', 400);
  }

  const resultText = await invokeAIGateway('extract_job_intelligence', {
    title: title.trim(),
    description: description.trim()
  }, context);

  return parseJSON(resultText, structuredJobIntelligenceSchema);
};

export const analyzeJobQuality = async (title, description, context = {}) => {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new AppError('Job title is required for job quality analysis', 400);
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new AppError('Job description is required for job quality analysis', 400);
  }

  const resultText = await invokeAIGateway('analyze_job_quality', {
    title: title.trim(),
    description: description.trim()
  }, context);

  return parseJSON(resultText, jobQualityAnalysisSchema);
};

export const generateAssessmentBlueprint = async (title, description, intelligenceData = null, context = {}) => {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new AppError('Job title is required for assessment blueprint generation', 400);
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new AppError('Job description is required for assessment blueprint generation', 400);
  }

  const intelligenceContext = intelligenceData ? JSON.stringify(intelligenceData) : 'None';

  const resultText = await invokeAIGateway('generate_assessment_blueprint', {
    title: title.trim(),
    description: description.trim(),
    intelligenceContext
  }, context);

  return parseJSON(resultText, assessmentBlueprintDataSchema);
};

export const regenerateBlueprintSection = async (title, sectionTitle, skillsEvaluated = [], customInstructions = '', context = {}) => {
  const resultText = await invokeAIGateway('regenerate_blueprint_section', {
    title: title || 'Job Role',
    sectionTitle: sectionTitle || 'Assessment Section',
    skillsEvaluated: Array.isArray(skillsEvaluated) ? skillsEvaluated.join(', ') : String(skillsEvaluated),
    customInstructions: customInstructions || 'Focus on practical technical scenarios'
  }, context);

  return parseJSON(resultText, blueprintSectionSchema);
};



