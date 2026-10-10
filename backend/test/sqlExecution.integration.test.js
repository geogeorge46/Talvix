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
import { SQLDataset } from '../src/models/SQLDataset.js';
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
    SQLDataset.init(),
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
    email: `${role}.${sequence}@sql.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

const recruiter = async () => {
  const owner = await account('recruiter');
  const company = await Company.create({
    name: `SQL ${sequence}`,
    slug: `sql-${sequence}`,
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
    title: 'Data Engineer',
    slug: `data-eng-${sequence}`,
    description: 'desc',
    employmentType: 'full-time',
    workMode: 'remote',
    openings: 1,
    applicationDeadline: new Date(Date.now() + 86400000),
    status: 'published',
  });
  return { ...owner, company, job };
};

const setupSQLAttempt = async () => {
  const rec = await recruiter();
  const cand = await account('candidate');
  const application = await Application.create({
    candidate: cand.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: rec.job.id,
    company: rec.company.id,
    applicationNumber: `TVX-SQL-${sequence}-${Date.now()}`,
    status: 'shortlisted',
    candidateSnapshot: { fullName: cand.user.fullName },
    jobSnapshot: { title: 'Data Engineer' },
    skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
  });

  const question = await Question.create({
    type: 'sql',
    prompt: 'Select all employee names with salary > 80000',
    difficulty: 'medium',
    defaultMarks: 25,
    coding: {
      languageSupport: ['sql'],
      starterCode: { sql: 'SELECT * FROM employees;' },
      functionName: 'query',
      testCases: [{ input: '', expectedOutput: '', isHidden: false, weight: 25 }],
    },
    company: rec.company.id,
    createdBy: rec.user.id,
  });

  await SQLDataset.create({
    question: question.id,
    title: 'Employee Salaries Dataset',
    schemaDDL: 'CREATE TABLE employees (id INT, name TEXT, salary INT);',
    seedDataDML: "INSERT INTO employees VALUES (1, 'Alice', 90000), (2, 'Bob', 75000), (3, 'Charlie', 85000);",
    expectedQuery: 'SELECT name FROM employees WHERE salary > 80000',
    tables: [
      {
        tableName: 'employees',
        columns: [
          { name: 'id', type: 'INT', isPrimaryKey: true },
          { name: 'name', type: 'TEXT' },
          { name: 'salary', type: 'INT' },
        ],
      },
    ],
  });

  const assessment = await Assessment.create({
    title: 'SQL Technical Assessment',
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

  return {
    rec,
    cand,
    question,
    assessment,
    assignmentId,
    attemptId: startRes.body.data.attempt.id,
  };
};

describe('Phase 3 — SQL Assessment Integration Tests', () => {
  it('retrieves SQL question database schema', async () => {
    const { cand, attemptId, question } = await setupSQLAttempt();

    const response = await request(app)
      .get(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/sql/schema`)
      .set('Authorization', `Bearer ${cand.token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.schema.tables).toHaveLength(1);
    expect(response.body.data.schema.tables[0].tableName).toBe('employees');
  });

  it('runs SQL candidate query in isolated sandbox and blocks illegal DDL operations', async () => {
    const { cand, attemptId, question } = await setupSQLAttempt();

    // 1. Valid SELECT query
    const validRes = await request(app)
      .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/sql/run`)
      .set('Authorization', `Bearer ${cand.token}`)
      .send({ sqlQuery: 'SELECT name FROM employees WHERE salary > 80000' });

    expect(validRes.status).toBe(200);
    expect(validRes.body.data.result.status).toBe('success');
    expect(validRes.body.data.result.rowCount).toBe(2);

    // 2. Illegal DROP TABLE query attempt
    const dropRes = await request(app)
      .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/sql/run`)
      .set('Authorization', `Bearer ${cand.token}`)
      .send({ sqlQuery: 'DROP TABLE employees' });

    expect(dropRes.status).toBe(400);
    expect(dropRes.body.message).toMatch(/SELECT|Forbidden/);
  });

  it('submits correct SQL query and auto-evaluates full points', async () => {
    const { cand, attemptId, question } = await setupSQLAttempt();

    const response = await request(app)
      .post(`/api/v1/assessments/attempts/me/${attemptId}/questions/${question.id}/sql/submit`)
      .set('Authorization', `Bearer ${cand.token}`)
      .send({ sqlQuery: 'SELECT name FROM employees WHERE salary > 80000' });

    expect(response.status).toBe(200);
    expect(response.body.data.submission.passed).toBe(true);
    expect(response.body.data.submission.grading.finalScore).toBe(25);

    const storedSub = await TechnicalSubmission.findOne({ attempt: attemptId, question: question.id });
    expect(storedSub).not.toBeNull();
    expect(storedSub.status).toBe('submitted');
    expect(storedSub.type).toBe('sql');
  });
});
