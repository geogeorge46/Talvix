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
import { JobTemplate } from '../src/models/JobTemplate.js';
import { generateAccessToken } from '../src/utils/jwt.js';

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
  title: 'Lead Architect',
  description: 'Design robust microservices.',
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
const validTemplate = () => ({
  name: 'Go Engineer Template',
  description: 'Reusable backend roles.',
  title: 'Senior Go Developer',
  jobDescription: 'Implement high-performance streaming services.',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{ name: 'Go', required: true, minimumProficiency: 'expert', minimumYearsOfExperience: 4, weight: 100 }],
  minimumExperience: 4,
  maximumExperience: 8,
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Job.init(), CompanyMember.init(), AuditLog.init(), JobTemplate.init()]);
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), CompanyMember.deleteMany({}), AuditLog.deleteMany({}), JobTemplate.deleteMany({})]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Job Templates CRUD operations', () => {
  it('supports creating, listing, getting, updating, and soft-deleting job templates', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Template Labs');

    // 1. Create Template
    const createRes = await auth('post', '/api/v1/jobs/templates', recruiter.token)
      .send(validTemplate())
      .expect(201);
    const templateId = createRes.body.data.template._id;

    // Verify AuditLog for template creation
    const logs = await AuditLog.find({ action: 'template.create' });
    expect(logs).toHaveLength(1);
    expect(String(logs[0].newValue.name)).toBe('Go Engineer Template');

    // 2. Get Template
    const getRes = await auth('get', `/api/v1/jobs/templates/${templateId}`, recruiter.token)
      .expect(200);
    expect(getRes.body.data.template.name).toBe('Go Engineer Template');

    // 3. Update Template
    const updateRes = await auth('patch', `/api/v1/jobs/templates/${templateId}`, recruiter.token)
      .send({ name: 'Updated Go Template' })
      .expect(200);
    expect(updateRes.body.data.template.name).toBe('Updated Go Template');

    // 4. List Templates
    const listRes = await auth('get', '/api/v1/jobs/templates', recruiter.token)
      .expect(200);
    expect(listRes.body.data.templates).toHaveLength(1);
    expect(listRes.body.data.templates[0].name).toBe('Updated Go Template');

    // 5. Delete (soft-delete) Template
    await auth('delete', `/api/v1/jobs/templates/${templateId}`, recruiter.token)
      .expect(200);
    expect(await JobTemplate.countDocuments({ company: company._id, isActive: true })).toBe(0);
  });

  it('permits extracting templates directly from existing job records', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Extractor Labs');

    // Create seed job
    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    // Extract template from job
    const res = await auth('post', `/api/v1/jobs/templates/from-job/${jobId}`, recruiter.token)
      .send({ templateName: 'Staff Go Template' })
      .expect(201);

    expect(res.body.data.template.name).toBe('Staff Go Template');
    expect(res.body.data.template.title).toBe('Lead Architect');
    expect(res.body.data.template.jobDescription).toBe('Design robust microservices.');
    expect(res.body.data.template.skills[0].name).toBe('Go');
  });
});

describe('Job Auto-Publish Settings', () => {
  it('instantly publishes a job submission if autoApproveJobs is enabled on the company', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator, 'Auto Labs');

    // Turn auto-approval on
    await Company.updateOne({ _id: company._id }, { autoApproveJobs: true });

    // Create a job draft
    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    // Submit the job
    const submitRes = await auth('patch', `/api/v1/jobs/manage/${jobId}/submit`, recruiter.token)
      .expect(200);

    // Verify it bypassed pending review and was immediately published!
    expect(submitRes.body.data.job.status).toBe('published');
    expect(submitRes.body.data.job.publishedAt).toBeDefined();

    // Verify audit log for job approval exists
    const approvalLogs = await AuditLog.find({ action: 'job.approve' });
    expect(approvalLogs).toHaveLength(1);
    expect(approvalLogs[0].newValue.autoApproved).toBe(true);
  });
});
