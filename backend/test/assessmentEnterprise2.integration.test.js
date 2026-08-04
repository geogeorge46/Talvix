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
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { QuestionRevision } from '../src/models/QuestionRevision.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@enterprise2.test`,
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
    CandidateProfile.init(),
    QuestionRevision.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Assessment Enterprise Phase 2 Features', () => {
  it('implements question versioning: immutable on usage, creates new version on edit, rollbacks, and compares', async () => {
    const owner = await recruiter();

    // 1. Create a Question
    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'coding',
      title: 'Original Title',
      prompt: 'Write clean code',
      difficulty: 'easy',
      defaultMarks: 10,
      version: 1
    });

    // Edit unused question (should update in-place)
    const updateRes = await api('patch', `/api/v1/assessments/questions/${question.id}`, owner.token)
      .send({ title: 'Unused In-Place Updated Title' })
      .expect(200);
    expect(updateRes.body.data.question.title).toBe('Unused In-Place Updated Title');
    expect(updateRes.body.data.question.version).toBe(1);

    // 2. Mock usage count > 0 to simulate publication
    await Question.updateOne({ _id: question.id }, { $set: { usageCount: 1 } });

    // 3. Edit used question (should clone it to version 2, keep original immutable)
    const editRes = await api('patch', `/api/v1/assessments/questions/${question.id}`, owner.token)
      .send({ title: 'Version 2 Title', changeLog: 'Updated title to Version 2' })
      .expect(200);

    const v2QuestionId = editRes.body.data.question._id;
    expect(v2QuestionId).not.toBe(question.id);
    expect(editRes.body.data.question.title).toBe('Version 2 Title');
    expect(editRes.body.data.question.version).toBe(2);

    // Verify original still exists with version 1
    const original = await Question.findById(question.id);
    expect(original.title).toBe('Unused In-Place Updated Title');
    expect(original.version).toBe(1);

    // Verify revision record exists for version 1
    const revision = await QuestionRevision.findOne({ question: question.id, version: 1 });
    expect(revision).toBeDefined();
    expect(revision.content.title).toBe('Unused In-Place Updated Title');

    // 4. Compare versions
    const compareRes = await api('get', `/api/v1/assessments/questions/${v2QuestionId}/compare?versionA=1&versionB=2`, owner.token)
      .expect(200);
    expect(compareRes.body.data.versionA.title).toBe('Unused In-Place Updated Title');
    expect(compareRes.body.data.versionB.title).toBe('Version 2 Title');

    // 5. Rollback to version 1
    await Question.updateOne({ _id: v2QuestionId }, { $set: { usageCount: 1 } });

    const rollbackRes = await api('post', `/api/v1/assessments/questions/${v2QuestionId}/rollback`, owner.token)
      .send({ version: 1 })
      .expect(200);
    expect(rollbackRes.body.data.question.title).toBe('Unused In-Place Updated Title');
    expect(rollbackRes.body.data.question.version).toBe(3); // Since rollback creates a new version
  });

  it('supports MCQ library bank: bulk import, export, and favorites toggle', async () => {
    const owner = await recruiter();

    // 1. Bulk Import MCQ
    const importRes = await api('post', '/api/v1/assessments/questions/bulk-import', owner.token)
      .send({
        questions: [
          { type: 'single-choice', title: 'Q1', prompt: 'Select A', difficulty: 'easy', defaultMarks: 5, category: 'Engineering', topic: 'React' },
          { type: 'single-choice', title: 'Q2', prompt: 'Select B', difficulty: 'hard', defaultMarks: 10, category: 'Engineering', topic: 'Node' }
        ]
      })
      .expect(201);
    expect(importRes.body.data.questions.length).toBe(2);

    const q1Id = importRes.body.data.questions[0]._id;

    // 2. Toggle Favorite
    const favRes = await api('post', `/api/v1/assessments/questions/${q1Id}/favorite`, owner.token)
      .expect(200);
    expect(favRes.body.data.isFavorite).toBe(true);

    // 3. Bulk Export questions
    const exportRes = await api('get', '/api/v1/assessments/questions/bulk-export?category=Engineering', owner.token)
      .expect(200);
    expect(exportRes.body.data.questions.length).toBe(2);
  });

  it('guarantees seed-based deterministic shuffling and reproducibility', async () => {
    const owner = await recruiter();
    const candidate = await account('candidate');

    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'coding',
      prompt: 'Prompt',
      difficulty: 'easy',
      defaultMarks: 10
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'Shuffle Test',
      type: 'coding',
      durationMinutes: 45,
      passingPercentage: 50,
      status: 'published',
      shuffleQuestions: true,
      questions: [
        { question: question.id, marks: 10, order: 0 },
        { question: new mongoose.Types.ObjectId(), marks: 10, order: 1 },
        { question: new mongoose.Types.ObjectId(), marks: 10, order: 2 }
      ]
    });

    const snapshot = {
      title: 'Shuffle Test',
      durationMinutes: 45,
      maximumAttempts: 1,
      shuffleQuestions: true,
      questions: [
        { questionId: question.id, marks: 10, order: 0, type: 'coding', title: 'Q1', prompt: 'P1' },
        { questionId: new mongoose.Types.ObjectId(), marks: 10, order: 1, type: 'coding', title: 'Q2', prompt: 'P2' },
        { questionId: new mongoose.Types.ObjectId(), marks: 10, order: 2, type: 'coding', title: 'Q3', prompt: 'P3' }
      ]
    };

    const assignment = await AssessmentAssignment.create({
      assessment: assessment.id,
      assessmentVersion: 1,
      assessmentSnapshot: snapshot,
      application: new mongoose.Types.ObjectId(),
      candidate: candidate.user.id,
      company: owner.company.id,
      assignedBy: owner.user.id,
      availableFrom: new Date(Date.now() - 10000),
      expiresAt: new Date(Date.now() + 3600000)
    });

    // Start Attempt 1
    const attempt1 = await api('post', `/api/v1/assessments/assignments/me/${assignment.id}/start`, candidate.token)
      .expect(201);
    const order1 = attempt1.body.data.attempt.questions;
    const seed1 = attempt1.body.data.attempt.seed;

    expect(seed1).toBeGreaterThan(0);
    expect(order1.length).toBe(3);

    // Verify fetching it again returns the same active attempt instance and exact order
    const attempt2 = await api('post', `/api/v1/assessments/assignments/me/${assignment.id}/start`, candidate.token)
      .expect(201);
    expect(attempt2.body.data.attempt.questions.map(q => q.questionId)).toEqual(order1.map(q => q.questionId));
  });

  it('calculates leaderboards, percentiles, and university benchmarking metrics', async () => {
    const owner = await recruiter();
    const candA = await account('candidate');
    const candB = await account('candidate');

    // Create educational profiles for candidates
    await CandidateProfile.create({
      user: candA.user.id,
      fullName: candA.user.fullName,
      education: [{ institution: 'Talvix University', degree: 'B.Tech', fieldOfStudy: 'Engineering', startYear: 2020 }]
    });

    await CandidateProfile.create({
      user: candB.user.id,
      fullName: candB.user.fullName,
      education: [{ institution: 'Stanford University', degree: 'B.Tech', fieldOfStudy: 'Engineering', startYear: 2020 }]
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'Leaderboard Test',
      type: 'general',
      durationMinutes: 45,
      passingPercentage: 50,
      status: 'published',
      questions: []
    });

    // Candidate A Attempt (Score: 90)
    await AssessmentAttempt.create({
      assignment: new mongoose.Types.ObjectId(),
      assessment: assessment.id,
      application: new mongoose.Types.ObjectId(),
      candidate: candA.user.id,
      company: owner.company.id,
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date(Date.now() - 50000),
      completedAt: new Date(),
      evaluation: { percentage: 90, passed: true }
    });

    // Candidate B Attempt (Score: 60)
    await AssessmentAttempt.create({
      assignment: new mongoose.Types.ObjectId(),
      assessment: assessment.id,
      application: new mongoose.Types.ObjectId(),
      candidate: candB.user.id,
      company: owner.company.id,
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date(Date.now() - 50000),
      completedAt: new Date(),
      evaluation: { percentage: 60, passed: true }
    });

    // 1. Fetch Leaderboards
    const leaderboardRes = await api('get', `/api/v1/assessments/manage/${assessment.id}/leaderboard`, owner.token)
      .expect(200);

    const leaderboard = leaderboardRes.body.data.leaderboard;
    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].fullName).toBe(candA.user.fullName);
    expect(leaderboard[0].percentile).toBe(100);
    expect(leaderboard[0].university).toBe('Talvix University');

    expect(leaderboard[1].fullName).toBe(candB.user.fullName);
    expect(leaderboard[1].percentile).toBe(50);
    expect(leaderboard[1].university).toBe('Stanford University');

    // 2. Fetch Benchmarking
    const benchmarkRes = await api('get', `/api/v1/assessments/benchmarking?assessmentId=${assessment.id}`, owner.token)
      .expect(200);

    const benchmarking = benchmarkRes.body.data;
    expect(benchmarking.universityPerformance.length).toBe(2);
    expect(benchmarking.universityPerformance[0].name).toBe('Talvix University');
    expect(benchmarking.universityPerformance[0].averageScore).toBe(90);
    expect(benchmarking.universityPerformance[1].name).toBe('Stanford University');
    expect(benchmarking.universityPerformance[1].averageScore).toBe(60);
  });
});
