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
import { AIEvaluation } from '../src/models/AIEvaluation.js';
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
    AIEvaluation.init(),
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
    email: `${role}.${sequence}@ai.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `AI Company ${sequence}`,
    slug: `ai-${sequence}`,
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
    title: 'AI Engineer',
    slug: `ai-eng-${sequence}`,
    description: 'desc',
    employmentType: 'full-time',
    workMode: 'remote',
    openings: 1,
    applicationDeadline: new Date(Date.now() + 86400000),
    status: 'published',
  });
  return { ...owner, company, job };
};

const setupPhase6Attempt = async () => {
  const rec = await recruiter();
  const cand = await account('candidate');
  const application = await Application.create({
    candidate: cand.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: rec.job.id,
    company: rec.company.id,
    applicationNumber: `TVX-AI-${sequence}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: cand.user.fullName },
    jobSnapshot: { title: 'AI Engineer' },
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
  });

  const question = await Question.create({
    type: 'coding',
    prompt: 'Implement a binary search function',
    difficulty: 'medium',
    defaultMarks: 25,
    coding: {
      languageSupport: ['javascript'],
      starterCode: { javascript: 'function binarySearch(arr, target) {}' },
      functionName: 'binarySearch',
      testCases: [{ input: [[1, 2, 3, 4], 3], expectedOutput: 2, isHidden: false, weight: 25 }],
    },
    company: rec.company.id,
    createdBy: rec.user.id,
  });

  const assessment = await Assessment.create({
    title: 'Phase 6 AI Technical Assessment',
    type: 'technical',
    durationMinutes: 60,
    passingPercentage: 60,
    totalMarks: 25,
    company: rec.company.id,
    createdBy: rec.user.id,
    status: 'draft',
    questions: [{ question: question.id, marks: 25, order: 1 }],
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

  const attemptId = startRes.body.data.attempt.id;

  // Submit candidate code response
  await request(app)
    .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/coding/submit`)
    .set('Authorization', `Bearer ${cand.token}`)
    .send({
      language: 'javascript',
      sourceCode: 'function binarySearch(arr, target) { let l=0, r=arr.length-1; while(l<=r) { let m=Math.floor((l+r)/2); if(arr[m]===target) return m; if(arr[m]<target) l=m+1; else r=m-1; } return -1; }',
    });

  return {
    rec,
    cand,
    question,
    assessment,
    assignmentId,
    attemptId,
  };
};

describe('Phase 6 — AI Technical Evaluation Integration Tests', () => {
  it('triggers AI technical evaluation for recruiter', async () => {
    const { rec, attemptId, question } = await setupPhase6Attempt();

    const response = await request(app)
      .post(`/api/v1/assessments/reviews/${attemptId}/questions/${question.id}/ai-evaluate`)
      .set('Authorization', `Bearer ${rec.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.evaluation.strengths).toBeDefined();
    expect(response.body.data.evaluation.codeQuality.readability).toBeGreaterThanOrEqual(8);

    const storedEval = await AIEvaluation.findOne({ attempt: attemptId, question: question.id });
    expect(storedEval).not.toBeNull();
    expect(storedEval.recruiterInsight).toBeDefined();
  });

  it('retrieves recruiter AI summary with private insights', async () => {
    const { rec, attemptId, question } = await setupPhase6Attempt();

    await request(app)
      .post(`/api/v1/assessments/reviews/${attemptId}/questions/${question.id}/ai-evaluate`)
      .set('Authorization', `Bearer ${rec.token}`);

    const response = await request(app)
      .get(`/api/v1/assessments/reviews/${attemptId}/ai-summary`)
      .set('Authorization', `Bearer ${rec.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toHaveLength(1);
    expect(response.body.data.summary[0].recruiterInsight).toBeDefined();
  });

  it('retrieves candidate AI feedback excluding private recruiter insights', async () => {
    const { rec, cand, attemptId, question } = await setupPhase6Attempt();

    await request(app)
      .post(`/api/v1/assessments/reviews/${attemptId}/questions/${question.id}/ai-evaluate`)
      .set('Authorization', `Bearer ${rec.token}`);

    const response = await request(app)
      .get(`/api/v1/assessments/attempts/me/${attemptId}/ai-feedback`)
      .set('Authorization', `Bearer ${cand.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.feedback).toHaveLength(1);
    expect(response.body.data.feedback[0].candidateFeedback).toBeDefined();
    expect(response.body.data.feedback[0].recruiterInsight).toBeUndefined();
  });
});
