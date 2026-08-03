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
import { queueJob, processNextJobs } from '../src/services/backgroundJobs.service.js';

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
const validJob = (offsetDays = 7) => ({
  title: 'Backend Engineer',
  description: 'Build reliable recruitment services.',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{ name: 'Node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 3, weight: 80 }],
  salary: { minimum: 80000, maximum: 120000, currency: 'USD', period: 'yearly', isVisible: false },
  minimumExperience: 2,
  maximumExperience: 6,
  openings: 2,
  applicationDeadline: new Date(Date.now() + offsetDays * 86_400_000).toISOString()
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

describe('Job Management Phase 1 Audit Logs', () => {
  it('records audit log entries for recruiter job workflow actions', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Audit Labs');

    // 1. Create Job (Draft)
    const draftResponse = await auth('post', '/api/v1/jobs', recruiter.token)
      .send(validJob())
      .expect(201);
    const jobId = draftResponse.body.data.job._id;

    const createLogs = await AuditLog.find({ action: 'job.create' });
    expect(createLogs).toHaveLength(1);
    expect(String(createLogs[0].actor)).toBe(String(recruiter.user._id));
    expect(String(createLogs[0].company)).toBe(String(company._id));
    expect(createLogs[0].newValue.title).toBe('Backend Engineer');

    // 2. Update Job
    await auth('patch', `/api/v1/jobs/manage/${jobId}`, recruiter.token)
      .send({ title: 'Lead Backend Engineer' })
      .expect(200);

    const updateLogs = await AuditLog.find({ action: 'job.update' });
    expect(updateLogs).toHaveLength(1);
    expect(String(updateLogs[0].actor)).toBe(String(recruiter.user._id));
    expect(updateLogs[0].oldValue.title).toBe('Backend Engineer');
    expect(updateLogs[0].newValue.title).toBe('Lead Backend Engineer');

    // 3. Submit Job
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(200);
    const submitLogs = await AuditLog.find({ action: 'job.submit' });
    expect(submitLogs).toHaveLength(1);
    expect(submitLogs[0].newValue.status).toBe('pending-review');

    // Approve the job so we can pause/resume/close it
    await auth('patch', `/api/v1/jobs/admin/${jobId}/approve`, administrator.token).expect(200);

    // 4. Pause Job
    await auth('patch', `/api/v1/jobs/manage/${jobId}/pause`, recruiter.token).expect(200);
    const pauseLogs = await AuditLog.find({ action: 'job.pause' });
    expect(pauseLogs).toHaveLength(1);
    expect(pauseLogs[0].newValue.status).toBe('paused');

    // 5. Resume Job
    await auth('patch', `/api/v1/jobs/manage/${jobId}/resume`, recruiter.token).expect(200);
    const resumeLogs = await AuditLog.find({ action: 'job.resume' });
    expect(resumeLogs).toHaveLength(1);
    expect(resumeLogs[0].newValue.status).toBe('published');

    // 6. Close Job
    await auth('patch', `/api/v1/jobs/manage/${jobId}/close`, recruiter.token).expect(200);
    const closeLogs = await AuditLog.find({ action: 'job.close' });
    expect(closeLogs).toHaveLength(1);
    expect(closeLogs[0].newValue.status).toBe('closed');

    // 7. Archive Job
    await auth('delete', `/api/v1/jobs/manage/${jobId}`, recruiter.token).expect(200);
    const archiveLogs = await AuditLog.find({ action: 'job.archive' });
    expect(archiveLogs).toHaveLength(1);
    expect(archiveLogs[0].newValue.status).toBe('archived');
  });

  it('records audit log entries for admin review actions', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Admin Audit Labs');

    // Create and submit job
    const draftResponse = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = draftResponse.body.data.job._id;
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(200);

    // 1. Admin Reject Job
    await auth('patch', `/api/v1/jobs/admin/${jobId}/reject`, administrator.token)
      .send({ reason: 'Incorrect description formatting.' })
      .expect(200);

    const rejectLogs = await AuditLog.find({ action: 'job.reject' });
    expect(rejectLogs).toHaveLength(1);
    expect(String(rejectLogs[0].actor)).toBe(String(administrator.user._id));
    expect(rejectLogs[0].newValue.status).toBe('rejected');
    expect(rejectLogs[0].newValue.rejectionReason).toBe('Incorrect description formatting.');

    // Edit and submit again
    await auth('patch', `/api/v1/jobs/manage/${jobId}`, recruiter.token).send({ title: 'Fixed Backend Engineer' }).expect(200);
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(200);

    // 2. Admin Approve Job
    await auth('patch', `/api/v1/jobs/admin/${jobId}/approve`, administrator.token).expect(200);
    const approveLogs = await AuditLog.find({ action: 'job.approve' });
    expect(approveLogs).toHaveLength(1);
    expect(String(approveLogs[0].actor)).toBe(String(administrator.user._id));
    expect(approveLogs[0].newValue.status).toBe('published');

    // 3. Admin Feature Job
    await auth('patch', `/api/v1/jobs/admin/${jobId}/feature`, administrator.token).expect(200);
    const featureLogs = await AuditLog.find({ action: 'job.feature' });
    expect(featureLogs).toHaveLength(1);
    expect(String(featureLogs[0].actor)).toBe(String(administrator.user._id));
    expect(featureLogs[0].newValue.isFeatured).toBe(true);
  });
});

describe('Job Expiration Background Job', () => {
  it('correctly transitions expired jobs to closed and logs system events', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Expiration Labs');

    // Create a job draft (with future deadline to pass Zod route check)
    const draftResponse = await auth('post', '/api/v1/jobs', recruiter.token)
      .send(validJob())
      .expect(201);
    const jobId = draftResponse.body.data.job._id;

    // Submit and approve it to make it published
    await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token).expect(200);
    await auth('patch', `/api/v1/jobs/admin/${jobId}/approve`, administrator.token).expect(200);

    // Directly set applicationDeadline to the past in the database
    await Job.updateOne({ _id: jobId }, { applicationDeadline: new Date(Date.now() - 3600 * 1000) });

    // Queue and run the EXPIRE_JOBS background job
    const bgJob = await queueJob({ type: 'EXPIRE_JOBS', priority: 'MEDIUM' });
    await processNextJobs();

    // Verify job transitioned to closed
    const expiredJob = await Job.findById(jobId);
    expect(expiredJob.status).toBe('closed');
    expect(expiredJob.closedAt).toBeDefined();

    // Verify system action audit log was generated
    const systemLogs = await AuditLog.find({ action: 'job.close', actor: recruiter.user._id });
    expect(systemLogs).toHaveLength(1);
    expect(systemLogs[0].newValue.systemExpired).toBe(true);
    expect(systemLogs[0].newValue.status).toBe('closed');
  });
});
