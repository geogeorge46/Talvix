import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { AnalyticsSnapshot } from '../src/models/AnalyticsSnapshot.js';
import { ExecutiveReport } from '../src/models/ExecutiveReport.js';
import { AIUsageLog } from '../src/models/AIUsageLog.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Job } from '../src/models/Job.js';
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
    AnalyticsSnapshot.deleteMany({}),
    ExecutiveReport.deleteMany({}),
    AIUsageLog.deleteMany({}),
    Application.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Analytics & Executive Decision Integration Tests', () => {

  describe('Dashboard Analytics Snapshot', () => {
    it('aggregates applications funnel metrics and cost records successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const candidateProfile = await CandidateProfile.create({ user: candidate.user._id });
      const job = await Job.create({
        company: company._id,
        createdBy: recruiter.user._id,
        title: 'Developer',
        slug: 'developer-1',
        description: 'React developer',
        employmentType: 'full-time',
        workMode: 'onsite',
        status: 'published'
      });

      // Create a mock application
      await Application.create({
        job: job._id,
        candidate: candidate.user._id,
        candidateProfile: candidateProfile._id,
        company: company._id,
        applicationNumber: 'APP-8001',
        status: 'submitted',
        candidateSnapshot: { fullName: 'Bob Dev' },
        jobSnapshot: { title: 'Developer' },
        skillMatch: { score: 90, matchedSkills: ['React'], missingRequiredSkills: [] }
      });

      // Seed mock AI cost usage
      await AIUsageLog.create({
        company: company._id,
        providerName: 'google',
        modelName: 'gemini-1.5-pro',
        tokensInput: 1000,
        tokensOutput: 500,
        cost: 0.15,
        status: 'success'
      });

      const res = await request(app)
        .get('/api/v1/intelligence/analytics/dashboard')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.snapshot.funnel.applied).toBe(1);
      expect(res.body.data.snapshot.aiSpending.totalCostUSD).toBe(0.15);
    });

    it('enforces RBAC and blocks candidate user accessing dashboards', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .get('/api/v1/intelligence/analytics/dashboard')
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(403);
    });
  });

  describe('Executive Report Compiler', () => {
    it('creates weekly or monthly AI insights reports successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Create a snapshot first
      await AnalyticsSnapshot.create({
        company: company._id,
        snapshotDate: new Date(),
        funnel: { applied: 10, hired: 2 },
        metrics: { timeToHireDays: 20 },
        aiSpending: { totalCostUSD: 1.50 }
      });

      const res = await request(app)
        .post('/api/v1/intelligence/analytics/reports/generate')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ reportType: 'monthly' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.report.forecasts.predictedHiringDemand).toBe(15);
      expect(res.body.data.report.recommendations[0]).toContain('Shorten React assessments');
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background refresh and report queue workers successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const job = await BackgroundJob.create({
        type: 'DASHBOARD_REFRESH',
        payload: {
          companyId: company._id,
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
