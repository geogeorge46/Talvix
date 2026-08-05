import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAssignment } from '../src/models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { Question } from '../src/models/Question.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
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

const createMockJob = async (companyId, userId) => {
  sequence += 1;
  return await Job.create({
    company: companyId,
    createdBy: userId,
    title: 'Assessment Dev',
    slug: `job-${sequence}`,
    description: 'Requires TypeScript and Node.js. 3 years experience.',
    employmentType: 'full-time',
    workMode: 'onsite',
    status: 'published'
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
    Assessment.deleteMany({}),
    AssessmentAssignment.deleteMany({}),
    AssessmentAttempt.deleteMany({}),
    Question.deleteMany({}),
    Application.deleteMany({}),
    BackgroundJob.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CompanyMember.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Assessment & Interview Intelligence Integration Tests', () => {

  describe('Automated Test Generation', () => {
    it('allows recruiters to automatically generate assessments and questions based on job description', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const res = await request(app)
        .post('/api/v1/assessments/intelligence/generate')
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .send({ jobDescription: 'React and Node.js Developer position.' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment.questions.length).toBeGreaterThan(0);
      expect(res.body.data.assessment.questions[0].question.prompt).toContain('runtime');
    });

    it('enforces RBAC and blocks candidate user generating tests', async () => {
      const candidate = await createAccount('candidate');
      await request(app)
        .post('/api/v1/assessments/intelligence/generate')
        .set('Authorization', `Bearer ${candidate.token}`)
        .send({ jobDescription: 'React developer' })
        .expect(403);
    });
  });

  describe('Grading Evaluation Engine', () => {
    it('evaluates candidate attempt submissions automatically and awards marks', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const candidate = await createAccount('candidate');
      const candidateProfile = await CandidateProfile.create({ user: candidate.user._id });
      const job = await createMockJob(company._id, recruiter.user._id);

      // Create Assessment & Question
      const q = await Question.create({
        company: company._id,
        createdBy: recruiter.user._id,
        type: 'short-answer',
        prompt: 'What is event loop?',
        difficulty: 'medium',
        defaultMarks: 10
      });

      const assessment = await Assessment.create({
        company: company._id,
        createdBy: recruiter.user._id,
        title: 'Tech Test',
        type: 'technical',
        durationMinutes: 30,
        passingPercentage: 60,
        questions: [{ question: q._id, marks: 10, order: 0 }]
      });

      const application = await Application.create({
        job: job._id,
        candidate: candidate.user._id,
        candidateProfile: candidateProfile._id,
        company: company._id,
        applicationNumber: 'APP-2001',
        status: 'submitted',
        candidateSnapshot: { fullName: 'Bob Dev' },
        jobSnapshot: { title: 'Assessment Dev' },
        skillMatch: { score: 90, matchedSkills: ['TypeScript'], missingRequiredSkills: [] }
      });

      const assignment = await AssessmentAssignment.create({
        company: company._id,
        candidate: candidate.user._id,
        assessment: assessment._id,
        assessmentVersion: 1,
        assessmentSnapshot: { title: 'Tech Test' },
        application: application._id,
        assignedBy: recruiter.user._id,
        availableFrom: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        status: 'assigned'
      });

      // Create an AssessmentAttempt
      const attempt = await AssessmentAttempt.create({
        assignment: assignment._id,
        assessment: assessment._id,
        application: application._id,
        candidate: candidate.user._id,
        company: company._id,
        attemptNumber: 1,
        status: 'submitted',
        seed: 42,
        answers: [
          { questionId: q._id, questionType: q.type, answer: 'It manages call stack queues.' }
        ]
      });

      const res = await request(app)
        .post(`/api/v1/assessments/intelligence/attempts/${attempt._id}/evaluate`)
        .set('Authorization', `Bearer ${recruiter.token}`)
        .set('X-Company-Id', String(company._id))
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.attempt.evaluation.totalScore).toBe(8); // matching mocked response
    });
  });

  describe('Background Assessment Generations', () => {
    it('runs background queue task integrations successfully', async () => {
      const recruiter = await createAccount('recruiter');
      const company = await createMockCompany(recruiter.user._id);

      const job = await BackgroundJob.create({
        type: 'ASSESSMENT_GENERATION',
        payload: {
          jobDescription: 'Senior Node.js architect position.',
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
