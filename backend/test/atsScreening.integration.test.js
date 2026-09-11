import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Company } from '../src/models/Company.js';
import { Counter } from '../src/models/Counter.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAssignment } from '../src/models/AssessmentAssignment.js';
import { Question } from '../src/models/Question.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { uploadFile } from '../src/services/fileStorageProvider.service.js';

let replicaSet;
let sequence = 0;

const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const user = async (role) => {
  sequence += 1;
  const value = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@ats.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user: value, token: generateAccessToken(value.id) };
};

const candidate = async (overrides = {}) => {
  const account = await user('candidate');
  const profile = await CandidateProfile.create({
    user: account.user.id,
    headline: 'Backend Engineer',
    phone: '+91 99999 99999',
    profileCompletion: 80,
    resume: { url: 'https://files.example/resume.pdf', fileName: 'resume.pdf', uploadedAt: new Date() },
    skills: [{ name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4 }],
    ...overrides
  });
  return { ...account, profile };
};

const recruiterCompany = async (name = 'ATS Labs') => {
  const account = await user('recruiter');
  const company = await Company.create({
    name: `${name} ${sequence}`,
    slug: `ats-${sequence}`,
    owner: account.user.id,
    verificationStatus: 'verified',
    isActive: true,
    teamMembers: [{
      recruiter: account.user.id,
      role: 'owner',
      permissions: ['applications.view', 'applications.manage', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.publish', 'company.manage', 'team.manage', 'assessments.assign', 'assessments.view', 'documents.view'],
      status: 'active'
    }]
  });
  await RecruiterProfile.create({
    user: account.user.id,
    company: company.id,
    isApproved: true,
    isCompanyOwner: true,
    permissions: ['applications.view', 'applications.manage', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.publish', 'company.manage', 'team.manage', 'assessments.assign', 'assessments.view', 'documents.view']
  });
  return { ...account, company };
};

const publishedJob = async (owner, overrides = {}) =>
  Job.create({
    company: owner.company.id,
    createdBy: owner.user.id,
    title: `Backend Engineer ${sequence}`,
    slug: `backend-${sequence}-${Math.random().toString(16).slice(2)}`,
    description: 'Build reliable ATS services.',
    employmentType: 'full-time',
    workMode: 'remote',
    skills: [{ name: 'node.js', required: true, minimumProficiency: 'advanced', minimumYearsOfExperience: 4, weight: 100 }],
    openings: 1,
    applicationDeadline: new Date(Date.now() + 86_400_000),
    status: 'published',
    publishedAt: new Date(),
    resumeRequired: true,
    minimumProfileCompletion: 50,
    applicationQuestions: [{ question: 'Years available?', type: 'number', required: true }],
    ...overrides
  });

const submit = (candidateAccount, job, answer) =>
  auth('post', '/api/v1/applications', candidateAccount.token).send({
    jobId: job.id,
    coverLetter: 'I am interested.',
    answers: answer === undefined ? [{ questionId: job.applicationQuestions[0].id, answer: 4 }] : answer
  });

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    CandidateProfile.init(),
    RecruiterProfile.init(),
    Company.init(),
    Job.init(),
    Application.init(),
    Counter.init(),
    Assessment.init(),
    AssessmentAssignment.init(),
    Question.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    CandidateProfile.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    Company.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    Counter.deleteMany({}),
    Assessment.deleteMany({}),
    AssessmentAssignment.deleteMany({}),
    Question.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('ATS Candidate Screening & Shortlisting', () => {
  it('enforces recruiter authorization, search, filtering, and pagination on application list', async () => {
    const owner = await recruiterCompany();
    const otherCompany = await recruiterCompany('Other ATS');
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Recruiter can view authorized applications
    const listRes = await auth('get', '/api/v1/applications/manage', owner.token).expect(200);
    expect(listRes.body.data.applications).toHaveLength(1);
    expect(listRes.body.data.applications[0]._id).toBe(id);

    // Recruiter cannot view another company's applications
    const otherListRes = await auth('get', '/api/v1/applications/manage', otherCompany.token).expect(200);
    expect(otherListRes.body.data.applications).toHaveLength(0);

    // Search and filter work
    const searchRes = await auth('get', `/api/v1/applications/manage?search=${applicant.user.fullName}`, owner.token).expect(200);
    expect(searchRes.body.data.applications).toHaveLength(1);

    const filterRes = await auth('get', `/api/v1/applications/manage?status=submitted`, owner.token).expect(200);
    expect(filterRes.body.data.applications).toHaveLength(1);

    const filterMismatchRes = await auth('get', `/api/v1/applications/manage?status=under-review`, owner.token).expect(200);
    expect(filterMismatchRes.body.data.applications).toHaveLength(0);
  });

  it('runs stage transitions legally (Applied -> Under Review -> Shortlisted) and rejects invalid paths', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Transition from submitted to under-review
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'under-review', reason: 'Moving to review' })
      .expect(200);

    let appState = await Application.findById(id);
    expect(appState.status).toBe('under-review');
    expect(appState.statusHistory.at(-1).from).toBe('submitted');
    expect(appState.statusHistory.at(-1).to).toBe('under-review');

    // Transition from under-review to shortlisted
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'shortlisted' })
      .expect(200);

    appState = await Application.findById(id);
    expect(appState.status).toBe('shortlisted');

    // Rejecting invalid transitions (e.g. from shortlisted straight to hired without offer)
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'hired' })
      .expect(409);
  });

  it('allows direct shortlisting from submitted state', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Transition directly from submitted to shortlisted
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'shortlisted', reason: 'Outstanding match' })
      .expect(200);

    const appState = await Application.findById(id);
    expect(appState.status).toBe('shortlisted');
    expect(appState.statusHistory.at(-1).from).toBe('submitted');
    expect(appState.statusHistory.at(-1).to).toBe('shortlisted');
  });

  it('requires a rejection reason, records the decision details, and halts further progress', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Reject fails without a reason
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'rejected' })
      .expect(400);

    // Reject succeeds with a reason
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'rejected', reason: 'Insufficient database experience', rejectionCategory: 'experience-mismatch' })
      .expect(200);

    const appState = await Application.findById(id);
    expect(appState.status).toBe('rejected');
    expect(appState.rejection.reason).toBe('Insufficient database experience');
    expect(appState.rejection.category).toBe('experience-mismatch');

    // Cannot transition forward from rejected state
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'under-review' })
      .expect(409);
  });

  it('keeps recruiter notes completely private from candidate details view', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Recruiter adds a private note
    await auth('post', `/api/v1/applications/manage/${id}/notes`, owner.token)
      .send({ note: 'Highly skilled candidate, strong Node.js knowledge.', isPrivate: true })
      .expect(201);

    // Recruiter detail view includes the note
    const recDetail = await auth('get', `/api/v1/applications/manage/${id}`, owner.token).expect(200);
    expect(recDetail.body.data.application.recruiterNotes).toHaveLength(1);
    expect(recDetail.body.data.application.recruiterNotes[0].note).toBe('Highly skilled candidate, strong Node.js knowledge.');

    // Candidate details view hides the note
    const candDetail = await auth('get', `/api/v1/applications/me/${id}`, applicant.token).expect(200);
    expect(candDetail.body.data.application.recruiterNotes).toBeUndefined();
  });

  it('links shortlisted candidates to the assessment system and records the assignment', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);
    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Transition to shortlisted
    await auth('patch', `/api/v1/applications/manage/${id}/status`, owner.token)
      .send({ status: 'shortlisted' })
      .expect(200);

    // Create a published assessment
    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      prompt: 'Write a basic web server.',
      type: 'long-answer',
      difficulty: 'medium',
      defaultMarks: 10,
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'Backend Assessment',
      durationMinutes: 60,
      passingPercentage: 50,
      type: 'technical',
      questions: [{ question: question.id, marks: 10, order: 0 }],
      status: 'published',
      version: 1,
    });

    // Assign assessment to candidate (using the POST endpoint for assignments)
    const assignRes = await auth('post', '/api/v1/assessments/assignments', owner.token)
      .send({
        assessmentId: assessment.id,
        applicationId: id,
        availableFrom: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .expect(201);

    expect(assignRes.body.data.assignment).toBeDefined();

    // Verify application status changed to assessment-pending
    const appState = await Application.findById(id);
    expect(appState.status).toBe('assessment-pending');
  });

  it('allows recruiters to download candidate profile resumes referenced by an application', async () => {
    const owner = await recruiterCompany();
    const applicant = await candidate();
    const job = await publishedJob(owner);

    // Upload resume document to in-memory storage first
    const uploadResult = await uploadFile({
      folder: `talvix/candidate/${applicant.user.id}`,
      publicId: `talvix/candidate/${applicant.user.id}/profile-res-id`,
      fileName: 'resume.pdf',
      buffer: Buffer.from('dummy pdf content'),
      mimeType: 'application/pdf',
      resourceType: 'raw'
    });

    // Create a resume document belonging to the candidate (representing profile resume)
    const Document = mongoose.model('Document');
    const resume = await Document.create({
      owner: applicant.user._id,
      ownerRole: 'candidate',
      uploadedBy: applicant.user._id,
      category: 'resume',
      purpose: 'Profile resume',
      entityType: 'candidate-profile',
      entityId: applicant.profile.id,
      originalFileName: 'resume.pdf',
      mimeType: 'application/pdf',
      mediaType: 'document',
      sizeBytes: uploadResult.bytes || 1024,
      checksum: 'checksum-profile-resume',
      storage: uploadResult,
      access: 'private',
      status: 'active',
      isCurrent: true,
    });

    applicant.profile.resumeDocument = resume.id;
    applicant.profile.resume = { url: 'https://files.example/res.pdf', fileName: 'resume.pdf', uploadedAt: new Date() };
    await applicant.profile.save();

    const created = await submit(applicant, job).expect(201);
    const id = created.body.data.application._id;

    // Recruiter can download this resume
    await auth('get', `/api/v1/documents/manage/applications/${id}/${resume._id}/download`, owner.token)
      .expect(200);
  });

  it('allows recruiters to compare candidates for a job open vacancy including assessment metrics', async () => {
    const owner = await recruiterCompany();
    const applicant1 = await candidate({ experienceYears: 3 });
    const applicant2 = await candidate({ experienceYears: 5 });
    const job = await publishedJob(owner);

    // Create applications
    const app1Res = await submit(applicant1, job).expect(201);
    const app2Res = await submit(applicant2, job).expect(201);

    // Fetch comparison matrix before assignments
    const initialComp = await auth('get', `/api/v1/jobs/manage/${job.id}/candidate-comparison`, owner.token)
      .expect(200);
    expect(initialComp.body.data.comparison).toHaveLength(2);
    expect(initialComp.body.data.comparison[0].assessmentScore).toBeNull();

    // Setup an assessment and assign
    const question = await Question.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      type: 'single-choice',
      title: 'Node.js test',
      prompt: 'Is Node asynchronous?',
      difficulty: 'easy',
      defaultMarks: 10,
      options: [{ id: 'yes', text: 'Yes' }],
      correctAnswer: { optionId: 'yes' }
    });

    const assessment = await Assessment.create({
      company: owner.company.id,
      createdBy: owner.user.id,
      title: 'ATS Tech Assessment',
      type: 'technical',
      durationMinutes: 20,
      passingPercentage: 60,
      status: 'published',
      totalMarks: 10,
      questions: [{ question: question.id, marks: 10, order: 0 }]
    });

    // Shortlist app1 to make it compatible for assessment assignment
    await auth('patch', `/api/v1/applications/manage/${app1Res.body.data.application._id}/status`, owner.token)
      .send({ status: 'shortlisted' })
      .expect(200);

    // Assign to app1
    await auth('post', '/api/v1/assessments/assignments', owner.token)
      .send({
        assessmentId: assessment.id,
        applicationId: app1Res.body.data.application._id,
        availableFrom: new Date(Date.now() - 60000).toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);

    // Fetch comparison matrix after assignment
    const compRes = await auth('get', `/api/v1/jobs/manage/${job.id}/candidate-comparison`, owner.token)
      .expect(200);
    const comparison = compRes.body.data.comparison;
    expect(comparison).toHaveLength(2);
  });
});
