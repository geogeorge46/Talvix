import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { ResumeReview } from '../src/models/ResumeReview.js';
import { ResumeFraudReport } from '../src/models/ResumeFraudReport.js';
import { CandidateIntelligence } from '../src/models/CandidateIntelligence.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} AI User ${sequence}`,
    email: `ai.test.user.${sequence}@talvix.test`,
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

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    ResumeReview.deleteMany({}),
    ResumeFraudReport.deleteMany({}),
    CandidateIntelligence.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Resume Review & Fraud Detection Integration Tests', () => {

  describe('Resume Review API', () => {
    it('creates a detailed resume quality audit checklist successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);
      const candidate = await createAccount('candidate');

      const res = await request(app)
        .post('/api/v1/resume/review')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          resumeContent: 'Senior Software developer. AWS and Node.',
          candidateId: String(candidate.user._id)
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.report.atsScore).toBe(85);
      expect(res.body.data.report.grammarScore).toBe(90);
    });

    it('enforces RBAC and blocks candidate user accessing reviews', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .post('/api/v1/resume/review')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ resumeContent: 'React developer', candidateId: String(candidate.user._id) })
        .expect(403);
    });
  });

  describe('Fraud Detection API', () => {
    it('scans candidate resume details and identifies inconsistencies successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);
      const candidate = await createAccount('candidate');

      const res = await request(app)
        .post('/api/v1/resume/fraud-check')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          resumeContent: 'Worked at Google from 2020 to 2018.',
          candidateId: String(candidate.user._id)
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.report.riskLevel).toBe('low');
      expect(res.body.data.report.aiProbability).toBe(8);
    });
  });

  describe('Candidate Intelligence API', () => {
    it('fetches candidate scorecard metrics successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);
      const candidate = await createAccount('candidate');

      // Create a mock intelligence report
      await CandidateIntelligence.create({
        company: company._id,
        candidate: candidate.user._id,
        technicalScore: 88,
        communicationScore: 82,
        assessmentScore: 90,
        resumeScore: 85,
        interviewScore: 80,
        cultureFit: 85,
        learningSpeed: 90,
        overallCandidateRating: 86,
        hiringReadiness: 'ready',
        hiringRecommendation: 'hire',
        createdBy: recruiter.user._id
      });

      const res = await request(app)
        .get(`/api/v1/resume/intelligence/${candidate.user._id}`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.report.technicalScore).toBe(88);
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background queue task integrations successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);
      const candidate = await createAccount('candidate');

      const job = await BackgroundJob.create({
        type: 'RESUME_REVIEW',
        payload: {
          resumeContent: 'Junior Developer resume text.',
          companyId: company._id,
          candidateId: candidate.user._id,
          userId: recruiter.user._id,
          context: { userId: recruiter.user._id }
        }
      });

      // Execute worker job
      await executeJob(job);

      const dbJob = await BackgroundJob.findById(job._id);
      expect(dbJob.status).toBe('completed');
    });
  });
});
