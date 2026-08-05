import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { JobIntelligence } from '../src/models/JobIntelligence.js';
import { JobVersion } from '../src/models/JobVersion.js';
import { JobEmbedding } from '../src/models/JobEmbedding.js';
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
    email: `ai.job.user.${sequence}@talvix.test`,
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
    JobIntelligence.deleteMany({}),
    JobVersion.deleteMany({}),
    JobEmbedding.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Job Intelligence Integration Tests', () => {

  describe('Job Parsing Pipeline & Validation', () => {
    it('allows recruiter to parse job description and triggers background parsing successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Create a Job document
      const jobDoc = await createMockJob(company._id, recruiter.user._id);

      // Recruiter requests parsing
      const res = await request(app)
        .post(`/api/v1/jobs/intelligence/${jobDoc._id}/parse`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id)) // Pass company context header
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.jobId).toBeDefined();

      const bgJob = await BackgroundJob.findById(res.body.data.jobId);
      expect(bgJob.type).toBe('JOB_PARSE');

      // Execute background job
      await executeJob(bgJob);

      // Verify that parsed JobIntelligence was populated
      const intel = await JobIntelligence.findOne({ job: jobDoc._id, company: company._id });
      expect(intel).toBeDefined();
      expect(intel.skills.required).toContain('TypeScript');
      expect(intel.experience.minYears).toBe(3);

      // Verify versioning record
      const version = await JobVersion.findOne({ job: jobDoc._id, version: 1 });
      expect(version).toBeDefined();
    });

    it('blocks candidates from parsing jobs or viewing intelligence details', async () => {
      const candidate = await createAccount('candidate');
      const mockCompanyId = new mongoose.Types.ObjectId();
      const mockUserId = new mongoose.Types.ObjectId();
      const job = await createMockJob(mockCompanyId, mockUserId, 'Developer');

      // Try parsing
      await request(app)
        .post(`/api/v1/jobs/intelligence/${job._id}/parse`)
        .set('Authorization', `Bearer ${candidate.token}`)
        .expect(403);
    });
  });

  describe('Version Comparison & Restorations', () => {
    it('supports listing, comparing, and restoring historical job snapshots', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const job = await createMockJob(company._id, recruiter.user._id, 'Backend Developer');

      await JobIntelligence.create({
        job: job._id,
        company: company._id,
        skills: { required: ['Node.js', 'Redis'] },
        currentVersion: 2
      });

      await JobVersion.create([
        {
          job: job._id,
          version: 1,
          parsedData: { skills: { required: ['Node.js'] }, experience: { minYears: 2 } },
          createdBy: recruiter.user._id
        },
        {
          job: job._id,
          version: 2,
          parsedData: { skills: { required: ['Node.js', 'Redis'] }, experience: { minYears: 4 } },
          createdBy: recruiter.user._id
        }
      ]);

      // List versions
      let res = await request(app)
        .get(`/api/v1/jobs/intelligence/${job._id}/versions`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.data.versions.length).toBe(2);

      // Compare versions
      res = await request(app)
        .get(`/api/v1/jobs/intelligence/${job._id}/compare?v1=1&v2=2`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.data.version1.skills.required).toContain('Node.js');
      expect(res.body.data.version2.skills.required).toContain('Redis');

      // Restore to version 1
      res = await request(app)
        .post(`/api/v1/jobs/intelligence/${job._id}/versions/1/restore`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.data.intelligence.skills.required).not.toContain('Redis');
    });
  });
});
