import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAssignment } from '../src/models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { Company } from '../src/models/Company.js';
import { Question } from '../src/models/Question.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';
import { createAssessmentSnapshot } from '../src/utils/assessmentSnapshot.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@hardening.test`,
    password: 'Strong!Pass123',
    role
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `Company ${sequence}`,
    slug: `company-${sequence}`,
    owner: owner.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [{ recruiter: owner.user.id, role: 'owner', permissions, status: 'active' }]
  });
  await RecruiterProfile.create({
    user: owner.user.id,
    company: company.id,
    isApproved: true,
    isCompanyOwner: true,
    permissions
  });
  return { ...owner, company };
};

const applicationFor = async (owner, candidate) => {
  return Application.create({
    candidate: candidate.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: new mongoose.Types.ObjectId(),
    company: owner.company.id,
    applicationNumber: `TVX-ASSESS-HRD-${sequence}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: candidate.user.fullName },
    jobSnapshot: { title: 'Engineer' },
    skills: ['javascript', 'sql'],
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
  });
};

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
    BackgroundJob.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Assessment Hardening', () => {
  it('supports custom question limits, live autosaves, and anti-cheating suspicious events logging', async () => {
    const owner = await recruiter();
    const candidate = await account('candidate');

    // 1. Create SQL and Debugging questions with custom limits
    const sqlQuestion = await api('post', '/api/v1/assessments/questions', owner.token)
      .send({
        type: 'sql',
        title: 'Query Users',
        prompt: 'Select all users from the database',
        difficulty: 'easy',
        defaultMarks: 10,
        coding: {
          languageSupport: ['sql'],
          starterCode: { sql: 'SELECT * FROM users' },
          functionName: 'query',
          timeLimit: 1.5,
          memoryLimit: 256000,
          testCases: [
            { input: 'CREATE TABLE users', expectedOutput: 'rows', isHidden: false, weight: 5 },
            { input: 'INSERT INTO users', expectedOutput: 'done', isHidden: true, weight: 5 }
          ]
        }
      });

    expect(sqlQuestion.status).toBe(201);

    const questionId = sqlQuestion.body.data.question._id;

    // Create hybrid assessment
    const createdAssess = await api('post', '/api/v1/assessments', owner.token)
      .send({
        title: 'Hardened Hybrid Test',
        type: 'mixed',
        durationMinutes: 45,
        passingPercentage: 50
      })
      .expect(201);

    const assessmentId = createdAssess.body.data.assessment._id;

    // Add question
    await api('post', `/api/v1/assessments/manage/${assessmentId}/questions`, owner.token)
      .send({ questionId, marks: 10 })
      .expect(200);

    // Publish assessment
    await api('patch', `/api/v1/assessments/manage/${assessmentId}/publish`, owner.token).expect(200);

    // Assign to candidate
    const appRecord = await applicationFor(owner, candidate);
    const assigned = await api('post', '/api/v1/assessments/assignments', owner.token)
      .send({
        assessmentId,
        applicationId: appRecord.id,
        availableFrom: new Date(Date.now() - 10000),
        expiresAt: new Date(Date.now() + 3600000)
      })
      .expect(201);

    const assignmentId = assigned.body.data.assignment._id;

    // Start Attempt
    const started = await api('post', `/api/v1/assessments/assignments/me/${assignmentId}/start`, candidate.token)
      .expect(201);

    const attemptId = started.body.data.attempt.id;

    // 2. Monaco Workspace live execution
    const executed = await api('post', `/api/v1/assessments/attempts/me/${attemptId}/execute`, candidate.token)
      .send({
        questionId,
        code: 'SELECT * FROM accounts',
        language: 'sql'
      })
      .expect(200);

    expect(executed.body.data.result.status).toBe('completed');
    // Ensure hidden test cases were NOT run or returned to the candidate
    expect(executed.body.data.result.testResults.length).toBe(1); // Only the public test case is run
    expect(executed.body.data.result.testResults[0].isHidden).toBeUndefined();

    // 3. Live autosave answer
    await api('patch', `/api/v1/assessments/attempts/me/${attemptId}/answers`, candidate.token)
      .send({
        questionId,
        code: 'SELECT * FROM users',
        language: 'sql'
      })
      .expect(200);

    // 4. Anti-cheating logs and cheating risk score computation
    const cheatEvent1 = await api('post', `/api/v1/assessments/attempts/me/${attemptId}/suspicious-events`, candidate.token)
      .send({ type: 'tab-switch', detail: 'Candidate switched tabs to search engine' })
      .expect(200);

    expect(cheatEvent1.body.data.cheatingRiskScore).toBe(15);

    const cheatEvent2 = await api('post', `/api/v1/assessments/attempts/me/${attemptId}/suspicious-events`, candidate.token)
      .send({ type: 'window-blur', detail: 'Candidate blurred editor window' })
      .expect(200);

    expect(cheatEvent2.body.data.cheatingRiskScore).toBe(20);

    // Submit
    const submitted = await api('post', `/api/v1/assessments/attempts/me/${attemptId}/submit`, candidate.token)
      .expect(200);

    expect(submitted.body.data.attempt.status).toBe('completed');
  });

  it('runs background jobs for submissions and AI assessment evaluation', async () => {
    const owner = await recruiter();
    const candidate = await account('candidate');
    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'long-answer',
      prompt: 'Describe MVC architecture.',
      difficulty: 'easy',
      defaultMarks: 10
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'AI Assessment',
      type: 'general',
      durationMinutes: 30,
      passingPercentage: 60,
      status: 'published',
      questions: [{ question: question.id, marks: 10, order: 0 }]
    });

    const questionsMap = new Map([[question.id, question]]);
    const snapshot = createAssessmentSnapshot(assessment, questionsMap);

    const appRecord = await applicationFor(owner, candidate);
    const assignment = await AssessmentAssignment.create({
      assessment: assessment.id,
      assessmentVersion: 1,
      assessmentSnapshot: snapshot,
      application: appRecord.id,
      candidate: candidate.user.id,
      company: owner.company.id,
      assignedBy: owner.user.id,
      availableFrom: new Date(Date.now() - 10000),
      expiresAt: new Date(Date.now() + 3600000)
    });

    const attempt = await AssessmentAttempt.create({
      assignment: assignment.id,
      assessment: assessment.id,
      application: appRecord.id,
      candidate: candidate.user.id,
      company: owner.company.id,
      attemptNumber: 1,
      status: 'in-progress',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1800000),
      answers: [{ questionId: question.id, questionType: 'long-answer', answer: 'MVC splits system into model, view and controller.' }]
    });

    // Create background job for evaluation
    const evalJob = await BackgroundJob.create({
      type: 'EVALUATE_SUBMISSION',
      payload: { candidateId: candidate.user.id, attemptId: attempt.id }
    });

    await executeJob(evalJob);

    const evaluatedAttempt = await AssessmentAttempt.findById(attempt.id);
    expect(evaluatedAttempt.status).toBe('review-pending');

    // Create background job for AI evaluation
    const aiJob = await BackgroundJob.create({
      type: 'AI_ASSESSMENT_EVALUATION',
      payload: { attemptId: attempt.id }
    });

    await executeJob(aiJob);

    const aiEvaluatedAttempt = await AssessmentAttempt.findById(attempt.id);
    expect(aiEvaluatedAttempt.aiAnalysis).toBeDefined();
    expect(aiEvaluatedAttempt.aiAnalysis.codeQualityAnalysis.score).toBe(85);
  });
});
