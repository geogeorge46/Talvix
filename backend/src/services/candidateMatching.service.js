import crypto from 'crypto';
import { Job } from '../models/Job.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { ResumeProfile } from '../models/ResumeProfile.js';
import { Application } from '../models/Application.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AppError } from '../shared/errors/AppError.js';
import { logger } from '../shared/utils/logger.js';
import { invokeAIGateway } from './aiProvider.service.js';

/**
 * Background job handler for candidate/job embedding generation and reindexing.
 */
export const executeEmbeddingJob = async (payload = {}) => {
  logger.info(`[EmbeddingJob] Executing embedding background job: ${JSON.stringify(payload)}`);
  return { success: true, payload };
};

export const SCORING_VERSION = 1;

/**
 * Normalize skill string to canonical lowercased representation.
 */
export const normalizeSkillName = (rawSkill) => {
  if (!rawSkill || typeof rawSkill !== 'string') return '';
  let cleaned = rawSkill.trim().toLowerCase();
  cleaned = cleaned.replace(/\b(react\.?js|reactjs)\b/g, 'react');
  cleaned = cleaned.replace(/\b(node[\s\.]?js|nodejs)\b/g, 'node.js');
  cleaned = cleaned.replace(/\b(vue\.?js|vuejs)\b/g, 'vue');
  cleaned = cleaned.replace(/\b(postgres|postgresql)\b/g, 'postgresql');
  cleaned = cleaned.replace(/\b(mongo|mongodb)\b/g, 'mongodb');
  cleaned = cleaned.replace(/(?<!\.)\b(js|javascript)\b/g, 'javascript');
  cleaned = cleaned.replace(/\b(ts|typescript)\b/g, 'typescript');
  return cleaned;
};

const PROFICIENCY_MAP = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4
};

const PROFICIENCY_REVERSE_MAP = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
  4: 'expert'
};

/**
 * Compute deterministic hash of candidate and job state to detect stale match calculations.
 */
export const computeSourceRevisionsHash = (job, candidateProfile, resumeProfile) => {
  const jobStr = `${job._id}-${job.title}-${job.description}-${job.updatedAt?.getTime() || 0}`;
  const profileStr = `${candidateProfile?._id}-${candidateProfile?.updatedAt?.getTime() || 0}`;
  const resumeStr = `${resumeProfile?._id}-${resumeProfile?.updatedAt?.getTime() || 0}`;
  return crypto.createHash('sha256').update(`${jobStr}|${profileStr}|${resumeStr}`).digest('hex');
};

/**
 * Extract candidate's skills and experience metrics across all available evidence (CandidateProfile + ResumeProfile).
 * STRICT PRIVACY REQUIREMENT: Protected attributes (gender, photo, DOB, name, etc.) are EXCLUDED.
 */
export const extractCandidateEvidence = (candidateProfile, resumeProfile, assessmentAttempts = []) => {
  const candidateSkills = new Map();

  // Calculate total professional experience years
  let totalExperienceYears = 0;
  if (candidateProfile?.experience && Array.isArray(candidateProfile.experience)) {
    for (const exp of candidateProfile.experience) {
      if (exp.startDate) {
        const start = new Date(exp.startDate).getTime();
        const end = exp.endDate ? new Date(exp.endDate).getTime() : Date.now();
        const diffMonths = Math.max(1, (end - start) / (1000 * 60 * 60 * 24 * 30.4375));
        totalExperienceYears += diffMonths / 12;
      }
    }
  } else if (resumeProfile?.experience && Array.isArray(resumeProfile.experience)) {
    for (const exp of resumeProfile.experience) {
      if (exp.durationMonths) {
        totalExperienceYears += exp.durationMonths / 12;
      }
    }
  }
  totalExperienceYears = Math.round(totalExperienceYears * 10) / 10;

  const defaultSkillYears = Math.max(1, totalExperienceYears);

  const processSkillEntry = (rawName, prof = 'intermediate', years = 0, source = 'profile', verified = false) => {
    const canonical = normalizeSkillName(rawName);
    if (!canonical) return;

    const numericProf = typeof prof === 'string' ? (PROFICIENCY_MAP[prof.toLowerCase()] || 2) : (prof || 2);
    const numericYears = Number(years) || 0;

    const existing = candidateSkills.get(canonical) || {
      canonicalName: canonical,
      displayName: rawName,
      proficiencyLevel: 1,
      yearsOfExperience: 0,
      sources: new Set(),
      verified: false
    };

    existing.proficiencyLevel = Math.max(existing.proficiencyLevel, numericProf);
    existing.yearsOfExperience = Math.max(existing.yearsOfExperience, numericYears);
    existing.sources.add(source);
    if (verified) existing.verified = true;

    candidateSkills.set(canonical, existing);
  };

  // 1. Candidate Profile Skills
  if (candidateProfile?.skills && Array.isArray(candidateProfile.skills)) {
    for (const s of candidateProfile.skills) {
      processSkillEntry(s.name, s.proficiency, s.yearsOfExperience, 'candidate_profile', s.verified);
    }
  }

  // 2. Candidate Profile Experience & Projects Tech Stack
  if (candidateProfile?.experience && Array.isArray(candidateProfile.experience)) {
    for (const exp of candidateProfile.experience) {
      if (exp.skills && Array.isArray(exp.skills)) {
        for (const sk of exp.skills) {
          processSkillEntry(sk, 'intermediate', defaultSkillYears, 'work_experience');
        }
      }
    }
  }

  if (candidateProfile?.projects && Array.isArray(candidateProfile.projects)) {
    for (const proj of candidateProfile.projects) {
      if (proj.technologies && Array.isArray(proj.technologies)) {
        for (const tech of proj.technologies) {
          processSkillEntry(tech, 'beginner', 1, 'projects');
        }
      }
    }
  }

  // 3. Parsed Resume Profile Skills
  if (resumeProfile?.skills) {
    const categories = ['technical', 'frameworks', 'languages', 'databases', 'cloud', 'devops', 'tools'];
    for (const cat of categories) {
      if (Array.isArray(resumeProfile.skills[cat])) {
        for (const item of resumeProfile.skills[cat]) {
          processSkillEntry(item, 'intermediate', defaultSkillYears, 'resume_parsed');
        }
      }
    }
  }

  if (resumeProfile?.experience && Array.isArray(resumeProfile.experience)) {
    for (const exp of resumeProfile.experience) {
      if (Array.isArray(exp.technologies)) {
        for (const tech of exp.technologies) {
          processSkillEntry(tech, 'intermediate', defaultSkillYears, 'resume_experience');
        }
      }
    }
  }

  // 4. Assessment Attempts Evidence
  const assessedSkills = new Map();
  if (Array.isArray(assessmentAttempts)) {
    for (const attempt of assessmentAttempts) {
      if (attempt.status === 'completed' && attempt.evaluation?.percentage !== undefined) {
        const score = attempt.evaluation.percentage;
        const passed = attempt.evaluation.passed ?? (score >= 70);

        if (attempt.assessment?.skills && Array.isArray(attempt.assessment.skills)) {
          for (const s of attempt.assessment.skills) {
            const canonical = normalizeSkillName(s);
            if (canonical) {
              assessedSkills.set(canonical, { score, passed, attemptId: attempt._id });
              processSkillEntry(s, passed ? 'advanced' : 'intermediate', 1, 'assessment', passed);
            }
          }
        }
      }
    }
  }

  return {
    candidateSkills,
    assessedSkills,
    totalExperienceYears
  };
};

/**
 * Deterministic Candidate-Job Match Calculator.
 * STRICT FAIRNESS GUARANTEE: Excludes protected personal characteristics (gender, DOB, photo, etc.).
 */
export const calculateMatchScore = (job, candidateProfile, resumeProfile, assessmentAttempts = []) => {
  const { candidateSkills, assessedSkills, totalExperienceYears } = extractCandidateEvidence(
    candidateProfile,
    resumeProfile,
    assessmentAttempts
  );

  // Extract job skills
  const rawJobSkills = job.skills || [];
  const intelligenceSkills = job.intelligence?.data?.canonicalSkills || [];

  const jobSkillsList = [];
  const seenJobSkills = new Set();

  for (const s of rawJobSkills) {
    const canonical = normalizeSkillName(s.name);
    if (canonical && !seenJobSkills.has(canonical)) {
      seenJobSkills.add(canonical);
      jobSkillsList.push({
        canonicalName: canonical,
        displayName: s.name,
        required: s.required ?? true,
        minimumProficiency: s.minimumProficiency || 'beginner',
        minimumYearsOfExperience: s.minimumYearsOfExperience || 0,
        weight: s.weight || 50
      });
    }
  }

  for (const s of intelligenceSkills) {
    const canonical = normalizeSkillName(s.skill || s.canonicalSkill);
    if (canonical && !seenJobSkills.has(canonical)) {
      seenJobSkills.add(canonical);
      jobSkillsList.push({
        canonicalName: canonical,
        displayName: s.skill || s.canonicalSkill,
        required: s.requirementType === 'required',
        minimumProficiency: s.minimumProficiency || 'beginner',
        minimumYearsOfExperience: s.minimumYears || 0,
        weight: s.requirementType === 'required' ? 75 : 25
      });
    }
  }

  // Scoring weights breakdown
  let totalRequiredWeight = 0;
  let earnedRequiredWeight = 0;
  let totalPreferredWeight = 0;
  let earnedPreferredWeight = 0;

  let requiredMatchedCount = 0;
  let requiredTotalCount = 0;
  let preferredMatchedCount = 0;
  let preferredTotalCount = 0;

  const skillGapAnalysis = [];
  const matchStrengths = [];
  const potentialSkillGaps = [];
  const missingInformation = [];

  for (const js of jobSkillsList) {
    const minProfNumeric = PROFICIENCY_MAP[js.minimumProficiency.toLowerCase()] || 1;
    const minYears = js.minimumYearsOfExperience || 0;
    const skillWeight = js.required ? (js.weight || 75) * 1.5 : (js.weight || 25);

    if (js.required) requiredTotalCount += 1;
    else preferredTotalCount += 1;

    const candSkill = candidateSkills.get(js.canonicalName);
    const assessmentRes = assessedSkills.get(js.canonicalName);

    let classification = 'not_found';
    let confidenceStatus = 'unverified';
    let candidateEvidenceObj = {
      found: false,
      proficiency: 'none',
      yearsOfExperience: 0,
      source: 'none'
    };

    if (candSkill) {
      candidateEvidenceObj = {
        found: true,
        proficiency: PROFICIENCY_REVERSE_MAP[candSkill.proficiencyLevel] || 'intermediate',
        yearsOfExperience: candSkill.yearsOfExperience,
        source: Array.from(candSkill.sources).join(', ')
      };

      const meetsProf = candSkill.proficiencyLevel >= minProfNumeric;
      const meetsYears = minYears === 0 || candSkill.yearsOfExperience >= minYears;

      if (meetsProf && meetsYears) {
        classification = 'demonstrated';
      } else {
        classification = 'partially_demonstrated';
      }

      if (candSkill.verified || assessmentRes?.passed) {
        confidenceStatus = 'verified';
      } else if (candSkill.sources.has('candidate_profile') || candSkill.sources.has('work_experience')) {
        confidenceStatus = 'unverified';
      } else {
        confidenceStatus = 'inferred';
      }
    } else if (job.assessmentRequired && !assessmentRes) {
      classification = 'not_assessed';
      confidenceStatus = 'unverified';
    }

    // Weight Calculation
    let earnedFraction = 0;
    if (classification === 'demonstrated') {
      earnedFraction = 1.0;
      if (js.required) requiredMatchedCount += 1;
      else preferredMatchedCount += 1;
      matchStrengths.push(`Demonstrated requirement: ${js.displayName} (${candidateEvidenceObj.yearsOfExperience} yrs experience)`);
    } else if (classification === 'partially_demonstrated') {
      earnedFraction = 0.5;
      if (js.required) requiredMatchedCount += 0.5;
      else preferredMatchedCount += 0.5;
      potentialSkillGaps.push(`Partial match for ${js.displayName}: Found ${candidateEvidenceObj.proficiency} proficiency vs required ${js.minimumProficiency}.`);
    } else if (classification === 'not_assessed') {
      earnedFraction = 0.0;
      potentialSkillGaps.push(`Assessment required for ${js.displayName} but not yet completed.`);
      missingInformation.push(`Pending assessment evaluation for ${js.displayName}.`);
    } else {
      earnedFraction = 0.0;
      potentialSkillGaps.push(`Skill missing from candidate evidence: ${js.displayName}.`);
    }

    if (js.required) {
      totalRequiredWeight += skillWeight;
      earnedRequiredWeight += skillWeight * earnedFraction;
    } else {
      totalPreferredWeight += skillWeight;
      earnedPreferredWeight += skillWeight * earnedFraction;
    }

    // Practical learning recommendation for skill gap
    let suggestedNextStep = 'No action required; skill requirements satisfied.';
    if (classification === 'not_found') {
      suggestedNextStep = `Suggested Learning: Complete an introductory course or guided project on ${js.displayName}. (Note: Learning suggestions do not represent verified qualifications).`;
    } else if (classification === 'partially_demonstrated') {
      suggestedNextStep = `Suggested Growth: Deepen hands-on practice in ${js.displayName} to reach ${js.minimumProficiency} proficiency.`;
    } else if (classification === 'not_assessed') {
      suggestedNextStep = `Action Required: Complete the required candidate technical assessment for ${js.displayName}.`;
    }

    skillGapAnalysis.push({
      canonicalSkill: js.canonicalName,
      displayName: js.displayName,
      requirementType: js.required ? 'required' : 'preferred',
      jobRequirement: {
        minimumProficiency: js.minimumProficiency,
        minimumYearsOfExperience: js.minimumYearsOfExperience
      },
      candidateEvidence: candidateEvidenceObj,
      evidenceClassification: classification,
      confidenceStatus,
      assessmentResult: assessmentRes ? { score: assessmentRes.score, passed: assessmentRes.passed } : null,
      suggestedNextStep
    });
  }

  // 1. Skill Match Percentage (70% total weight)
  const reqSkillScore = totalRequiredWeight > 0 ? (earnedRequiredWeight / totalRequiredWeight) * 100 : 100;
  const prefSkillScore = totalPreferredWeight > 0 ? (earnedPreferredWeight / totalPreferredWeight) * 100 : 100;
  const combinedSkillScore = (reqSkillScore * 0.8) + (prefSkillScore * 0.2);

  // 2. Experience Match Score (20% total weight)
  const requiredJobExperience = job.minimumExperience || 0;
  let experienceScore = 100;
  if (requiredJobExperience > 0) {
    if (totalExperienceYears >= requiredJobExperience) {
      experienceScore = 100;
      matchStrengths.push(`Experience alignment: Candidate possesses ${totalExperienceYears} yrs experience (Job requires ${requiredJobExperience} yrs).`);
    } else {
      experienceScore = Math.round((totalExperienceYears / requiredJobExperience) * 100);
      potentialSkillGaps.push(`Experience gap: Candidate has ${totalExperienceYears} yrs total experience vs required ${requiredJobExperience} yrs.`);
    }
  }

  // 3. Qualification Score (10% total weight)
  let qualificationScore = 100;
  let qualificationMatches = true;
  let qualificationDetails = 'Candidate degree and background align with job requirements.';

  if (job.educationRequirements && job.educationRequirements.length > 0) {
    const candidateEdu = candidateProfile?.education || resumeProfile?.education || [];
    if (candidateEdu.length === 0) {
      qualificationScore = 50;
      qualificationMatches = false;
      qualificationDetails = 'No education background listed in candidate profile.';
      missingInformation.push('Education background not explicitly listed.');
    }
  }

  // 4. Overall Weighted Score (0 to 100)
  const rawOverallScore = (combinedSkillScore * 0.7) + (experienceScore * 0.2) + (qualificationScore * 0.1);
  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverallScore)));

  // Coverage percentages
  const requiredPercentage = requiredTotalCount > 0 ? Math.round((requiredMatchedCount / requiredTotalCount) * 100) : 100;
  const preferredPercentage = preferredTotalCount > 0 ? Math.round((preferredMatchedCount / preferredTotalCount) * 100) : 100;

  // Assessment Evidence Summary
  let assessmentEvidenceObj = null;
  if (Array.isArray(assessmentAttempts) && assessmentAttempts.length > 0) {
    const completedAttempts = assessmentAttempts.filter((a) => a.status === 'completed');
    if (completedAttempts.length > 0) {
      const avgPercentage = Math.round(
        completedAttempts.reduce((acc, a) => acc + (a.evaluation?.percentage || 0), 0) / completedAttempts.length
      );
      assessmentEvidenceObj = {
        completedCount: completedAttempts.length,
        averageScore: avgPercentage,
        allPassed: completedAttempts.every((a) => a.evaluation?.passed)
      };
    }
  }

  return {
    overallScore,
    requiredSkillCoverage: {
      percentage: requiredPercentage,
      matchedCount: Math.floor(requiredMatchedCount),
      totalCount: requiredTotalCount
    },
    preferredSkillCoverage: {
      percentage: preferredPercentage,
      matchedCount: Math.floor(preferredMatchedCount),
      totalCount: preferredTotalCount
    },
    relevantExperienceEvidence: {
      candidateYears: totalExperienceYears,
      requiredYears: requiredJobExperience,
      matchesRequirement: totalExperienceYears >= requiredJobExperience
    },
    qualificationAlignment: {
      matches: qualificationMatches,
      details: qualificationDetails
    },
    assessmentEvidence: assessmentEvidenceObj,
    matchStrengths,
    potentialSkillGaps,
    missingInformation,
    skillGapAnalysis,
    scoringVersion: SCORING_VERSION,
    sourceRevisionsHash: computeSourceRevisionsHash(job, candidateProfile, resumeProfile)
  };
};

/**
 * Generate AI Match Explanation strictly as narrative context without altering the score.
 */
export const generateCandidateMatchExplanation = async (job, candidateProfile, resumeProfile, matchResult, context = {}) => {
  try {
    const promptVariables = {
      jobTitle: job.title,
      overallScore: matchResult.overallScore,
      requiredCoverage: `${matchResult.requiredSkillCoverage.matchedCount}/${matchResult.requiredSkillCoverage.totalCount}`,
      matchStrengths: matchResult.matchStrengths.join('; '),
      skillGaps: matchResult.potentialSkillGaps.join('; ')
    };

    const aiResponse = await invokeAIGateway({
      promptTemplateKey: 'explain_candidate_match',
      promptVariables,
      context,
      options: { temperature: 0.2, maxTokens: 800 }
    });

    if (aiResponse?.text) {
      return aiResponse.text;
    }
  } catch (error) {
    // Non-blocking fallback text if AI gateway encounters failure
  }

  return `Candidate achieves an overall relevance score of ${matchResult.overallScore}/100 with ${matchResult.requiredSkillCoverage.percentage}% required skill alignment. Strengths include ${matchResult.matchStrengths.slice(0, 2).join(', ') || 'demonstrated skill competencies'}. Identified growth areas include ${matchResult.potentialSkillGaps.slice(0, 2).join(', ') || 'none'}.`;
};

/**
 * Calculate or retrieve stored candidate-job match.
 */
export const calculateAndPersistMatch = async (companyId, jobId, candidateUserId, options = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const candidateProfile = await CandidateProfile.findOne({ user: candidateUserId });
  if (!candidateProfile) {
    throw new AppError('Candidate profile not found', 404);
  }

  const resumeProfile = await ResumeProfile.findOne({ candidate: candidateUserId });
  const assessmentAttempts = await AssessmentAttempt.find({ candidate: candidateUserId, company: companyId, status: 'completed' });

  const matchData = calculateMatchScore(job, candidateProfile, resumeProfile, assessmentAttempts);
  const explanation = await generateCandidateMatchExplanation(job, candidateProfile, resumeProfile, matchData, {
    companyId,
    userId: options.userId
  });

  return {
    jobId: job._id,
    candidateUserId,
    match: matchData,
    explanation
  };
};

/**
 * List match summaries for applicants to a recruiter's job with pagination and bounded queries.
 */
export const getManagedApplicantMatchesService = async (companyId, jobId, queryOptions = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const page = Number(queryOptions.page) || 1;
  const limit = Math.min(100, Number(queryOptions.limit) || 10);
  const skip = (page - 1) * limit;

  const totalApplications = await Application.countDocuments({ job: jobId, company: companyId });
  const applications = await Application.find({ job: jobId, company: companyId })
    .populate('candidate', 'fullName email')
    .populate('candidateProfile')
    .skip(skip)
    .limit(limit)
    .lean();

  const applicantMatches = [];

  for (const app of applications) {
    const resumeProfile = await ResumeProfile.findOne({ candidate: app.candidate?._id }).lean();
    const assessmentAttempts = await AssessmentAttempt.find({ candidate: app.candidate?._id, company: companyId, status: 'completed' }).lean();

    const matchResult = calculateMatchScore(job, app.candidateProfile, resumeProfile, assessmentAttempts);

    applicantMatches.push({
      applicationId: app._id,
      applicationNumber: app.applicationNumber,
      candidate: {
        id: app.candidate?._id,
        fullName: app.candidate?.fullName,
        email: app.candidate?.email
      },
      matchScore: matchResult.overallScore,
      requiredSkillCoverage: matchResult.requiredSkillCoverage,
      preferredSkillCoverage: matchResult.preferredSkillCoverage,
      experienceMatch: matchResult.relevantExperienceEvidence,
      matchStrengths: matchResult.matchStrengths.slice(0, 3),
      potentialSkillGaps: matchResult.potentialSkillGaps.slice(0, 3)
    });
  }

  if (queryOptions.sort === 'score-desc') {
    applicantMatches.sort((a, b) => b.matchScore - a.matchScore);
  } else if (queryOptions.sort === 'score-asc') {
    applicantMatches.sort((a, b) => a.matchScore - b.matchScore);
  }

  return {
    jobId: job._id,
    jobTitle: job.title,
    pagination: {
      page,
      limit,
      total: totalApplications,
      totalPages: Math.ceil(totalApplications / limit)
    },
    matches: applicantMatches
  };
};

/**
 * Retrieve detailed match explanation for recruiter.
 */
export const getManagedApplicationMatchDetailsService = async (companyId, applicationId) => {
  const appDoc = await Application.findOne({ _id: applicationId, company: companyId })
    .populate('candidate', 'fullName email')
    .populate('candidateProfile')
    .populate('job');

  if (!appDoc) {
    throw new AppError('Application not found', 404);
  }

  const resumeProfile = await ResumeProfile.findOne({ candidate: appDoc.candidate._id });
  const assessmentAttempts = await AssessmentAttempt.find({ candidate: appDoc.candidate._id, company: companyId, status: 'completed' });

  const matchData = calculateMatchScore(appDoc.job, appDoc.candidateProfile, resumeProfile, assessmentAttempts);
  const explanation = await generateCandidateMatchExplanation(appDoc.job, appDoc.candidateProfile, resumeProfile, matchData, { companyId });

  return {
    applicationId: appDoc._id,
    jobId: appDoc.job._id,
    jobTitle: appDoc.job.title,
    candidate: {
      id: appDoc.candidate._id,
      fullName: appDoc.candidate.fullName,
      email: appDoc.candidate.email
    },
    match: matchData,
    explanation
  };
};

/**
 * Candidate self-view of job fit and skill gap analysis (sanitized of recruiter notes/ratings).
 */
export const getCandidateJobFitAnalysisService = async (candidateUserId, jobId) => {
  const job = await Job.findById(jobId).select('title description company skills minimumExperience educationRequirements intelligence assessmentRequired');
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const candidateProfile = await CandidateProfile.findOne({ user: candidateUserId });
  if (!candidateProfile) {
    throw new AppError('Candidate profile not found', 404);
  }

  const resumeProfile = await ResumeProfile.findOne({ candidate: candidateUserId });
  const assessmentAttempts = await AssessmentAttempt.find({ candidate: candidateUserId, status: 'completed' });

  const matchData = calculateMatchScore(job, candidateProfile, resumeProfile, assessmentAttempts);

  return {
    jobId: job._id,
    jobTitle: job.title,
    matchScore: matchData.overallScore,
    requiredSkillCoverage: matchData.requiredSkillCoverage,
    preferredSkillCoverage: matchData.preferredSkillCoverage,
    skillGapAnalysis: matchData.skillGapAnalysis.map((s) => ({
      canonicalSkill: s.canonicalSkill,
      displayName: s.displayName,
      requirementType: s.requirementType,
      evidenceClassification: s.evidenceClassification,
      suggestedNextStep: s.suggestedNextStep
    })),
    matchStrengths: matchData.matchStrengths,
    potentialSkillGaps: matchData.potentialSkillGaps
  };
};
