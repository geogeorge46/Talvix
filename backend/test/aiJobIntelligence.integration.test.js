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
import { normalizeSkillName, normalizeSkills } from '../src/utils/skillNormalizer.js';
import { computeJobContentHash, extractJobIntelligence } from '../src/services/ai.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter', permissions = ['jobs.create', 'jobs.update', 'jobs.publish']) => {
  sequence += 1;
  const user = await User.create({
    fullName: `Test Intelligence User ${sequence}`,
    email: `recruiter.intel.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });

  let company = null;
  let member = null;
  let profile = null;

  if (role === 'recruiter') {
    company = await Company.create({
      name: `Talvix Intelligence Tech ${sequence}`,
      slug: `talvix-intel-tech-${sequence}`,
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

describe('Talvix Stage 3A — Structured AI Job Intelligence Integration Tests', () => {
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

  describe('Skill Normalization & Parsing Unit Rules', () => {
    it('standardizes duplicate and variations of skill names', () => {
      expect(normalizeSkillName('react.js')).toBe('React');
      expect(normalizeSkillName('ReactJS')).toBe('React');
      expect(normalizeSkillName('node js')).toBe('Node.js');
      expect(normalizeSkillName('ts')).toBe('TypeScript');
    });

    it('deduplicates skills and merges requirement types and evidence', () => {
      const rawSkills = [
        { name: 'react.js', category: 'frontend', requirementType: 'preferred', importance: 'medium', evidence: 'Likes React', source: 'inferred' },
        { name: 'React', category: 'frontend', requirementType: 'required', importance: 'critical', evidence: 'Must have 5+ years React experience', source: 'explicit' }
      ];

      const normalized = normalizeSkills(rawSkills);
      expect(normalized.length).toBe(1);
      expect(normalized[0].name).toBe('React');
      expect(normalized[0].requirementType).toBe('required');
      expect(normalized[0].importance).toBe('critical');
      expect(normalized[0].source).toBe('explicit');
      expect(normalized[0].evidence).toBe('Must have 5+ years React experience');
    });
  });

  describe('API Endpoints & Tenant Isolation', () => {
    it('allows authorized recruiter to preview job intelligence for unpersisted job drafts', async () => {
      const recruiter = await createAccount('recruiter');

      const mockAiResponse = {
        jobTitle: 'Senior Frontend Developer',
        seniorityLevel: 'senior',
        employmentType: 'full-time',
        minimumExperience: 5,
        maximumExperience: 8,
        requiredSkills: [
          { name: 'React', category: 'frontend', requirementType: 'required', importance: 'critical', evidence: '5+ yrs React', source: 'explicit' }
        ],
        preferredSkills: [
          { name: 'TypeScript', category: 'frontend', requirementType: 'preferred', importance: 'high', evidence: 'TypeScript preferred', source: 'explicit' }
        ],
        responsibilities: [{ text: 'Develop web apps', source: 'explicit' }],
        qualifications: [{ text: 'CS degree', source: 'explicit' }],
        educationRequirements: ['B.S. Computer Science'],
        domainKnowledge: ['SaaS'],
        assessmentRecommendations: [{ category: 'Coding', domain: 'frontend', reason: 'Test React skills', source: 'inferred' }]
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiResponse) } }]
        })
      });

      const res = await request(app)
        .post('/api/v1/jobs/ai/extract-intelligence')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          title: 'Senior Frontend Developer',
          description: 'We need a Senior Frontend Developer with 5+ years of React experience and TypeScript.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.intelligence.jobTitle).toBe('Senior Frontend Developer');
      expect(res.body.data.intelligence.seniorityLevel).toBe('senior');
      expect(res.body.data.intelligence.requiredSkills[0].name).toBe('React');
    });

    it('extracts and persists job intelligence on a managed job document', async () => {
      const recruiter = await createAccount('recruiter');
      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Backend Node.js Engineer',
        slug: 'backend-node-engineer',
        description: 'Looking for a Node.js engineer with MongoDB experience.',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'draft'
      });

      const mockAiResponse = {
        jobTitle: 'Backend Node.js Engineer',
        seniorityLevel: 'mid',
        employmentType: 'full-time',
        minimumExperience: 3,
        maximumExperience: 5,
        requiredSkills: [
          { name: 'Node.js', category: 'backend', requirementType: 'required', importance: 'critical', evidence: 'Node.js engineer required', source: 'explicit' },
          { name: 'MongoDB', category: 'database', requirementType: 'required', importance: 'high', evidence: 'MongoDB experience', source: 'explicit' }
        ],
        preferredSkills: [],
        responsibilities: [{ text: 'Build REST APIs', source: 'explicit' }],
        qualifications: [{ text: 'Computer Science degree', source: 'explicit' }],
        educationRequirements: ['Bachelor Degree'],
        domainKnowledge: ['Database Systems'],
        assessmentRecommendations: [{ category: 'Coding', domain: 'backend', reason: 'Node.js backend assessment', source: 'inferred' }]
      };

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(mockAiResponse) } }]
        })
      });

      const res = await request(app)
        .post(`/api/v1/jobs/manage/${job._id}/intelligence/extract`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({ forceRefresh: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.intelligence.status).toBe('completed');
      expect(res.body.data.intelligence.data.requiredSkills.length).toBe(2);

      // Verify persistence in Mongo DB
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.intelligence.status).toBe('completed');
      expect(updatedJob.intelligence.data.jobTitle).toBe('Backend Node.js Engineer');
      expect(updatedJob.status).toBe('draft'); // Ensure status remains draft and is NOT auto-published
    });

    it('marks stored intelligence stale when relevant job description is edited', async () => {
      const recruiter = await createAccount('recruiter');
      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Full Stack Developer',
        slug: 'full-stack-dev',
        description: 'Original description for full stack developer.',
        employmentType: 'full-time',
        workMode: 'hybrid',
        status: 'draft',
        intelligence: {
          schemaVersion: 1,
          promptVersion: 1,
          status: 'completed',
          extractedAt: new Date(),
          contentHash: computeJobContentHash('Full Stack Developer', 'Original description for full stack developer.'),
          data: { jobTitle: 'Full Stack Developer' }
        }
      });

      // Update job description
      const updateRes = await request(app)
        .patch(`/api/v1/jobs/manage/${job._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .send({
          description: 'Updated description adding GraphQL and AWS requirements.'
        });

      expect(updateRes.status).toBe(200);

      // Verify intelligence status turned stale
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.intelligence.status).toBe('stale');
    });

    it('rejects cross-company access to job intelligence with HTTP 404', async () => {
      const companyA = await createAccount('recruiter');
      const companyB = await createAccount('recruiter');

      const jobA = await Job.create({
        company: companyA.company._id,
        createdBy: companyA.user._id,
        title: 'Company A Secret Job',
        slug: 'company-a-secret-job',
        description: 'Private specifications for Company A.',
        employmentType: 'full-time',
        workMode: 'onsite',
        status: 'draft'
      });

      // Recruiter B attempts to fetch or extract intelligence for Job A
      const getRes = await request(app)
        .get(`/api/v1/jobs/manage/${jobA._id}/intelligence`)
        .set('Authorization', `Bearer ${companyB.token}`);

      expect(getRes.status).toBe(404);

      const extractRes = await request(app)
        .post(`/api/v1/jobs/manage/${jobA._id}/intelligence/extract`)
        .set('Authorization', `Bearer ${companyB.token}`)
        .send({});

      expect(extractRes.status).toBe(404);
    });

    it('rejects candidate and unauthenticated requests with HTTP 401 or HTTP 403', async () => {
      const recruiter = await createAccount('recruiter');
      const candidate = await createAccount('candidate');

      const job = await Job.create({
        company: recruiter.company._id,
        createdBy: recruiter.user._id,
        title: 'Public Job',
        slug: 'public-job',
        description: 'Description text',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'draft'
      });

      // Unauthenticated request
      const unauthRes = await request(app)
        .get(`/api/v1/jobs/manage/${job._id}/intelligence`);
      expect(unauthRes.status).toBe(401);

      // Candidate request
      const candidateRes = await request(app)
        .get(`/api/v1/jobs/manage/${job._id}/intelligence`)
        .set('Authorization', `Bearer ${candidate.token}`);
      expect(candidateRes.status).toBe(403);
    });
  });
});
