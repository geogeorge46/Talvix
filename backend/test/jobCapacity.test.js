import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { closeExpiredJobs } from '../src/services/jobCapacity.service.js';

let replicaSet;

const createMockApp = async ({ candidate, job, company, appNumber }) => {
  const candProfile = await CandidateProfile.create({ user: candidate._id });
  return Application.create({
    candidate: candidate._id,
    candidateProfile: candProfile._id,
    job: job._id,
    company: company._id,
    applicationNumber: appNumber,
    status: 'offer-accepted',
    statusHistory: [
      { from: null, to: 'submitted', changedBy: candidate._id, reason: 'Applied' },
      { from: 'submitted', to: 'offer-accepted', changedBy: candidate._id, reason: 'Offer accepted' },
    ],
    candidateSnapshot: { fullName: candidate.fullName, email: candidate.email },
    jobSnapshot: { title: job.title },
    skillMatch: { score: 90, matchedSkills: ['Node.js'], missingRequiredSkills: [] },
  });
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await CompanyMember.init();
  await RecruiterProfile.init();
  await CandidateProfile.init();
  await Job.init();
  await Application.init();
  await AuditLog.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    CandidateProfile.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Job Hiring Capacity & Automated Closure Rules', () => {
  it('1 & 2 — Officially hires candidate and tracks capacity until openings are filled', async () => {
    const recruiter = await User.create({
      fullName: 'Capacity Admin',
      email: 'admin@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Capacity Corp',
      slug: 'capacity-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter._id,
      role: 'owner',
      permissions: ['jobs.create', 'jobs.update', 'jobs.publish', 'applications.view', 'applications.manage'],
      status: 'active',
    });
    await RecruiterProfile.create({
      user: recruiter._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.create', 'jobs.update', 'jobs.publish', 'applications.view', 'applications.manage'],
    });

    const token = generateAccessToken(recruiter.id);

    // Create job with 2 openings
    const job = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'DevOps Specialist',
      slug: 'devops-specialist',
      description: 'DevOps hiring test.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Docker', required: true, weight: 100 }],
      openings: 2,
      applicationDeadline: new Date(Date.now() + 86400000),
      status: 'published',
      publishedAt: new Date(),
    });

    // Create 2 candidate applications
    const cand1 = await User.create({ fullName: 'Candidate 1', email: 'c1@test.com', role: 'candidate' });
    const cand2 = await User.create({ fullName: 'Candidate 2', email: 'c2@test.com', role: 'candidate' });

    const app1 = await createMockApp({ candidate: cand1, job, company, appNumber: 'APP-001' });
    const app2 = await createMockApp({ candidate: cand2, job, company, appNumber: 'APP-002' });

    // Hire Candidate 1 (1 of 2 openings filled)
    const hire1Res = await request(app)
      .patch(`/api/v1/applications/manage/${app1._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    expect(hire1Res.status).toBe(200);

    const updatedJob1 = await Job.findById(job._id);
    expect(updatedJob1.status).toBe('published'); // Job still published because 1 opening remains

    // Hire Candidate 2 (2 of 2 openings filled -> Auto-closes job)
    const hire2Res = await request(app)
      .patch(`/api/v1/applications/manage/${app2._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    expect(hire2Res.status).toBe(200);

    const updatedJob2 = await Job.findById(job._id);
    expect(updatedJob2.status).toBe('closed');
    expect(updatedJob2.closedReason).toBe('capacity_reached');
    expect(updatedJob2.closedAt).toBeDefined();

    // Check AuditLog for job.auto_close
    const autoCloseAudit = await AuditLog.findOne({ action: 'job.auto_close', company: company._id });
    expect(autoCloseAudit).toBeDefined();
    expect(autoCloseAudit.newValue.closedReason).toBe('capacity_reached');
    expect(autoCloseAudit.newValue.hiredCount).toBe(2);
  });

  it('3 — Prevents race condition hiring beyond openings capacity', async () => {
    const recruiter = await User.create({
      fullName: 'Race Admin',
      email: 'race@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Race Corp',
      slug: 'race-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter._id,
      role: 'owner',
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
      status: 'active',
    });
    await RecruiterProfile.create({
      user: recruiter._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
    });

    const token = generateAccessToken(recruiter.id);

    // Job with 1 opening
    const job = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'Solo Engineer',
      slug: 'solo-engineer',
      description: 'Single slot.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Go', required: true, weight: 100 }],
      openings: 1,
      applicationDeadline: new Date(Date.now() + 86400000),
      status: 'published',
      publishedAt: new Date(),
    });

    const cand1 = await User.create({ fullName: 'Solo Candidate 1', email: 's1@test.com', role: 'candidate' });
    const cand2 = await User.create({ fullName: 'Solo Candidate 2', email: 's2@test.com', role: 'candidate' });

    const app1 = await createMockApp({ candidate: cand1, job, company, appNumber: 'APP-101' });
    const app2 = await createMockApp({ candidate: cand2, job, company, appNumber: 'APP-102' });

    // Hire candidate 1 (fills the 1 slot)
    await request(app)
      .patch(`/api/v1/applications/manage/${app1._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    // Attempt to hire candidate 2 (capacity exceeded!)
    const failHire = await request(app)
      .patch(`/api/v1/applications/manage/${app2._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    expect(failHire.status).toBe(409);
    expect(failHire.body.message).toMatch(/capacity/i);
  });

  it('5 & 6 — Auto-reopens job if a hired candidate is cancelled and capacity frees up', async () => {
    const recruiter = await User.create({
      fullName: 'Reopen Admin',
      email: 'reopen@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Reopen Corp',
      slug: 'reopen-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter._id,
      role: 'owner',
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
      status: 'active',
    });
    await RecruiterProfile.create({
      user: recruiter._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
    });

    const token = generateAccessToken(recruiter.id);

    const job = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'QA Engineer',
      slug: 'qa-engineer',
      description: 'QA position.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Vitest', required: true, weight: 100 }],
      openings: 1,
      applicationDeadline: new Date(Date.now() + 86400000),
      status: 'published',
    });

    const cand1 = await User.create({ fullName: 'QA Cand', email: 'qa@test.com', role: 'candidate' });
    const app1 = await createMockApp({ candidate: cand1, job, company, appNumber: 'APP-201' });

    // Hire -> Auto close
    await request(app)
      .patch(`/api/v1/applications/manage/${app1._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    let checkJob = await Job.findById(job._id);
    expect(checkJob.status).toBe('closed');
    expect(checkJob.closedReason).toBe('capacity_reached');

    const adminUser = await User.create({ fullName: 'System Admin', email: 'admin@system.test', role: 'admin' });
    const adminToken = generateAccessToken(adminUser.id);

    // Cancel hire (transition away from hired to rejected using admin override)
    const cancelRes = await request(app)
      .patch(`/api/v1/applications/admin/${app1._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'Candidate declined offer prior to start' });

    expect(cancelRes.status).toBe(200);

    // Job should be auto-reopened
    checkJob = await Job.findById(job._id);
    expect(checkJob.status).toBe('published');
    expect(checkJob.closedReason).toBe('');

    // Check AuditLog for job.reopen
    const reopenAudit = await AuditLog.findOne({ action: 'job.reopen', company: company._id });
    expect(reopenAudit).toBeDefined();
    expect(reopenAudit.newValue.trigger).toBe('hiring_capacity_freed');
  });

  it('4 — Prevents over-hiring under simultaneous Promise.all concurrent requests', async () => {
    const recruiter = await User.create({
      fullName: 'Concurrent Admin',
      email: 'concurrent@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Concurrent Corp',
      slug: 'concurrent-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter._id,
      role: 'owner',
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
      status: 'active',
    });
    await RecruiterProfile.create({
      user: recruiter._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.create', 'applications.view', 'applications.manage'],
    });

    const token = generateAccessToken(recruiter.id);

    const job = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'High Concurrency Engineer',
      slug: 'high-concurrency-engineer',
      description: 'Single opening tested under concurrent requests.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Node.js', required: true, weight: 100 }],
      openings: 1,
      hiredCount: 0,
      applicationDeadline: new Date(Date.now() + 86400000),
      status: 'published',
      publishedAt: new Date(),
    });

    const cand1 = await User.create({ fullName: 'Conc Cand 1', email: 'conc1@test.com', role: 'candidate' });
    const cand2 = await User.create({ fullName: 'Conc Cand 2', email: 'conc2@test.com', role: 'candidate' });

    const app1 = await createMockApp({ candidate: cand1, job, company, appNumber: 'APP-301' });
    const app2 = await createMockApp({ candidate: cand2, job, company, appNumber: 'APP-302' });

    // Execute simultaneous hire requests
    const results = await Promise.all([
      request(app)
        .patch(`/api/v1/applications/manage/${app1._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'hired' }),
      request(app)
        .patch(`/api/v1/applications/manage/${app2._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'hired' }),
    ]);

    const statusCodes = results.map((r) => r.status).sort();
    expect(statusCodes).toEqual([200, 409]);

    const finalJob = await Job.findById(job._id);
    expect(finalJob.hiredCount).toBe(1);
    expect(finalJob.status).toBe('closed');
    expect(finalJob.closedReason).toBe('capacity_reached');
  });

  it('5 — Manual closure prevents automatic reopening on candidate cancellation', async () => {
    const recruiter = await User.create({
      fullName: 'Manual Close Admin',
      email: 'manual@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Manual Close Corp',
      slug: 'manual-close-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });
    await CompanyMember.create({
      company: company._id,
      recruiter: recruiter._id,
      role: 'owner',
      permissions: ['jobs.create', 'applications.view', 'applications.manage', 'jobs.update', 'jobs.publish'],
      status: 'active',
    });
    await RecruiterProfile.create({
      user: recruiter._id,
      company: company._id,
      isApproved: true,
      permissions: ['jobs.create', 'applications.view', 'applications.manage', 'jobs.update', 'jobs.publish'],
    });

    const token = generateAccessToken(recruiter.id);

    const job = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'Manually Closed Role',
      slug: 'manually-closed-role',
      description: 'Role manually closed.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'React', required: true, weight: 100 }],
      openings: 2,
      hiredCount: 0,
      applicationDeadline: new Date(Date.now() + 86400000),
      status: 'published',
    });

    const cand1 = await User.create({ fullName: 'Manual Cand', email: 'mcand@test.com', role: 'candidate' });
    const app1 = await createMockApp({ candidate: cand1, job, company, appNumber: 'APP-401' });

    // Hire candidate 1
    await request(app)
      .patch(`/api/v1/applications/manage/${app1._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    // Recruiter manually closes the job
    const closeRes = await request(app)
      .patch(`/api/v1/jobs/manage/${job._id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Manual pause on department expansion' });

    expect(closeRes.status).toBe(200);

    const closedJob = await Job.findById(job._id);
    expect(closedJob.status).toBe('closed');
    expect(closedJob.closedReason).toBe('manual');

    // Admin cancels candidate hire
    const adminUser = await User.create({ fullName: 'Admin User 2', email: 'admin2@system.test', role: 'admin' });
    const adminToken = generateAccessToken(adminUser.id);

    await request(app)
      .patch(`/api/v1/applications/admin/${app1._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', reason: 'Candidate withdrew' });

    // Job MUST remain closed because closedReason === 'manual'
    const checkJob = await Job.findById(job._id);
    expect(checkJob.status).toBe('closed');
    expect(checkJob.closedReason).toBe('manual');
  });

  it('6 — Scheduled closeExpiredJobs automatically closes published jobs with passed deadline', async () => {
    const recruiter = await User.create({
      fullName: 'Expiry Admin',
      email: 'expiry@capacity.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });
    const company = await Company.create({
      name: 'Expiry Corp',
      slug: 'expiry-corp',
      verificationStatus: 'verified',
      owner: recruiter._id,
    });

    // Create job with expired deadline
    const expiredJob = await Job.create({
      company: company._id,
      createdBy: recruiter._id,
      title: 'Expired Job Opening',
      slug: 'expired-job-opening',
      description: 'Deadline passed.',
      employmentType: 'full-time',
      workMode: 'remote',
      skills: [{ name: 'Python', required: true, weight: 100 }],
      openings: 3,
      applicationDeadline: new Date(Date.now() - 3600000), // Passed 1 hour ago
      status: 'published',
      publishedAt: new Date(Date.now() - 86400000),
    });

    const closedCount = await closeExpiredJobs();
    expect(closedCount).toBe(1);

    const checkJob = await Job.findById(expiredJob._id);
    expect(checkJob.status).toBe('closed');
    expect(checkJob.closedReason).toBe('deadline_expired');

    const audit = await AuditLog.findOne({ action: 'job.auto_close', company: company._id });
    expect(audit).toBeDefined();
    expect(audit.newValue.closedReason).toBe('deadline_expired');
  });
});
