import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { z } from 'zod';

export const generateJobDescription = async (title, keyRequirements, context = {}) => {
  return await invokeAIGateway('generate_job_description', { title, keyRequirements }, context);
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
