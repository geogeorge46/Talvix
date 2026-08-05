import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Conversation } from '../src/models/Conversation.js';
import { Message } from '../src/models/Message.js';
import { InterviewRoom } from '../src/models/InterviewRoom.js';
import { InterviewDiscussion } from '../src/models/InterviewDiscussion.js';
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
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    InterviewRoom.deleteMany({}),
    InterviewDiscussion.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Communication & Interview Collaboration Integration Tests', () => {

  describe('Real-time Messaging APIs', () => {
    it('creates a new conversation and logs messages successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);
      const candidate = await createAccount('candidate');

      // Create conversation
      const convRes = await request(app)
        .post('/api/v1/collaboration/chat/conversations')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ participants: [candidate.user._id] })
        .expect(201);

      expect(convRes.body.success).toBe(true);
      const convId = convRes.body.data.conversation._id;

      // Post message
      const msgRes = await request(app)
        .post('/api/v1/collaboration/chat/messages')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ conversationId: convId, text: 'Hello Candidate' })
        .expect(201);

      expect(msgRes.body.success).toBe(true);
      expect(msgRes.body.data.message.text).toBe('Hello Candidate');
    });
  });

  describe('Interview Discussion Notes', () => {
    it('posts shared and private interviewer evaluation comments successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const interviewScheduleId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/api/v1/collaboration/interviews/notes')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({
          interviewScheduleId,
          text: 'Jane demonstrated excellent algorithmic skills.',
          rating: 5,
          isPrivate: false
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.discussion.notes[0].text).toBe('Jane demonstrated excellent algorithmic skills.');
    });
  });

  describe('AI meeting summaries API', () => {
    it('summarizes chat logs and creates recommendations logs successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const res = await request(app)
        .post('/api/v1/collaboration/interviews/summary')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ chatLogs: 'Recruiter: Hi. Candidate: Hi. I have 5 years React experience.' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.highlights[0]).toContain('React Hooks');
    });
  });

  describe('Background Workers Scans', () => {
    it('runs background chat summary workers successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const job = await BackgroundJob.create({
        type: 'CHAT_SUMMARY',
        payload: {
          chatLogs: 'Jane worked at Google. Jane built system.',
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
