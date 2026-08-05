import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { ResumeProfile } from '../src/models/ResumeProfile.js';
import { ResumeEmbedding } from '../src/models/ResumeEmbedding.js';
import { JobIntelligence } from '../src/models/JobIntelligence.js';
import { JobEmbedding } from '../src/models/JobEmbedding.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Document } from '../src/models/Document.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} AI User ${sequence}`,
    email: `ai.match.user.${sequence}@talvix.test`,
    password: 'Password123!',
    role
  });
  return { user, token: generateAccessToken(user.id) };
};

const createMockCompany = async (ownerId) => {
  sequence += 1;
  const company = await Company.create({
    name: `Company ${sequence}`,
    slug: `company-${sequence}`,
    owner: ownerId,
    isActive: true
  });

  await RecruiterProfile.create({
    user: ownerId,
    company: company._id,
    isApproved: true
  });

  await CompanyMember.create({
    company: company._id,
    recruiter: ownerId,
    role: 'recruiter',
    permissions: ['jobs.create', 'jobs.update', 'jobs.publish', 'jobs.delete'],
    status: 'active'
  });

  return company;
};

const createMockJob = async (companyId, userId, title = 'Backend Engineer') => {
  sequence += 1;
  return await Job.create({
    company: companyId,
    createdBy: userId,
    title,
    slug: `job-${sequence}`,
    description: 'Requires TypeScript and Node.js. 3 years experience.',
    keyRequirements: 'Must know Mongoose.',
    employmentType: 'full-time',
    workMode: 'onsite',
    status: 'published'
  });
};

const createMockDocument = async (userId, fileName = 'resume.pdf') => {
  return await Document.create({
    owner: userId,
    ownerRole: 'candidate',
    uploadedBy: userId,
    category: 'resume',
    purpose: 'Resume Upload',
    entityType: 'candidate-profile',
    entityId: new mongoose.Types.ObjectId(),
    originalFileName: fileName,
    displayName: fileName,
    mimeType: 'application/pdf',
    mediaType: 'document',
    sizeBytes: 100,
    checksum: `checksum_${userId}_${Math.random()}`,
    storage: {
      provider: 'memory',
      publicId: `pub_${userId}_${Math.random()}`,
      resourceType: 'raw'
    },
    status: 'active',
    isCurrent: true
  });
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    Job.deleteMany({}),
    ResumeProfile.deleteMany({}),
    ResumeEmbedding.deleteMany({}),
    JobIntelligence.deleteMany({}),
    JobEmbedding.deleteMany({}),
    Application.deleteMany({}),
    CandidateProfile.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({}),
    Document.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Candidate Matching Engine Integration Tests', () => {

  describe('Candidate Job Fit Assessment', () => {
    it('compares resume details and job requirements and returns weighted scores and skill gaps', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const doc = await createMockDocument(candidate.user._id);

      const job = await createMockJob(company._id, recruiter.user._id);

      // Create structures
      const resume = await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc._id,
        personalInfo: { fullName: 'Bob Dev', email: 'bob@example.com' },
        skills: { technical: ['TypeScript', 'Node.js'] },
        metrics: {}
      });

      const intel = await JobIntelligence.create({
        job: job._id,
        company: company._id,
        skills: { required: ['TypeScript', 'Node.js'] }
      });

      // Call API
      const res = await request(app)
        .get(`/api/v1/matching/fit?resumeId=${resume._id}&jobId=${intel._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.match.scores.overallScore).toBeDefined();
      expect(res.body.data.match.skillGap.matchedSkills).toContain('React');
    });

    it('enforces RBAC and blocks candidates from accessing fit evaluations', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .get('/api/v1/matching/fit?resumeId=6a72e6&jobId=6a72e7')
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(403);
    });
  });

  describe('Applicants Ranking', () => {
    it('ranks all candidates for a job and assigns percentiles correctly', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const doc = await createMockDocument(candidate.user._id);

      const job = await createMockJob(company._id, recruiter.user._id);

      const candidateProfile = await CandidateProfile.create({
        user: candidate.user._id
      });

      await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc._id,
        personalInfo: { fullName: 'Bob Dev', email: 'bob@example.com' },
        skills: { technical: ['TypeScript', 'Node.js'] },
        metrics: {}
      });

      await JobIntelligence.create({
        job: job._id,
        company: company._id,
        skills: { required: ['TypeScript', 'Node.js'] }
      });

      await Application.create({
        job: job._id,
        candidate: candidate.user._id,
        candidateProfile: candidateProfile._id,
        company: company._id,
        applicationNumber: 'APP-1001',
        status: 'submitted',
        candidateSnapshot: { fullName: 'Bob Dev' },
        jobSnapshot: { title: 'Backend Engineer' },
        skillMatch: { score: 90, matchedSkills: ['TypeScript'], missingRequiredSkills: [] }
      });

      // Get rankings
      const res = await request(app)
        .get(`/api/v1/matching/rankings/${job._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.rankings.length).toBe(1);
      expect(res.body.data.rankings[0].percentile).toBe(100);
    });
  });

  describe('Semantic Recruiter Search & Similarity Recommendation', () => {
    it('translates natural language queries and extracts candidate fits', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const doc = await createMockDocument(candidate.user._id);

      const profile = await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc._id,
        personalInfo: { fullName: 'Jane AI Programmer', city: 'Kerala' },
        skills: { technical: ['React', 'AWS'] },
        searchTokens: ['Jane', 'React', 'AWS']
      });

      await ResumeEmbedding.create({
        resumeProfile: profile._id,
        version: 1,
        vector: Array.from({ length: 768 }, () => 0.1)
      });

      // Semantic query search
      let res = await request(app)
        .get('/api/v1/matching/search?query=React developer with AWS')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThan(0);

      // Similarity recommendation
      res = await request(app)
        .get(`/api/v1/matching/similar/${profile._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.similar).toBeDefined();
    });
  });

  describe('Background Embeddings Jobs', () => {
    it('executes background embedding vector calculations successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const doc = await createMockDocument(candidate.user._id);

      const profile = await ResumeProfile.create({
        candidate: candidate.user._id,
        document: doc._id,
        personalInfo: { fullName: 'Bob Dev', email: 'bob@example.com' },
        skills: { technical: ['TypeScript', 'Node.js'] },
        metrics: {}
      });

      // Create RESUME_EMBEDDING job
      const job = await BackgroundJob.create({
        type: 'RESUME_EMBEDDING',
        payload: {
          resumeProfileId: profile._id,
          context: { userId: recruiter.user._id, companyId: company._id }
        }
      });

      // Execute job
      await executeJob(job);

      // Verify embedding was created in db
      const embedding = await ResumeEmbedding.findOne({ resumeProfile: profile._id });
      expect(embedding).toBeDefined();
      expect(embedding.vector.length).toBe(768);
    });
  });
});
