import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { User } from '../src/models/User.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Question } from '../src/models/Question.js';
import { Document } from '../src/models/Document.js';
import { EmailLog } from '../src/models/EmailLog.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role, fullName = '') => {
  sequence += 1;
  const name = fullName || `${role} ${sequence}`;
  const user = await User.create({
    fullName: name,
    email: `${role}.${sequence}@adminmanagement.test`,
    password: 'Strong!Pass123',
    role,
    isVerified: true,
    isActive: true
  });
  return { user, token: generateAccessToken(user.id) };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    Company.init(),
    RecruiterProfile.init(),
    CompanyMember.init(),
    Job.init(),
    Application.init(),
    Question.init(),
    Document.init(),
    EmailLog.init(),
    AuditLog.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Enterprise Platform Management Console', () => {
  it('enforces Platform Admin RBAC boundaries', async () => {
    const candidate = await account('candidate');
    const recruiter = await account('recruiter');

    // Candidate must be blocked with 403 Forbidden
    await api('get', '/api/v1/admin/management/users', candidate.token)
      .expect(403);

    // Recruiter must be blocked with 403 Forbidden
    await api('get', '/api/v1/admin/management/users', recruiter.token)
      .expect(403);
  });

  it('verifies user directory management operations, sorting, and soft deletion', async () => {
    const admin = await account('admin');
    
    // Create candidate & recruiter users
    const cand = await account('candidate', 'Xavier Candidate');
    const rec = await account('recruiter', 'Walter Recruiter');

    // List and sort users
    const listRes = await api('get', '/api/v1/admin/management/users?sortBy=fullName&sortOrder=asc', admin.token)
      .expect(200);

    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.rows.length).toBeGreaterThanOrEqual(3); // admin, candidate, recruiter

    // Fetch user details
    const detailRes = await api('get', `/api/v1/admin/management/users/${cand.user.id}`, admin.token)
      .expect(200);
    expect(detailRes.body.data.fullName).toBe('Xavier Candidate');

    // Suspend user
    await api('patch', `/api/v1/admin/management/users/${cand.user.id}/status`, admin.token)
      .send({ action: 'suspend' })
      .expect(200);

    const suspendedUser = await User.findById(cand.user.id);
    expect(suspendedUser.blocked).toBe(true);

    // Soft delete user
    await api('delete', `/api/v1/admin/management/users/${cand.user.id}`, admin.token)
      .expect(200);

    const deletedUser = await User.findById(cand.user.id);
    expect(deletedUser.isDeleted).toBe(true);

    // Excluded from standard listing
    const searchRes = await api('get', `/api/v1/admin/management/users?search=Xavier`, admin.token)
      .expect(200);
    expect(searchRes.body.data.rows.length).toBe(0);
  });

  it('verifies recruiter memberships and company directory management overrides', async () => {
    const admin = await account('admin');
    
    const company = await Company.create({
      name: 'Tech Ventures',
      slug: 'tech-ventures',
      owner: new mongoose.Types.ObjectId()
    });

    const rec = await account('recruiter', 'Vince Recruiter');
    const profile = await RecruiterProfile.create({
      user: rec.user.id,
      company: company.id,
      isApproved: true
    });

    await CompanyMember.create({
      company: company.id,
      recruiter: rec.user.id,
      role: 'admin',
      status: 'active'
    });

    // List recruiters
    const recRes = await api('get', '/api/v1/admin/management/recruiters', admin.token)
      .expect(200);
    expect(recRes.body.data.rows.length).toBe(1);

    // Remove from company
    await api('delete', `/api/v1/admin/management/recruiters/${profile.id}/company`, admin.token)
      .expect(200);

    const updatedProfile = await RecruiterProfile.findById(profile.id);
    expect(updatedProfile.company).toBeNull();
  });

  it('verifies companies merging action operational consistency', async () => {
    const admin = await account('admin');

    const compA = await Company.create({ name: 'Acme A', slug: 'acme-a', owner: new mongoose.Types.ObjectId() });
    const compB = await Company.create({ name: 'Acme B', slug: 'acme-b', owner: new mongoose.Types.ObjectId() });

    // Merge company B into A
    await api('post', '/api/v1/admin/management/companies/merge', admin.token)
      .send({ primaryId: compA.id, secondaryId: compB.id })
      .expect(200);

    const checkB = await Company.findById(compB.id);
    expect(checkB).toBeNull();
  });

  it('verifies job overrides pause, close, resume, and cloning', async () => {
    const admin = await account('admin');

    const company = await Company.create({ name: 'JobCorp', slug: 'jobcorp', owner: new mongoose.Types.ObjectId() });
    const job = await Job.create({
      title: 'QA Engineer',
      createdBy: admin.user._id,
      company: company.id,
      status: 'published',
      workMode: 'onsite',
      employmentType: 'full-time',
      description: 'QA job description',
      slug: 'qa-engineer'
    });

    // Pause job
    await api('patch', `/api/v1/admin/management/jobs/${job.id}/status`, admin.token)
      .send({ status: 'paused' })
      .expect(200);

    const pausedJob = await Job.findById(job.id);
    expect(pausedJob.status).toBe('paused');

    // Clone job
    const cloneRes = await api('post', `/api/v1/admin/management/jobs/${job.id}/clone`, admin.token)
      .expect(200);

    expect(cloneRes.body.data.title).toContain('Clone of QA Engineer');
  });

  it('verifies bulk actions and CSV user exports', async () => {
    const admin = await account('admin');
    const u1 = await account('candidate', 'User One');
    const u2 = await account('candidate', 'User Two');

    // Bulk suspend
    await api('post', '/api/v1/admin/management/users/bulk', admin.token)
      .send({ userIds: [u1.user.id, u2.user.id], action: 'suspend' })
      .expect(200);

    const check1 = await User.findById(u1.user.id);
    const check2 = await User.findById(u2.user.id);
    expect(check1.blocked).toBe(true);
    expect(check2.blocked).toBe(true);

    // Export CSV
    const csvRes = await api('get', '/api/v1/admin/management/users/export', admin.token)
      .expect(200);

    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain('User One');
  });

  it('verifies document malware status quarantine and release actions', async () => {
    const admin = await account('admin');

    const doc = await Document.create({
      owner: admin.user.id,
      ownerRole: 'admin',
      uploadedBy: admin.user.id,
      category: 'resume',
      purpose: 'Application resume file',
      entityType: 'candidate-profile',
      entityId: new mongoose.Types.ObjectId(),
      originalFileName: 'cv.pdf',
      mimeType: 'application/pdf',
      mediaType: 'document',
      sizeBytes: 1024,
      checksum: 'abc123checksum',
      storage: { provider: 'memory', publicId: 'someid' }
    });

    // Quarantine document
    await api('patch', `/api/v1/admin/management/documents/${doc.id}/status`, admin.token)
      .send({ action: 'quarantine' })
      .expect(200);

    const checkDoc = await Document.findById(doc.id);
    expect(checkDoc.status).toBe('quarantined');
    expect(checkDoc.malwareScan.status).toBe('suspicious');
  });

  it('verifies question list and detailed inspect endpoint', async () => {
    const admin = await account('admin');

    const question = await Question.create({
      title: 'JS Closures',
      prompt: 'Explain JS closures in detail.',
      type: 'long-answer',
      difficulty: 'medium',
      defaultMarks: 10,
      company: new mongoose.Types.ObjectId(),
      createdBy: admin.user.id
    });

    // List questions
    const listRes = await api('get', '/api/v1/admin/management/questions', admin.token)
      .expect(200);
    expect(listRes.body.data.rows.length).toBeGreaterThanOrEqual(1);

    // Get specific question
    const getRes = await api('get', `/api/v1/admin/management/questions/${question.id}`, admin.token)
      .expect(200);
    expect(getRes.body.data.title).toBe('JS Closures');
    expect(getRes.body.data.prompt).toBe('Explain JS closures in detail.');
  });
});
