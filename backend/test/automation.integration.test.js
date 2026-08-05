import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Workflow } from '../src/models/Workflow.js';
import { WorkflowVersion } from '../src/models/WorkflowVersion.js';
import { WorkflowExecution } from '../src/models/WorkflowExecution.js';
import { WorkflowNodeExecution } from '../src/models/WorkflowNodeExecution.js';
import { AgentMemory } from '../src/models/AgentMemory.js';
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
    Workflow.deleteMany({}),
    WorkflowVersion.deleteMany({}),
    WorkflowExecution.deleteMany({}),
    WorkflowNodeExecution.deleteMany({}),
    AgentMemory.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Recruiting Automation & Autonomous Agents Integration Tests', () => {

  describe('Workflow Builder APIs', () => {
    it('creates, publishes, and triggers custom workflow templates successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Create workflow
      const wfRes = await request(app)
        .post('/api/v1/automation/workflows')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          name: 'Tech Screening Workflow',
          trigger: 'Resume Uploaded',
          nodes: [{ id: 'node-1', type: 'action', label: 'Parse' }],
          edges: []
        })
        .expect(201);

      expect(wfRes.body.success).toBe(true);
      const wfId = wfRes.body.data.workflow._id;

      // Publish workflow
      const pubRes = await request(app)
        .post(`/api/v1/automation/workflows/${wfId}/publish`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(pubRes.body.success).toBe(true);
      expect(pubRes.body.data.workflow.published).toBe(true);

      // Run execution
      const runRes = await request(app)
        .post(`/api/v1/automation/workflows/${wfId}/run`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ payload: { resumeUrl: 's3://resume.pdf' } })
        .expect(200);

      expect(runRes.body.success).toBe(true);
      expect(runRes.body.data.execution.status).toBe('completed');
    });

    it('enforces RBAC and blocks candidate workflow configurations', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .post('/api/v1/automation/workflows')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ name: 'Wf' })
        .expect(403);
    });
  });

  describe('Autonomous Recruiting Agents', () => {
    it('invokes autonomous recruiter agents and commits actions context memory successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const res = await request(app)
        .post('/api/v1/automation/agents/recruiter')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ instruction: 'Analyze recent junior applicants React scorecards.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.result.decision).toContain('Shortlist Candidate');

      // Verify memory is saved
      const memory = await AgentMemory.findOne({ company: company._id, recruiter: recruiter.user._id });
      expect(memory.recentActions[0]).toContain('Shortlist Candidate');
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background workflow execution workers successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const workflow = await Workflow.create({
        company: company._id,
        name: 'Auto-Screen',
        trigger: 'Candidate Applied',
        nodes: [{ id: 'n1', type: 'action', label: 'Screen' }],
        createdBy: recruiter.user._id
      });

      const job = await BackgroundJob.create({
        type: 'WORKFLOW_EXECUTION',
        payload: {
          workflowId: workflow._id,
          trigger: 'Candidate Applied',
          payload: { id: 1 },
          companyId: company._id,
          userId: recruiter.user._id
        }
      });

      // Execute worker job
      await executeJob(job);

      const dbJob = await BackgroundJob.findById(job._id);
      expect(dbJob.status).toBe('completed');
    });
  });
});
