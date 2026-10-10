import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { ResumeProfile } from '../src/models/ResumeProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { AIProvider } from '../src/models/AIProvider.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import {
  calculateMatchScore,
  normalizeSkillName,
  generateCandidateMatchExplanation
} from '../src/services/candidateMatching.service.js';

let replicaSet;
let sequence = 0;

const createRecruiterAccount = async (permissions = ['jobs.create', 'jobs.update', 'jobs.publish', 'applications.view', 'applications.manage']) => {
  sequence += 1;
  const user = await User.create({
    fullName: `Recruiter Match ${sequence}`,
    email: `recruiter.match.${sequence}@talvix.test`,
    password: 'Password123!',
    role: 'recruiter'
  });

  const company = await Company.create({
    name: `Talvix Match Company ${sequence}`,
    slug: `talvix-match-company-${sequence}`,
    owner: user._id,
    industry: 'Software Engineering',
    verificationStatus: 'verified',
    isActive: true
  });

  await CompanyMember.create({
    recruiter: user._id,
    company: company._id,
    role: 'admin',
    permissions,
    status: 'active',
    joinedAt: new Date()
  });

  await RecruiterProfile.create({
    user: user._id,
    company: company._id,
    isApproved: true,
    isCompanyOwner: true,
    permissions
  });

  const token = generateAccessToken(user.id);
  return { user, company, token };
};

const createCandidateAccount = async (profileData = {}) => {
  sequence += 1;
  const user = await User.create({
    fullName: profileData.fullName || `Candidate Match ${sequence}`,
    email: profileData.email || `candidate.match.${sequence}@talvix.test`,
    password: 'Password123!',
    role: 'candidate'
  });

  const candidateProfile = await CandidateProfile.create({
    user: user._id,
    headline: 'Senior Full Stack Engineer',
    gender: profileData.gender || 'female',
    dateOfBirth: profileData.dateOfBirth || new Date('1995-05-15'),
    profilePhoto: profileData.profilePhoto || { url: 'https://example.com/photo.jpg' },
    skills: profileData.skills || [
      { name: 'React.js', proficiency: 'advanced', yearsOfExperience: 4, verified: true },
      { name: 'Node.js', proficiency: 'intermediate', yearsOfExperience: 3, verified: false }
    ],
    experience: profileData.experience || [
      {
        company: 'Tech Corp',
        title: 'Software Developer',
        employmentType: 'full-time',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-12-31'),
        skills: ['React', 'Node.js', 'PostgreSQL']
      }
    ],
    education: profileData.education || [
      {
        institution: 'State University',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startYear: 2016,
        endYear: 2020
      }
    ]
  });

  const token = generateAccessToken(user.id);
  return { user, candidateProfile, token };
};

describe('Talvix Stage 3D — Explainable AI Candidate–Job Matching Integration Tests', () => {
  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' }
    });
    await mongoose.connect(replicaSet.getUri());

    await AIProvider.create({
      provider: 'openrouter',
      name: 'OpenRouter Primary',
      displayName: 'OpenRouter Primary',
      apiKey: 'test-api-key',
      baseUrl: 'https://openrouter.ai/api/v1',
      supportedModels: ['google/gemini-2.5-flash'],
      primaryModel: 'google/gemini-2.5-flash',
      isDefault: true,
      isActive: true,
      retryCount: 1,
      retryBackoffMs: 1
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Core Matching Rules & Fairness', () => {
    it('1. Normalizes skill canonical names correctly', () => {
      expect(normalizeSkillName('React.js')).toBe('react');
      expect(normalizeSkillName('Node JS')).toBe('node.js');
      expect(normalizeSkillName('TS')).toBe('typescript');
      expect(normalizeSkillName('PostgreSQL')).toBe('postgresql');
    });

    it('2. Weights required skills heavier than preferred skills', () => {
      const mockJob = {
        title: 'Frontend Engineer',
        minimumExperience: 2,
        skills: [
          { name: 'React', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 2, weight: 80 },
          { name: 'Docker', required: false, minimumProficiency: 'beginner', minimumYearsOfExperience: 1, weight: 20 }
        ]
      };

      const candidateHasRequired = {
        skills: [{ name: 'React', proficiency: 'advanced', yearsOfExperience: 3 }]
      };

      const candidateHasPreferredOnly = {
        skills: [{ name: 'Docker', proficiency: 'advanced', yearsOfExperience: 3 }]
      };

      const scoreRequired = calculateMatchScore(mockJob, candidateHasRequired, null);
      const scorePreferred = calculateMatchScore(mockJob, candidateHasPreferredOnly, null);

      expect(scoreRequired.overallScore).toBeGreaterThan(scorePreferred.overallScore);
      expect(scoreRequired.requiredSkillCoverage.percentage).toBe(100);
      expect(scorePreferred.requiredSkillCoverage.percentage).toBe(0);
    });

    it('3. Categorizes missing vs. demonstrated vs. partially demonstrated skills', () => {
      const mockJob = {
        title: 'Full Stack Engineer',
        minimumExperience: 3,
        skills: [
          { name: 'React', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 2, weight: 50 },
          { name: 'Python', required: true, minimumProficiency: 'expert', minimumYearsOfExperience: 5, weight: 50 },
          { name: 'GraphQL', required: false, minimumProficiency: 'beginner', minimumYearsOfExperience: 1, weight: 20 }
        ]
      };

      const candidate = {
        skills: [
          { name: 'React', proficiency: 'advanced', yearsOfExperience: 3 },
          { name: 'Python', proficiency: 'beginner', yearsOfExperience: 1 }
        ]
      };

      const result = calculateMatchScore(mockJob, candidate, null);
      const reactGap = result.skillGapAnalysis.find((s) => s.canonicalSkill === 'react');
      const pythonGap = result.skillGapAnalysis.find((s) => s.canonicalSkill === 'python');
      const graphqlGap = result.skillGapAnalysis.find((s) => s.canonicalSkill === 'graphql');

      expect(reactGap.evidenceClassification).toBe('demonstrated');
      expect(pythonGap.evidenceClassification).toBe('partially_demonstrated');
      expect(graphqlGap.evidenceClassification).toBe('not_found');
    });

    it('4. Incorporates parsed resume profile evidence and experience years', () => {
      const mockJob = {
        title: 'DevOps Engineer',
        minimumExperience: 3,
        skills: [{ name: 'Kubernetes', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 2, weight: 50 }]
      };

      const candidateProfile = { skills: [] };
      const resumeProfile = {
        skills: { cloud: ['Kubernetes'] },
        experience: [{ company: 'Cloud Corp', durationMonths: 36 }]
      };

      const result = calculateMatchScore(mockJob, candidateProfile, resumeProfile);
      expect(result.requiredSkillCoverage.percentage).toBe(100);
      expect(result.relevantExperienceEvidence.candidateYears).toBe(3);
    });

    it('5. Integrates optional completed assessment evidence', () => {
      const mockJob = {
        title: 'Backend Engineer',
        assessmentRequired: true,
        skills: [{ name: 'Node.js', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 2, weight: 50 }]
      };

      const candidateProfile = {
        skills: [{ name: 'Node.js', proficiency: 'intermediate', yearsOfExperience: 2 }]
      };

      const assessmentAttempts = [
        {
          status: 'completed',
          evaluation: { percentage: 95, passed: true },
          assessment: { skills: ['Node.js'] }
        }
      ];

      const result = calculateMatchScore(mockJob, candidateProfile, null, assessmentAttempts);
      expect(result.assessmentEvidence).not.toBeNull();
      expect(result.assessmentEvidence.averageScore).toBe(95);
      expect(result.skillGapAnalysis[0].confidenceStatus).toBe('verified');
    });

    it('6. STRICT FAIRNESS CHECK: Excludes protected personal characteristics from scoring', () => {
      const mockJob = {
        title: 'Senior Engineer',
        minimumExperience: 3,
        skills: [{ name: 'React', required: true, minimumProficiency: 'intermediate', minimumYearsOfExperience: 3, weight: 50 }]
      };

      const candidateA = {
        fullName: 'Candidate Female',
        gender: 'female',
        dateOfBirth: new Date('1996-01-01'),
        profilePhoto: { url: 'https://example.com/female.jpg' },
        skills: [{ name: 'React', proficiency: 'advanced', yearsOfExperience: 4 }]
      };

      const candidateB = {
        fullName: 'Candidate Male',
        gender: 'male',
        dateOfBirth: new Date('1980-06-15'),
        profilePhoto: { url: 'https://example.com/male.jpg' },
        skills: [{ name: 'React', proficiency: 'advanced', yearsOfExperience: 4 }]
      };

      const scoreA = calculateMatchScore(mockJob, candidateA, null);
      const scoreB = calculateMatchScore(mockJob, candidateB, null);

      expect(scoreA.overallScore).toBe(scoreB.overallScore);
      expect(scoreA.requiredSkillCoverage.percentage).toBe(scoreB.requiredSkillCoverage.percentage);
    });

    it('7. Handles AI explanation provider failures gracefully without score fabrication', async () => {
      const mockJob = { title: 'Software Engineer' };
      const matchResult = {
        overallScore: 85,
        requiredSkillCoverage: { percentage: 80, matchedCount: 4, totalCount: 5 },
        matchStrengths: ['Strong React experience'],
        potentialSkillGaps: ['Missing AWS certification']
      };

      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('AI Gateway 503 Provider Unavailable'));

      const explanation = await generateCandidateMatchExplanation(mockJob, {}, null, matchResult);
      expect(explanation).toContain('overall relevance score of 85/100');
      expect(explanation).toContain('Strong React experience');
    });
  });

  describe('API Endpoints & Tenant Authorization', () => {
    it('8. Retrieves applicant matches list for an authorized recruiter job with pagination', async () => {
      const recruiter = await createRecruiterAccount();
      const candidate1 = await createCandidateAccount();
      const candidate2 = await createCandidateAccount();

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Senior React Developer',
        slug: 'senior-react-developer',
        employmentType: 'full-time',
        workMode: 'remote',
        description: 'React developer position.',
        skills: [{ name: 'React', required: true, weight: 50 }]
      });

      await Application.create({
        candidate: candidate1.user._id,
        candidateProfile: candidate1.candidateProfile._id,
        job: job._id,
        company: recruiter.company._id,
        applicationNumber: 'APP-MATCH-1',
        candidateSnapshot: {},
        jobSnapshot: {},
        skillMatch: { score: 85, matchedSkills: ['React'], missingRequiredSkills: [], breakdown: [] }
      });

      await Application.create({
        candidate: candidate2.user._id,
        candidateProfile: candidate2.candidateProfile._id,
        job: job._id,
        company: recruiter.company._id,
        applicationNumber: 'APP-MATCH-2',
        candidateSnapshot: {},
        jobSnapshot: {},
        skillMatch: { score: 60, matchedSkills: ['React'], missingRequiredSkills: [], breakdown: [] }
      });

      const res = await request(app)
        .get(`/api/v1/applications/manage/jobs/${job._id}/matches?page=1&limit=10`)
        .set('Authorization', `Bearer ${recruiter.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.matches.length).toBe(2);
      expect(res.body.data.pagination.total).toBe(2);
    });

    it('9. Enforces multi-tenant isolation (404 on cross-company applicant match request)', async () => {
      const recruiterA = await createRecruiterAccount();
      const recruiterB = await createRecruiterAccount();

      const jobA = await Job.create({
        company: recruiterA.company._id,
        createdBy: recruiterA.user._id,
        title: 'Job A',
        slug: 'job-a',
        employmentType: 'full-time',
        workMode: 'remote',
        description: 'Job A description.'
      });

      const res = await request(app)
        .get(`/api/v1/applications/manage/jobs/${jobA._id}/matches`)
        .set('Authorization', `Bearer ${recruiterB.token}`);

      expect(res.status).toBe(404);
    });

    it('10. Allows candidate to access their own job fit & skill gap analysis', async () => {
      const recruiter = await createRecruiterAccount();
      const candidate = await createCandidateAccount();

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Full Stack Engineer',
        slug: 'full-stack-engineer-candidate-fit',
        employmentType: 'full-time',
        workMode: 'remote',
        description: 'Full stack role.',
        skills: [{ name: 'React', required: true, weight: 50 }]
      });

      const res = await request(app)
        .get(`/api/v1/applications/me/jobs/${job._id}/fit-analysis`)
        .set('Authorization', `Bearer ${candidate.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobTitle).toBe('Full Stack Engineer');
      expect(res.body.data.skillGapAnalysis).toBeDefined();
    });
  });
});
