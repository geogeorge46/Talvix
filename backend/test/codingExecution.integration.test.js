import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAssignment } from '../src/models/AssessmentAssignment.js';
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
    AssessmentAssignment.init(),
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
    email: `${role}.${sequence}@coding.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `Coding ${sequence}`,
    slug: `coding-${sequence}`,
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

const setupCodingAttempt = async () => {
  const rec = await recruiter();
  const cand = await account('candidate');
  const application = await Application.create({
    candidate: cand.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: rec.job.id,
    company: rec.company.id,
    applicationNumber: `TVX-CODING-${sequence}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: cand.user.fullName },
    jobSnapshot: { title: 'Engineer' },
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
  });

  const question = await Question.create({
    type: 'coding',
    prompt: 'Write a function sum(a, b)',
    difficulty: 'easy',
    defaultMarks: 20,
    coding: {
      languageSupport: ['javascript', 'python'],
      starterCode: { javascript: 'function solution(a, b) { return 0; }' },
      functionName: 'solution',
      testCases: [
        { input: [1, 2], expectedOutput: 3, isHidden: false, weight: 10 },
        { input: [5, 10], expectedOutput: 15, isHidden: true, weight: 10 },
      ],
    },
    company: rec.company.id,
    createdBy: rec.user.id,
  });

  const assessment = await Assessment.create({
    title: 'Coding Assessment',
    type: 'technical',
    durationMinutes: 60,
    passingPercentage: 60,
    totalMarks: 20,
    company: rec.company.id,
    createdBy: rec.user.id,
    status: 'draft',
    questions: [{ question: question.id, marks: 20, order: 1 }],
  });

  await request(app)
    .patch(`/api/v1/assessments/manage/${assessment.id}/publish`)
    .set('Authorization', `Bearer ${rec.token}`)
    .expect(200);

  const assignmentRes = await request(app)
    .post('/api/v1/assessments/assignments')
    .set('Authorization', `Bearer ${rec.token}`)
    .send({
      assessmentId: assessment.id,
      applicationId: application.id,
      availableFrom: new Date(Date.now() - 60000),
      expiresAt: new Date(Date.now() + 3600000),
    });

  const assignmentId = assignmentRes.body.data.assignment._id;

  const startRes = await request(app)
    .post(`/api/v1/assessments/assignments/me/${assignmentId}/start`)
    .set('Authorization', `Bearer ${cand.token}`);

  return {
    rec,
    cand,
    question,
    assessment,
    assignmentId,
    attemptId: startRes.body.data.attempt.id,
  };
};

describe('Phase 2 — Coding Execution Integration Tests', () => {
  it('runs public test cases and returns candidate-safe output', async () => {
    const { cand, attemptId, question } = await setupCodingAttempt();

    const response = await request(app)
      .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/coding/run`)
      .set('Authorization', `Bearer ${cand.token}`)
      .send({
        language: 'javascript',
        sourceCode: 'function solution(a, b) { return a + b; }',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.execution).toBeDefined();
    expect(response.body.data.execution.status).toBe('completed');
    expect(response.body.data.execution.summary.passed).toBe(1);
    expect(response.body.data.execution.summary.total).toBe(1);
    // Ensure hidden test cases were NOT included in public execution
    expect(response.body.data.execution.tests).toHaveLength(1);
  });

  it('submits coding response and grades both public and hidden tests', async () => {
    const { cand, attemptId, question } = await setupCodingAttempt();

    const response = await request(app)
      .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/coding/submit`)
      .set('Authorization', `Bearer ${cand.token}`)
      .send({
        language: 'javascript',
        sourceCode: 'function solution(a, b) { return a === 1 ? 3 : 0; }',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.submission.execution.passedTests).toBe(1);
    expect(response.body.data.submission.execution.totalTests).toBe(2);
    expect(response.body.data.submission.grading.finalScore).toBe(10);

    const storedSub = await TechnicalSubmission.findOne({ attempt: attemptId, question: question.id });
    expect(storedSub).not.toBeNull();
    expect(storedSub.status).toBe('submitted');
    expect(storedSub.sourceCode).toBe('function solution(a, b) { return a === 1 ? 3 : 0; }');
  });

  it('submits coding response with custom execution adapter for 100% pass rate', async () => {
    const { submitCodingQuestion } = await import('../src/services/assessmentAttempt.service.js');
    const { createDeterministicCodeExecutionAdapter } = await import('../src/services/codeExecution.service.js');
    const { cand, attemptId, question } = await setupCodingAttempt();

    const adapter = createDeterministicCodeExecutionAdapter([true, true]);
    const result = await submitCodingQuestion(
      cand.user.id,
      attemptId,
      question.id,
      { language: 'javascript', sourceCode: 'function solution(a, b) { return a + b; }' },
      adapter
    );

    expect(result.execution.passedTests).toBe(2);
    expect(result.execution.totalTests).toBe(2);
    expect(result.grading.finalScore).toBe(20);
  });
});
