import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';

let replicaSet;
let sequence = 0;
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const register = async (role = 'recruiter') => {
  sequence += 1;
  const response = await request(app).post('/api/v1/auth/register').send({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@business.test`, password: 'Strong!Pass123', role }).expect(201);
  return { user: response.body.data.user, token: response.body.data.accessToken };
};
const admin = async () => {
  sequence += 1;
  const user = await User.create({ fullName: 'Admin User', email: `admin.${sequence}@business.test`, password: 'Strong!Pass123', role: 'admin' });
  return { user, token: generateAccessToken(user.id) };
};
const approve = async (recruiter, adminAccount) => {
  const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
  await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, adminAccount.token).send({}).expect(200);
  return profile;
};
const createVerifiedCompany = async (recruiter, adminAccount, name = 'Talvix Labs') => {
  await approve(recruiter, adminAccount);
  const created = await auth('post', '/api/v1/companies', recruiter.token).send({ name, industry: 'Technology', companySize: '11-50' }).expect(201);
  await auth('patch', `/api/v1/companies/admin/${created.body.data.company._id}/verify`, adminAccount.token).send({ notes: 'Documents verified' }).expect(200);
  const updatedUser = await User.findById(recruiter.user._id);
  recruiter.token = generateAccessToken(updatedUser.id, [updatedUser.role], updatedUser.tokenVersion);
  return created.body.data.company;
};
const validJob = () => ({
  title: 'Staff Architect',
  description: 'Design robust Monolith services.',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{ name: 'Go', required: true, minimumProficiency: 'expert', minimumYearsOfExperience: 5, weight: 100 }],
  salary: { minimum: 150000, maximum: 200000, currency: 'USD', period: 'yearly', isVisible: true },
  minimumExperience: 6,
  maximumExperience: 12,
  openings: 1,
  applicationQuestions: [{ question: 'Provide your GitHub portfolio link', type: 'text', required: true }],
  applicationDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString()
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Job.init(), CompanyMember.init(), AuditLog.init(), BackgroundJob.init()]);
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), CompanyMember.deleteMany({}), AuditLog.deleteMany({}), BackgroundJob.deleteMany({})]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Job Scheduled Publishing Flow', () => {
  it('correctly saves and stores a future scheduledPublishAt date parameter', async () => {
    const administrator = await admin();
    const recruiter = await register();
    await createVerifiedCompany(recruiter, administrator, 'Publishing Labs');

    const scheduledDate = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const payload = {
      ...validJob(),
      scheduledPublishAt: scheduledDate
    };

    const res = await auth('post', '/api/v1/jobs', recruiter.token).send(payload).expect(201);
    const createdJob = await Job.findById(res.body.data.job._id);

    expect(createdJob.scheduledPublishAt).toBeDefined();
    expect(new Date(createdJob.scheduledPublishAt).getTime()).toBe(new Date(scheduledDate).getTime());
  });

  it('automatically publishes scheduled jobs if autoApproveJobs is enabled', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Auto Publish Labs');

    // Enable autoApproveJobs
    await Company.updateOne({ _id: company._id }, { autoApproveJobs: true });

    // Create a job scheduled in the past (so it is ready to process now)
    const pastDate = new Date(Date.now() - 60_000);
    const job = await Job.create({
      ...validJob(),
      company: company._id,
      createdBy: recruiter.user._id,
      slug: 'scheduled-past-auto',
      status: 'draft',
      scheduledPublishAt: pastDate
    });

    // Create background job record to trigger executeJob
    const backgroundJob = await BackgroundJob.create({
      type: 'PUBLISH_JOBS',
      priority: 'MEDIUM',
      status: 'pending',
      runAt: pastDate
    });

    // Run task execution
    await executeJob(backgroundJob);

    // Verify job status is now published
    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.status).toBe('published');
    expect(updatedJob.publishedAt).toBeDefined();
    expect(updatedJob.scheduledPublishAt).toBeNull();

    // Verify approval AuditLog is created
    const log = await AuditLog.findOne({ action: 'job.approve', company: company._id });
    expect(log).toBeDefined();
    expect(log.newValue.autoApproved).toBe(true);
    expect(log.newValue.scheduledPublish).toBe(true);
  });

  it('submits scheduled jobs for review if autoApproveJobs is disabled', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Manual Publish Labs');

    // Create a job scheduled in the past
    const pastDate = new Date(Date.now() - 60_000);
    const job = await Job.create({
      ...validJob(),
      company: company._id,
      createdBy: recruiter.user._id,
      slug: 'scheduled-past-manual',
      status: 'draft',
      scheduledPublishAt: pastDate
    });

    // Create background job record
    const backgroundJob = await BackgroundJob.create({
      type: 'PUBLISH_JOBS',
      priority: 'MEDIUM',
      status: 'pending',
      runAt: pastDate
    });

    // Run execution
    await executeJob(backgroundJob);

    // Verify job transitioned to pending-review instead of published!
    const updatedJob = await Job.findById(job._id);
    expect(updatedJob.status).toBe('pending-review');
    expect(updatedJob.scheduledPublishAt).toBeNull();

    // Verify submit AuditLog is created
    const log = await AuditLog.findOne({ action: 'job.submit', company: company._id });
    expect(log).toBeDefined();
    expect(log.newValue.scheduledPublish).toBe(true);
  });
});
