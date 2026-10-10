import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Job } from '../src/models/Job.js';
import { AIProvider } from '../src/models/AIProvider.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { calculateOverallScore } from '../src/validators/jobQuality.validator.js';
import { computeJobContentHash } from '../src/services/ai.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter', permissions = ['jobs.create', 'jobs.update', 'jobs.publish']) => {
  sequence += 1;
  const user = await User.create({
    fullName: `Test Quality User ${sequence}`,
    email: `recruiter.quality.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });

  let company = null;
  let member = null;
  let profile = null;

  if (role === 'recruiter') {
    company = await Company.create({
      name: `Talvix Quality Tech ${sequence}`,
      slug: `talvix-quality-tech-${sequence}`,
      owner: user._id,
      industry: 'Software Engineering',
      verificationStatus: 'verified',
      isActive: true
    });

    member = await CompanyMember.create({
      recruiter: user._id,
      company: company._id,
      role: 'admin',
      permissions,
      status: 'active',
      joinedAt: new Date()
    });

    profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      isApproved: true,
      isCompanyOwner: true,
      permissions
    });
  }

  const token = generateAccessToken(user.id);
  return { user, company, member, profile, token };
};

describe('Talvix Stage 3B — AI Job Quality Analyzer Integration Tests', () => {
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

  describe('Deterministic Scoring & Rubric Rules', () => {
    it('calculates deterministic weighted overall score correctly', () => {
      const categoryScores = {
        clarity: 90,
        responsibilities: 90,
        skillSeparation: 80,
        seniorityConsistency: 80,
        qualificationRelevance: 70,
        compensationTransparency: 60,
        requirementSpecificity: 85,
        titleConsistency: 95,
        fairnessAndInclusion: 100
      };

      const calculated = calculateOverallScore(categoryScores);
      expect(calculated).toBeGreaterThanOrEqual(0);
      expect(calculated).toBeLessThanOrEqual(100);
      expect(calculated).toBe(84);
    });
  });

  describe('API Endpoints & Tenant Isolation', () => {
    it('allows authorized recruiter to preview quality analysis for unpersisted job draft', async () => {
      const recruiter = await createAccount('recruiter');

      const mockAiResponse = {
        categoryScores: {
          clarity: 85,
          responsibilities: 90,
          skillSeparation: 80,
          seniorityConsistency: 85,
          qualificationRelevance: 80,
          compensationTransparency: 70,
          requirementSpecificity: 90,
          titleConsistency: 95,
          fairnessAndInclusion: 75
        },
        findings: [
          {
            id: 'finding-1',
            category: 'fairnessAndInclusion',
            severity: 'medium',
            evidence: 'looking for digital natives',
            explanation: 'The term "digital native" may be ageist and disincentivize older qualified candidates.',
            recommendation: 'Replace with specific tech stack proficiency requirements.',
            proposedReplacement: 'looking for candidates proficient with modern web technologies',
            requiresHumanReview: true
          }
        ],
        summary: 'Solid job posting with good specificity, but contains potentially ageist wording.'
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiResponse) } }]
        })
      });

      const res = await request(app)
        .post('/api/v1/jobs/ai/analyze-quality')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          title: 'Senior Web Developer',
          description: 'We are looking for digital natives to build modern web applications.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quality.overallScore).toBe(85);
      expect(res.body.data.quality.findings[0].category).toBe('fairnessAndInclusion');
      expect(res.body.data.quality.findings[0].proposedReplacement).toContain('proficient');
    });

    it('analyzes and persists job quality analysis on a managed job document', async () => {
      const recruiter = await createAccount('recruiter');
      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Backend Engineer',
        slug: 'backend-engineer',
        description: 'Building microservices with Node.js and MongoDB.',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'draft'
      });

      const mockAiResponse = {
        categoryScores: {
          clarity: 95,
          responsibilities: 90,
          skillSeparation: 90,
          seniorityConsistency: 90,
          qualificationRelevance: 85,
          compensationTransparency: 80,
          requirementSpecificity: 90,
          titleConsistency: 95,
          fairnessAndInclusion: 95
        },
        findings: [],
        summary: 'Excellent job description with high clarity and specificity.'
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiResponse) } }]
        })
      });

      const res = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/quality/analyze`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ forceRefresh: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quality.status).toBe('completed');
      expect(res.body.data.quality.overallScore).toBe(91);

      // Verify DB persistence
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.quality.status).toBe('completed');
      expect(updatedJob.quality.overallScore).toBe(91);
      expect(updatedJob.status).toBe('draft'); // Must NOT auto-publish
    });

    it('marks quality analysis stale when job description is edited', async () => {
      const recruiter = await createAccount('recruiter');
      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'DevOps Specialist',
        slug: 'devops-specialist',
        description: 'Original DevOps description with Docker and Kubernetes.',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'draft',
        quality: {
          schemaVersion: 1,
          promptVersion: 1,
          status: 'completed',
          analyzedAt: new Date(),
          contentHash: computeJobContentHash('DevOps Specialist', 'Original DevOps description with Docker and Kubernetes.'),
          overallScore: 88,
          categoryScores: {},
          findings: []
        }
      });

      const updateRes = await request(app)
        .patch(`/api/v1/jobs/manage/${job._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          description: 'Updated DevOps description adding Terraform and AWS CloudFormation.'
        });

      expect(updateRes.status).toBe(200);

      // Verify quality status turned stale
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.quality.status).toBe('stale');
    });

    it('rejects cross-company access to job quality with HTTP 404', async () => {
      const companyA = await createAccount('recruiter');
      const companyB = await createAccount('recruiter');

      const jobA = await Job.create({
        company: companyA.company._id,
        createdBy: companyA.user._id,
        title: 'Private Job A',
        slug: 'private-job-a',
        description: 'Private specifications for Company A.',
        employmentType: 'full-time',
        workMode: 'onsite',
        status: 'draft'
      });

      const getRes = await request(app)
        .get(`/api/v1/jobs/manage/${jobA._id}/quality`)
        .set('Authorization', `Bearer ${companyB.token}`);

      expect(getRes.status).toBe(404);

      const analyzeRes = await request(app)
        .post(`/api/v1/jobs/manage/${jobA._id}/quality/analyze`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .send({});

      expect(analyzeRes.status).toBe(404);
    });

    it('rejects candidate and unauthenticated requests with HTTP 401 and HTTP 403', async () => {
      const recruiter = await createAccount('recruiter');
      const candidate = await createAccount('candidate');

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Public Quality Test Job',
        slug: 'public-quality-test-job',
        description: 'Description text',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'draft'
      });

      const unauthRes = await request(app)
        .get(`/api/v1/jobs/manage/${job._id}/quality`);
      expect(unauthRes.status).toBe(401);

      const candidateRes = await request(app)
        .get(`/api/v1/jobs/manage/${job._id}/quality`)
        .set('Authorization', `Bearer ${candidate.token}`);
      expect(candidateRes.status).toBe(403);
    });
  });
});
