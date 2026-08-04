import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { Application } from '../src/models/Application.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Comment } from '../src/models/Comment.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const register = async (role = 'recruiter') => {
  sequence += 1;
  const response = await request(app).post('/api/v1/auth/register').send({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@business.test`, password: 'Strong!Pass123', role }).expect(201);
  return { user: response.body.data.user, token: response.body.data.accessToken };
};
const admin = async () => {
  sequence += 1;
  const user = await User.create({ fullName: 'Admin User', email: `admin.${sequence}@business.test`, password: 'Strong!Pass123', role: 'admin' });
  return { user, token: generateAccessToken(user.id) };
};
const approve = async (recruiter, adminAccount) => {
  const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
  await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, adminAccount.token).send({}).expect(200);
  return profile;
};
const createVerifiedCompany = async (recruiter, adminAccount, name = 'Pipeline Corp') => {
  await approve(recruiter, adminAccount);
  const created = await auth('post', '/api/v1/companies', recruiter.token).send({ name, industry: 'Technology', companySize: '11-50' }).expect(201);
  await auth('patch', `/api/v1/companies/admin/${created.body.data.company._id}/verify`, adminAccount.token).send({ notes: 'Documents verified' }).expect(200);
  const updatedUser = await User.findById(recruiter.user._id);
  recruiter.token = generateAccessToken(updatedUser.id, [updatedUser.role], updatedUser.tokenVersion);
  return created.body.data.company;
};
const validJob = () => ({
  title: 'Backend Engineer',
  description: 'MERN Developer',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{ name: 'Node.js', required: true, minimumProficiency: 'expert', minimumYearsOfExperience: 3, weight: 100 }],
  salary: { minimum: 100000, maximum: 120000, currency: 'USD', period: 'yearly', isVisible: true },
  minimumExperience: 3,
  maximumExperience: 8,
  openings: 2,
  applicationQuestions: [],
  assessmentRequired: false,
  resumeRequired: true,
  minimumProfileCompletion: 0
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Job.init(), CompanyMember.init(), Application.init(), AuditLog.init()]);
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), CompanyMember.deleteMany({}), Application.deleteMany({}), AuditLog.deleteMany({})]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Candidate Application Pipeline - Bulk Actions', () => {
  it('correctly executes bulk status movement of applications', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    // Create job
    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    // Create 2 applications
    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-1001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    const app2 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-1002',
      status: 'submitted',
      candidateSnapshot: { fullName: 'Jane Smith', email: 'jane@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 85, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Execute bulk status transition
    const res = await auth('post', '/api/v1/applications/manage/bulk', recruiter.token)
      .send({
        applicationIds: [app1._id, app2._id],
        action: 'move-stage',
        payload: { status: 'under-review' }
      })
      .expect(200);

    expect(res.body.success).toBe(true);

    const updatedApp1 = await Application.findById(app1._id);
    const updatedApp2 = await Application.findById(app2._id);

    expect(updatedApp1.status).toBe('under-review');
    expect(updatedApp2.status).toBe('under-review');

    // Check AuditLogs
    const logs = await AuditLog.find({ action: 'application.status_update' });
    expect(logs.length).toBe(2);
  });

  it('safely rolls back if any status transition fails validation in the batch', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    // Create job
    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    // Create 1 submitted application (valid to transition to under-review)
    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-2001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Create 1 hired application (invalid to transition to under-review)
    const app2 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-2002',
      status: 'hired',
      candidateSnapshot: { fullName: 'Jane Smith', email: 'jane@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 85, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Execute bulk operation, should fail and roll back!
    await auth('post', '/api/v1/applications/manage/bulk', recruiter.token)
      .send({
        applicationIds: [app1._id, app2._id],
        action: 'move-stage',
        payload: { status: 'under-review' }
      })
      .expect(409);

    // Verify app1 status remained 'submitted' (rolled back!)
    const checkApp1 = await Application.findById(app1._id);
    expect(checkApp1.status).toBe('submitted');

    // Verify no audit logs were persisted
    const logs = await AuditLog.find({ action: 'application.status_update' });
    expect(logs.length).toBe(0);
  });

  it('correctly executes bulk rejection of applications', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-3001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    await auth('post', '/api/v1/applications/manage/bulk', recruiter.token)
      .send({
        applicationIds: [app1._id],
        action: 'reject',
        payload: { reason: 'Skills Mismatch', rejectionCategory: 'skills-mismatch' }
      })
      .expect(200);

    const updated = await Application.findById(app1._id);
    expect(updated.status).toBe('rejected');
    expect(updated.rejection.reason).toBe('Skills Mismatch');
  });

  it('correctly executes bulk recruiter assignment', async () => {
    const administrator = await admin();
    const recruiter1 = await register();
    const company = await createVerifiedCompany(recruiter1, administrator);

    const recruiter2 = await register();
    await approve(recruiter2, administrator);
    await RecruiterProfile.updateOne({ user: recruiter2.user._id }, { company: company._id });

    // Add recruiter2 as active team member of the company
    await Company.updateOne({ _id: company._id }, {
      $push: { teamMembers: { recruiter: recruiter2.user._id, status: 'active', permissions: ['applications.view'] } }
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter2.user._id,
      role: 'recruiter',
      status: 'active',
      permissions: ['applications.view']
    });

    const jobRes = await auth('post', '/api/v1/jobs', recruiter1.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-4001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    await auth('post', '/api/v1/applications/manage/bulk', recruiter1.token)
      .send({
        applicationIds: [app1._id],
        action: 'assign-recruiter',
        payload: { recruiterIds: [recruiter1.user._id, recruiter2.user._id] }
      })
      .expect(200);

    const updated = await Application.findById(app1._id);
    expect(updated.assignedRecruiters.length).toBe(2);
  });

  it('correctly executes bulk tag additions', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-5001',
      status: 'submitted',
      tags: ['shortlisted'],
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    await auth('post', '/api/v1/applications/manage/bulk', recruiter.token)
      .send({
        applicationIds: [app1._id],
        action: 'add-tags',
        payload: { tags: ['experienced', 'shortlisted'] }
      })
      .expect(200);

    const updated = await Application.findById(app1._id);
    expect(updated.tags.length).toBe(2);
    expect(updated.tags).toContain('experienced');
    expect(updated.tags).toContain('shortlisted');
  });

  it('correctly executes bulk archiving', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-6001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    await auth('post', '/api/v1/applications/manage/bulk', recruiter.token)
      .send({
        applicationIds: [app1._id],
        action: 'archive'
      })
      .expect(200);

    const updated = await Application.findById(app1._id);
    expect(updated.isArchived).toBe(true);
  });

  it('handles note edit history and soft deletion correctly', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-7001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Add note
    const noteRes = await auth('post', `/api/v1/applications/manage/${app1._id}/notes`, recruiter.token)
      .send({ note: 'Initial note content', isPrivate: true })
      .expect(201);

    const noteId = noteRes.body.data.note._id;

    // Update note (edit history should trigger)
    await auth('patch', `/api/v1/applications/manage/${app1._id}/notes/${noteId}`, recruiter.token)
      .send({ note: 'Updated note content' })
      .expect(200);

    const updatedApp = await Application.findById(app1._id);
    const note = updatedApp.recruiterNotes.id(noteId);
    expect(note.note).toBe('Updated note content');
    expect(note.editHistory.length).toBe(1);
    expect(note.editHistory[0].note).toBe('Initial note content');

    // Delete note (soft delete)
    await auth('delete', `/api/v1/applications/manage/${app1._id}/notes/${noteId}`, recruiter.token)
      .expect(200);

    const deletedApp = await Application.findById(app1._id);
    const deletedNote = deletedApp.recruiterNotes.id(noteId);
    expect(deletedNote.isDeleted).toBe(true);
  });

  it('handles company tag master registry operations', async () => {
    const administrator = await admin();
    const recruiter = await register();
    await createVerifiedCompany(recruiter, administrator);

    // Create tag
    const createRes = await auth('post', '/api/v1/applications/manage/tags', recruiter.token)
      .send({ name: 'Shortlisted', color: '#10B981' })
      .expect(201);

    expect(createRes.body.data.tag.name).toBe('shortlisted');
    expect(createRes.body.data.tag.color).toBe('#10B981');

    // Get tags
    const getRes = await auth('get', '/api/v1/applications/manage/tags', recruiter.token)
      .expect(200);
    expect(getRes.body.data.tags.length).toBe(1);

    // Delete tag
    const tagId = createRes.body.data.tag._id;
    await auth('delete', `/api/v1/applications/manage/tags/${tagId}`, recruiter.token)
      .expect(200);

    const checkRes = await auth('get', '/api/v1/applications/manage/tags', recruiter.token)
      .expect(200);
    expect(checkRes.body.data.tags.length).toBe(0);
  });

  it('handles threaded recruiter comments and mentions correctly', async () => {
    const administrator = await admin();
    const recruiter1 = await register();
    const company = await createVerifiedCompany(recruiter1, administrator);

    const recruiter2 = await register();
    await approve(recruiter2, administrator);
    await RecruiterProfile.updateOne({ user: recruiter2.user._id }, { company: company._id, permissions: ['applications.view', 'applications.manage'] });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter2.user._id,
      role: 'recruiter',
      status: 'active',
      permissions: ['applications.view', 'applications.manage']
    });

    const jobRes = await auth('post', '/api/v1/jobs', recruiter1.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-8001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Add parent comment with mention
    const commentRes = await auth('post', `/api/v1/applications/manage/${app1._id}/comments`, recruiter1.token)
      .send({ content: `Let's discuss this candidate @${recruiter2.user.email}` })
      .expect(201);

    const parentId = commentRes.body.data.comment._id;
    expect(commentRes.body.data.comment.mentions.length).toBe(1);
    expect(String(commentRes.body.data.comment.mentions[0])).toBe(String(recruiter2.user._id));

    // Add reply
    const replyRes = await auth('post', `/api/v1/applications/manage/${app1._id}/comments`, recruiter2.token)
      .send({ content: 'I agree, looks good', parentId })
      .expect(201);

    expect(String(replyRes.body.data.comment.parentId)).toBe(String(parentId));

    // Delete comment cascade
    await auth('delete', `/api/v1/applications/manage/${app1._id}/comments/${parentId}`, recruiter1.token)
      .expect(200);

    const remaining = await Comment.find({ application: app1._id });
    expect(remaining.length).toBe(0); // Cascade delete verified!
  });

  it('correctly aggregates a consolidated activity history timeline', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-9001',
      status: 'submitted',
      statusHistory: [{ from: 'submitted', to: 'submitted', changedBy: recruiter.user._id, changedAt: new Date() }],
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Add a note
    await auth('post', `/api/v1/applications/manage/${app1._id}/notes`, recruiter.token)
      .send({ note: 'Recruiter note details', isPrivate: true })
      .expect(201);

    // Add a comment
    await auth('post', `/api/v1/applications/manage/${app1._id}/comments`, recruiter.token)
      .send({ content: 'recruiter collaboration comment' })
      .expect(201);

    // Get timeline
    const timelineRes = await auth('get', `/api/v1/applications/manage/${app1._id}/timeline`, recruiter.token)
      .expect(200);

    const timeline = timelineRes.body.data.timeline;
    expect(timeline.length).toBe(3);
    expect(timeline.map(t => t.type)).toContain('status_change');
    expect(timeline.map(t => t.type)).toContain('note');
    expect(timeline.map(t => t.type)).toContain('comment');
  });

  it('correctly returns AI matching analysis result details', async () => {
    const administrator = await admin();
    const recruiter = await register();
    const company = await createVerifiedCompany(recruiter, administrator);

    const jobRes = await auth('post', '/api/v1/jobs', recruiter.token).send(validJob()).expect(201);
    const jobId = jobRes.body.data.job._id;

    const app1 = await Application.create({
      candidate: new mongoose.Types.ObjectId(),
      candidateProfile: new mongoose.Types.ObjectId(),
      job: jobId,
      company: company._id,
      applicationNumber: 'APP-10001',
      status: 'submitted',
      candidateSnapshot: { fullName: 'John Doe', email: 'john@example.com', skills: [] },
      jobSnapshot: { title: 'Backend Engineer' },
      skillMatch: { score: 80, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    const res = await auth('post', `/api/v1/applications/manage/${app1._id}/ai-analysis`, recruiter.token)
      .send({})
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.analysis.matchScore).toBe(85);
    expect(res.body.data.analysis.skillGap).toContain('GraphQL');
    expect(res.body.data.analysis.suggestedStage).toBe('interview-scheduled');
  });
});
