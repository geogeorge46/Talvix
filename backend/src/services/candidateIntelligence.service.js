import { ResumeReview } from '../models/ResumeReview.js';
import { ResumeFraudReport } from '../models/ResumeFraudReport.js';
import { CandidateIntelligence } from '../models/CandidateIntelligence.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

const resumeReviewSchema = z.object({
  atsScore: z.number().min(0).max(100),
  grammarScore: z.number().min(0).max(100),
  formattingScore: z.number().min(0).max(100),
  technicalScore: z.number().min(0).max(100),
  projectScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  missingKeywords: z.array(z.string()).default([]),
  missingSections: z.array(z.string()).default([])
});

const fraudReportSchema = z.object({
  fraudScore: z.number().min(0).max(100),
  riskLevel: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  timelineIssues: z.array(z.string()).default([]),
  duplicateSections: z.array(z.string()).default([]),
  copiedProjects: z.array(z.string()).default([]),
  aiProbability: z.number().min(0).max(100).default(0)
});

const candidateIntelSchema = z.object({
  technicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  assessmentScore: z.number().min(0).max(100),
  resumeScore: z.number().min(0).max(100),
  interviewScore: z.number().min(0).max(100),
  cultureFit: z.number().min(0).max(100),
  learningSpeed: z.number().min(0).max(100),
  overallCandidateRating: z.number().min(0).max(100),
  hiringReadiness: z.enum(['ready', 'near-ready', 'needs-training']),
  expectedSalary: z.number().default(0),
  expectedNoticePeriodDays: z.number().default(30),
  hiringRecommendation: z.enum(['hire', 'strong hire', 'maybe', 'reject'])
});

export const reviewResume = async (resumeContent, companyId, candidateId, userId, context = {}) => {
  const res = await invokeAIGateway('resume_review', { resumeContent }, context);
  const data = parseJSON(res, resumeReviewSchema);

  return await ResumeReview.create({
    company: companyId,
    candidate: candidateId,
    atsScore: data.atsScore,
    grammarScore: data.grammarScore,
    formattingScore: data.formattingScore,
    technicalScore: data.technicalScore,
    projectScore: data.projectScore,
    overallScore: data.overallScore,
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    recommendations: data.recommendations,
    missingKeywords: data.missingKeywords,
    missingSections: data.missingSections,
    createdBy: userId
  });
};

export const detectFraud = async (resumeContent, companyId, candidateId, userId, context = {}) => {
  const res = await invokeAIGateway('fraud_detection', { resumeContent }, context);
  const data = parseJSON(res, fraudReportSchema);

  return await ResumeFraudReport.create({
    company: companyId,
    candidate: candidateId,
    fraudScore: data.fraudScore,
    riskLevel: data.riskLevel,
    confidence: data.confidence,
    reasons: data.reasons,
    timelineIssues: data.timelineIssues,
    duplicateSections: data.duplicateSections,
    copiedProjects: data.copiedProjects,
    aiProbability: data.aiProbability,
    createdBy: userId
  });
};

export const generateCandidateIntelligence = async (profileContent, companyId, candidateId, userId, context = {}) => {
  const res = await invokeAIGateway('career_intelligence', { profileContent }, context);
  const data = parseJSON(res, candidateIntelSchema);

  return await CandidateIntelligence.create({
    company: companyId,
    candidate: candidateId,
    technicalScore: data.technicalScore,
    communicationScore: data.communicationScore,
    assessmentScore: data.assessmentScore,
    resumeScore: data.resumeScore,
    interviewScore: data.interviewScore,
    cultureFit: data.cultureFit,
    learningSpeed: data.learningSpeed,
    overallCandidateRating: data.overallCandidateRating,
    hiringReadiness: data.hiringReadiness,
    expectedSalary: data.expectedSalary,
    expectedNoticePeriodDays: data.expectedNoticePeriodDays,
    hiringRecommendation: data.hiringRecommendation,
    createdBy: userId
  });
};

export const getResumeReview = async (id) => {
  const review = await ResumeReview.findById(id);
  if (!review) throw new AppError('Resume review report not found', 404);
  return review;
};

export const getCandidateIntelligence = async (candidateId) => {
  const intel = await CandidateIntelligence.findOne({ candidate: candidateId });
  if (!intel) throw new AppError('Candidate intelligence report not found', 404);
  return intel;
};
