import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { Question } from '../src/models/Question.js';
import { TechnicalSubmission } from '../src/models/TechnicalSubmission.js';
import { Company } from '../src/models/Company.js';
import { User } from '../src/models/User.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Job } from '../src/models/Job.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review'];

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    RecruiterProfile.init(),
    Company.init(),
    Application.init(),
    Question.init(),
    Assessment.init(),
    AssessmentAttempt.init(),
    TechnicalSubmission.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@assessment.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `Assessment ${sequence}`,
    slug: `assessment-${sequence}`,
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
  const job = await Job.create({
    company: company.id,
    createdBy: owner.user.id,
    title: 'Engineer',
    slug: `eng-${sequence}`,
    description: 'desc',
    employmentType: 'full-time',
    workMode: 'remote',
    openings: 1,
    applicationDeadline: new Date(Date.now() + 86400000),
    status: 'published',
  });
  return { ...owner, company, job };
};

const candidate = async () => account('candidate');

const applicationFor = async (owner, cand) =>
  Application.create({
    candidate: cand.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: owner.job.id,
    company: owner.company.id,
    applicationNumber: `TVX-ASSESS-${sequence}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: cand.user.fullName },
    jobSnapshot: { title: 'Engineer' },
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
  });

const api = (method, url, token) => {
  const req = request(app)[method](url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const choiceBody = () => ({
  type: 'coding',
  title: 'Two Sum Technical Task',
  prompt: 'Write a function twoSum(nums, target)',
  difficulty: 'medium',
  defaultMarks: 25,
  coding: {
    languageSupport: ['javascript', 'python'],
    starterCode: { javascript: 'function twoSum(nums, target) {}' },
    functionName: 'twoSum',
    testCases: [{ input: '[2, 7], 9', expectedOutput: '[0, 1]', weight: 1, isHidden: false }],
  },
});

describe('Technical Assessment Workspace (Phase 1)', () => {
  it('allows candidate to save, retrieve, and submit technical draft while enforcing authorization', async () => {
    const rec = await recruiter();
    const cand1 = await candidate();
    const cand2 = await candidate();

    // 1. Recruiter creates a coding question and publishes an assessment
    const qRes = await api('post', '/api/v1/assessments/questions', rec.token).send(choiceBody()).expect(201);
    const questionId = qRes.body.data.question._id;

    const asmRes = await api('post', '/api/v1/assessments', rec.token)
      .send({ title: 'Full Stack Coding Test', type: 'coding', durationMinutes: 60, passingPercentage: 70 })
      .expect(201);
    const assessmentId = asmRes.body.data.assessment._id;

    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, rec.token)
      .send({ questionId, marks: 25 })
      .expect(200);

    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, rec.token).expect(200);

    // 2. Assign assessment to Candidate 1 and Candidate 2
    const app1 = await applicationFor(rec, cand1);
    const app2 = await applicationFor(rec, cand2);

    const assignRes1 = await api('post', '/api/v1/assessments/assignments', rec.token)
      .send({
        assessmentId,
        applicationId: app1.id,
        availableFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
      })
      .expect(201);

    const assignRes2 = await api('post', '/api/v1/assessments/assignments', rec.token)
      .send({
        assessmentId,
        applicationId: app2.id,
        availableFrom: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 3600000),
      })
      .expect(201);

    // Start attempt for Candidate 1
    const startRes1 = await api(
      'post',
      `/api/v1/assessments/assignments/me/${assignRes1.body.data.assignment._id}/start`,
      cand1.token
    ).expect(201);
    const attemptId1 = startRes1.body.data.attempt.id;

    // Start attempt for Candidate 2
    const startRes2 = await api(
      'post',
      `/api/v1/assessments/assignments/me/${assignRes2.body.data.assignment._id}/start`,
      cand2.token
    ).expect(201);
    const attemptId2 = startRes2.body.data.attempt.id;

    // 3. Candidate 1 saves a technical draft
    await api(
      'put',
      `/api/v1/assessments/attempts/me/${attemptId1}/questions/${questionId}/technical/draft`,
      cand1.token
    )
      .send({
        type: 'coding',
        language: 'javascript',
        sourceCode: 'function twoSum(nums, target) { return [0, 1]; }',
      })
      .expect(200);

    // Verify technical submission in DB
    const sub = await TechnicalSubmission.findOne({ attempt: attemptId1, question: questionId });
    expect(sub).not.toBeNull();
    expect(sub?.sourceCode).toBe('function twoSum(nums, target) { return [0, 1]; }');
    expect(sub?.status).toBe('draft');

    // 4. Candidate 1 retrieves draft
    const getRes = await api(
      'get',
      `/api/v1/assessments/attempts/me/${attemptId1}/questions/${questionId}/technical`,
      cand1.token
    ).expect(200);
    expect(getRes.body.data.draft.sourceCode).toBe('function twoSum(nums, target) { return [0, 1]; }');

    // 5. Candidate 2 CANNOT access Candidate 1's draft
    await api(
      'get',
      `/api/v1/assessments/attempts/me/${attemptId1}/questions/${questionId}/technical`,
      cand2.token
    ).expect(404);

    await api(
      'put',
      `/api/v1/assessments/attempts/me/${attemptId1}/questions/${questionId}/technical/draft`,
      cand2.token
    )
      .send({ type: 'coding', sourceCode: 'hacked' })
      .expect(404);

    // 6. Expiry enforcement: Candidate 1 cannot save draft after attempt expires
    await AssessmentAttempt.findByIdAndUpdate(attemptId1, { expiresAt: new Date(Date.now() - 1000) });

    await api(
      'put',
      `/api/v1/assessments/attempts/me/${attemptId1}/questions/${questionId}/technical/draft`,
      cand1.token
    )
      .send({ type: 'coding', sourceCode: 'late' })
      .expect(409);
  });
});
