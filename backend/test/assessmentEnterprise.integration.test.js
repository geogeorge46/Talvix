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
import { AssessmentBlueprint } from '../src/models/AssessmentBlueprint.js';
import { AssessmentPlagiarism } from '../src/models/AssessmentPlagiarism.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const permissions = ['assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review'];
const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@enterprise.test`,
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
    AssessmentBlueprint.init(),
    AssessmentPlagiarism.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Assessment Enterprise Features', () => {
  it('supports blueprint CRUD, cloning, and assessment generation from blueprints', async () => {
    const owner = await recruiter();
    const otherOwner = await recruiter();

    // 1. Create Question to populate company pool
    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'coding',
      title: 'Reverse String',
      prompt: 'Reverse a given string',
      difficulty: 'easy',
      defaultMarks: 10,
      coding: {
        languageSupport: ['javascript'],
        starterCode: { javascript: 'function rev() {}' },
        functionName: 'rev',
        testCases: [{ input: 'hello', expectedOutput: 'olleh', isHidden: false, weight: 10 }]
      }
    });

    // 2. Blueprint Creation
    const blueprintRes = await api('post', '/api/v1/assessments/blueprints', owner.token)
      .send({
        name: 'Backend Engineer Blueprint',
        description: 'Template layout for hiring backend devs',
        sections: [
          { name: 'Coding Challenge', type: 'coding', questionCount: 1, difficulty: 'easy', skills: ['javascript'] }
        ],
        defaultDuration: 60,
        passingScore: 60
      })
      .expect(201);

    const blueprintId = blueprintRes.body.data.blueprint._id;

    // Tenant Isolation Check: Other recruiter cannot view this blueprint
    await api('get', `/api/v1/assessments/blueprints/${blueprintId}`, otherOwner.token).expect(404);

    // 3. Clone Blueprint
    const cloneRes = await api('post', `/api/v1/assessments/blueprints/${blueprintId}/clone`, owner.token)
      .expect(201);

    expect(cloneRes.body.data.blueprint.name).toBe('Backend Engineer Blueprint (Copy)');

    // 4. Generate Assessment from Blueprint
    const assessRes = await api('post', `/api/v1/assessments/blueprints/${blueprintId}/generate`, owner.token)
      .expect(201);

    expect(assessRes.body.data.assessment.title).toBe('Backend Engineer Blueprint - Generated');
    expect(assessRes.body.data.assessment.questions.length).toBe(1);
    expect(assessRes.body.data.assessment.questions[0].question.toString()).toBe(question.id);
  });

  it('performs pairwise plagiarism code scan checks', async () => {
    const owner = await recruiter();
    const candA = await account('candidate');
    const candB = await account('candidate');

    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'coding',
      prompt: 'Write reverse',
      difficulty: 'easy',
      defaultMarks: 10
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'Plagiarism Test Assessment',
      type: 'coding',
      durationMinutes: 45,
      passingPercentage: 50,
      status: 'published',
      questions: [{ question: question.id, marks: 10, order: 0 }]
    });

    // Create completed attempt for Candidate A
    await AssessmentAttempt.create({
      assignment: new mongoose.Types.ObjectId(),
      assessment: assessment.id,
      application: new mongoose.Types.ObjectId(),
      candidate: candA.user.id,
      company: owner.company.id,
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date(),
      answers: [{ questionId: question.id, questionType: 'coding', code: 'function rev(str) { return str.split("").reverse().join(""); }', language: 'javascript' }]
    });

    // Create completed attempt for Candidate B with highly similar code
    await AssessmentAttempt.create({
      assignment: new mongoose.Types.ObjectId(),
      assessment: assessment.id,
      application: new mongoose.Types.ObjectId(),
      candidate: candB.user.id,
      company: owner.company.id,
      attemptNumber: 1,
      status: 'completed',
      startedAt: new Date(),
      answers: [{ questionId: question.id, questionType: 'coding', code: 'function rev(str) {\n  return str.split("").reverse().join("");\n}', language: 'javascript' }]
    });

    // Trigger Plagiarism pairwise Scan API
    const scanRes = await api('post', `/api/v1/assessments/manage/${assessment.id}/plagiarism/scan`, owner.token)
      .expect(200);

    expect(scanRes.body.data.results.length).toBe(1);
    expect(scanRes.body.data.results[0].similarityScore).toBe(100);

    // Retrieve Plagiarism report
    const reportRes = await api('get', `/api/v1/assessments/manage/${assessment.id}/plagiarism`, owner.token)
      .expect(200);

    expect(reportRes.body.data.report.length).toBe(1);
    expect(reportRes.body.data.report[0].similarityScore).toBe(100);
  });

  it('generates downloadable HTML and PDF candidate reports under access boundaries', async () => {
    const owner = await recruiter();
    const candidate = await account('candidate');
    const stranger = await account('candidate');

    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'coding',
      prompt: 'Write reverse',
      difficulty: 'easy',
      defaultMarks: 10
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'Report Test Assessment',
      type: 'coding',
      durationMinutes: 45,
      passingPercentage: 50,
      status: 'published',
      questions: [{ question: question.id, marks: 10, order: 0 }]
    });

    const appRecord = await Application.create({
      candidate: candidate.user.id,
      candidateProfile: new mongoose.Types.ObjectId(),
      job: new mongoose.Types.ObjectId(),
      company: owner.company.id,
      applicationNumber: `APP-${Date.now()}`,
      status: 'shortlisted',
      candidateSnapshot: { fullName: candidate.user.fullName },
      jobSnapshot: { title: 'Engineer' },
      skills: ['javascript'],
      skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    const assignment = await AssessmentAssignment.create({
      assessment: assessment.id,
      assessmentVersion: 1,
      assessmentSnapshot: assessment.toObject(),
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
      status: 'completed',
      startedAt: new Date(),
      answers: [{ questionId: question.id, questionType: 'coding', code: 'test', language: 'javascript' }],
      evaluation: { percentage: 80, passed: true }
    });

    // 1. Download HTML report as Recruiter (should work)
    const reportHtml = await api('get', `/api/v1/assessments/attempts/${attempt.id}/report/html`, owner.token)
      .expect(200);
    expect(reportHtml.text).toContain('Assessment Report');

    // 2. Download HTML report as Candidate who owns the attempt (should work)
    const candReportHtml = await api('get', `/api/v1/assessments/attempts/me/${attempt.id}/report/html`, candidate.token)
      .expect(200);
    expect(candReportHtml.text).toContain('Assessment Report');

    // 3. Download HTML report as stranger candidate (should fail)
    await api('get', `/api/v1/assessments/attempts/me/${attempt.id}/report/html`, stranger.token)
      .expect(404);

    // 4. Download PDF report as Recruiter
    const reportPdf = await api('get', `/api/v1/assessments/attempts/${attempt.id}/report/pdf`, owner.token)
      .expect(200);
    expect(reportPdf.header['content-type']).toBe('application/pdf');
  });
});
