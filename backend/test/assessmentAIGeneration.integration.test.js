import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { Question } from '../src/models/Question.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@ai-intel.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `AI Intel Co ${sequence}`,
    slug: `ai-intel-co-${sequence}`,
    owner: owner.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [{ recruiter: owner.user.id, role: 'owner', permissions, status: 'active' }],
  });
  await RecruiterProfile.create({
    user: owner.user.id,
    company: company.id,
    isApproved: true,
    isCompanyOwner: true,
    permissions,
  });
  return { ...owner, company };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((col) => col.deleteMany({})),
  );
});

describe('AI Assessment & Question Bank Intelligence Integration', () => {
  it('rejects invalid generate-questions payload', async () => {
    const owner = await recruiter();
    const res = await api('post', '/api/v1/assessments/intelligence/generate-questions', owner.token)
      .send({ topic: 'A', count: 50 }); // too short topic, too large count

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('generates domain-aware questions directly into the Question Bank with categories', async () => {
    const owner = await recruiter();
    const res = await api('post', '/api/v1/assessments/intelligence/generate-questions', owner.token)
      .send({
        topic: 'React Performance & Concurrent Mode',
        skills: ['React', 'JavaScript', 'State Management'],
        difficulty: 'medium',
        type: 'mixed',
        count: 3,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questions).toHaveLength(3);

    const questions = res.body.data.questions;
    expect(questions[0].category).toBe('Frontend');
    expect(questions[0].company.toString()).toBe(owner.company.id.toString());
    expect(questions[0].difficulty).toBe('medium');

    // Verify stored in DB
    const countInDb = await Question.countDocuments({ company: owner.company.id });
    expect(countInDb).toBe(3);

    // Verify coding question structure
    const codingQ = questions.find((q) => q.type === 'coding');
    expect(codingQ).toBeDefined();
    expect(codingQ.coding).toBeDefined();
    expect(codingQ.coding.testCases.length).toBeGreaterThan(0);
  });

  it('generates database specific questions and attaches them to an assessment', async () => {
    const owner = await recruiter();
    // 1. Generate questions
    const genRes = await api('post', '/api/v1/assessments/intelligence/generate-questions', owner.token)
      .send({
        topic: 'PostgreSQL Indexing & Optimization',
        skills: ['PostgreSQL', 'SQL', 'B-Tree'],
        difficulty: 'hard',
        type: 'mixed',
        count: 2,
      });

    expect(genRes.status).toBe(201);
    const createdQuestions = genRes.body.data.questions;
    expect(createdQuestions[0].category).toBe('Database');

    // 2. Create assessment draft
    const createRes = await api('post', '/api/v1/assessments', owner.token).send({
      title: 'Database Architecture Exam',
      description: 'Testing PostgreSQL expertise',
      type: 'technical',
      durationMinutes: 45,
      passingPercentage: 70,
    });
    expect(createRes.status).toBe(201);
    const assessmentId = createRes.body.data.assessment._id;

    // 3. Attach generated question to assessment
    const addRes = await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, owner.token).send({
      questionId: createdQuestions[0]._id,
      marks: createdQuestions[0].defaultMarks,
    });
    expect(addRes.status).toBe(200);
    expect(addRes.body.data.assessment.questions[0].question.toString()).toBe(createdQuestions[0]._id.toString());
    const storedQuestion = await Question.findById(createdQuestions[0]._id);
    expect(storedQuestion.category).toBe('Database');
  });

  it('creates full assessment blueprint with category tags via generateAIAssessment', async () => {
    const owner = await recruiter();
    const res = await api('post', '/api/v1/assessments/intelligence/generate', owner.token)
      .send({
        jobDescription: 'Senior Fullstack Developer with React, Node.js, and PostgreSQL expertise',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const assessment = res.body.data.assessment;
    expect(assessment.title).toContain('AI Generated Assessment');
    expect(assessment.questions.length).toBeGreaterThan(0);
    expect(assessment.questions[0].question.category).toBeDefined();
  });
});
