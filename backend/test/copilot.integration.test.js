import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { ResumeProfile } from '../src/models/ResumeProfile.js';
import { CopilotConversation } from '../src/models/CopilotConversation.js';
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
    email: `ai.copilot.user.${sequence}@talvix.test`,
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



const createMockDocument = async (userId) => {
  return await Document.create({
    owner: userId,
    ownerRole: 'candidate',
    uploadedBy: userId,
    category: 'resume',
    purpose: 'Resume Upload',
    entityType: 'candidate-profile',
    entityId: new mongoose.Types.ObjectId(),
    originalFileName: 'res.pdf',
    displayName: 'res.pdf',
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
    CopilotConversation.deleteMany({}),
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

describe('AI Recruiter Copilot Integration Tests', () => {

  describe('Conversational Memory & Chat', () => {
    it('creates a new chat session and handles multi-turn intent queries successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      // Create initial message
      let res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ text: 'Find React developers with AWS.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.response).toBeDefined();
      expect(res.body.data.executionPlan.intent).toBe('search_candidates');

      const convId = res.body.data.conversationId;

      // Follow-up question matching memory context
      res = await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ conversationId: convId, text: 'Are any of them located in Kerala?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.conversation.messages.length).toBe(4); // 2 inputs + 2 AI responses
    });

    it('enforces RBAC and blocks candidate user access', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .post('/api/v1/copilot/chat')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ text: 'Who is interview ready?' })
        .expect(403);
    });
  });

  describe('Recruiter Comparisons and Insights', () => {
    it('allows recruiters to request side-by-side matrices and analytics summaries', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const c1 = await createAccount('candidate');
      const d1 = await createMockDocument(c1.user._id);
      const r1 = await ResumeProfile.create({ candidate: c1.user._id, document: d1._id, personalInfo: { fullName: 'Jane Doe' }, skills: { technical: ['React'] } });

      const c2 = await createAccount('candidate');
      const d2 = await createMockDocument(c2.user._id);
      const r2 = await ResumeProfile.create({ candidate: c2.user._id, document: d2._id, personalInfo: { fullName: 'Bob Smith' }, skills: { technical: ['Node.js'] } });

      // Side-by-side compare
      let res = await request(app)
        .post('/api/v1/copilot/compare')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ candidateIds: [r1._id, r2._id] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.matrix.overallWinner).toBeDefined();

      // Retrieve suggested prompts
      res = await request(app)
        .get('/api/v1/copilot/prompts')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.prompts.length).toBeGreaterThan(0);
    });
  });

  describe('Background Summarization Tasks', () => {
    it('executes background copilot tasks via background queue successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const job = await BackgroundJob.create({
        type: 'AI_COPILOT',
        payload: {
          messageText: 'Find React developers.',
          companyId: company._id,
          recruiterId: recruiter.user._id,
          context: { userId: recruiter.user._id }
        }
      });

      // Execute worker job
      await executeJob(job);

      // Verify task completion
      const dbJob = await BackgroundJob.findById(job._id);
      expect(dbJob.status).toBe('completed');
    });
  });
});
