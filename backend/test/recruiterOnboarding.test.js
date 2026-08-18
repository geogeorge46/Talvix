import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;

const validJob = () => ({
  title: 'Backend Engineer',
  description: 'Build reliable recruitment services.',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{
    name: 'Node.js',
    required: true,
    minimumProficiency: 'advanced',
    minimumYearsOfExperience: 3,
    weight: 80
  }],
  salary: {
    minimum: 80000,
    maximum: 120000,
    currency: 'USD',
    period: 'yearly',
    isVisible: false
  },
  minimumExperience: 2,
  maximumExperience: 6,
  openings: 2,
  applicationDeadline: new Date(Date.now() + 7 * 86_400_000).toISOString()
});

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await CompanyMember.init();
  await RecruiterProfile.init();
  await AuditLog.init();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Recruiter Onboarding & Verification Flow', () => {
  it('Test 1 — Registration defaults recruiterVerificationStatus to none', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Recruiter 1',
        email: 'recruiter1@talvix.test',
        password: 'Password123!',
        role: 'recruiter',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const user = await User.findOne({ email: 'recruiter1@talvix.test' });
    expect(user).toBeDefined();
    expect(user.recruiterVerificationStatus).toBe('none');
  });

  it('Test 2 — Login succeeds when status is none', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Recruiter 2',
        email: 'recruiter2@talvix.test',
        password: 'Password123!',
        role: 'recruiter',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'recruiter2@talvix.test',
        password: 'Password123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.recruiterVerificationStatus).toBe('none');
  });

  it('Test 3 & 4 — Onboarding profile patch, company creation and verification submission', async () => {
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Test Recruiter 3',
        email: 'recruiter3@talvix.test',
        password: 'Password123!',
        role: 'recruiter',
      });

    expect(regRes.status).toBe(201);
    const token = generateAccessToken(regRes.body.data.user._id);

    // Complete profile
    const profileRes = await request(app)
      .patch('/api/v1/recruiters/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        designation: 'Talent Lead',
        phone: '+1-555-0199',
        linkedinUrl: 'https://linkedin.com/in/test-recruiter',
        bio: 'Specialist IT recruiter',
      });

    expect(profileRes.status).toBe(200);

    // Create Company
    const companyRes = await request(app)
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Acme Corp',
        website: 'https://acme.test',
        email: 'jobs@acme.test',
        industry: 'Software',
        companySize: '11-50',
      });

    expect(companyRes.status).toBe(201);
    expect(companyRes.body.data.company.verificationStatus).toBe('none');

    // Submit for Verification
    const submitRes = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.recruiterVerificationStatus).toBe('pending');
    expect(submitRes.body.data.companyVerificationStatus).toBe('pending');

    const updatedUser = await User.findById(regRes.body.data.user._id);
    expect(updatedUser.recruiterVerificationStatus).toBe('pending');

    const updatedCompany = await Company.findById(companyRes.body.data.company._id);
    expect(updatedCompany.verificationStatus).toBe('pending');

    // Test 8 — Unauthorized Business Access (Pending recruiter is forbidden from restricted operations)
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validJob());
    expect(jobRes.status).toBe(403);
  });

  it('Test 5, 6 & 7 — Admin Approval, Company Verification and Business Access', async () => {
    // 1. Create recruiter
    const user = await User.create({
      fullName: 'Approved Recruiter',
      email: 'verified@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'pending',
    });

    const company = await Company.create({
      name: 'Alpha Inc',
      slug: 'alpha-inc',
      verificationStatus: 'pending',
      owner: user._id,
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: 'provisional_admin',
      permissions: ['jobs.create', 'jobs.update', 'jobs.publish'],
      status: 'active',
    });

    const profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'Director of Talent',
      permissions: ['jobs.create', 'jobs.update', 'jobs.publish'],
    });

    const token = generateAccessToken(user.id);

    // Create an Admin user
    const admin = await User.create({
      fullName: 'Admin User',
      email: 'admin@talvix.test',
      role: 'admin',
    });
    const adminToken = generateAccessToken(admin.id);

    // Admin approves Recruiter
    const approveRes = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Legitimate recruiter' });

    expect(approveRes.status).toBe(200);

    const checkUser = await User.findById(user._id);
    expect(checkUser.recruiterVerificationStatus).toBe('verified');

    const checkProfile = await RecruiterProfile.findOne({ user: user._id });
    expect(checkProfile.isApproved).toBe(true);

    // Admin verifies Company
    const verifyCompanyRes = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Company verification approved.' });

    expect(verifyCompanyRes.status).toBe(200);

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('verified');

    // Test 7 — Business Access Allowed
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validJob());

    expect(jobRes.status).toBe(201);
  });

  it('Test 9 — Rejection, Correction, and Resubmission', async () => {
    const user = await User.create({
      fullName: 'Rejected Recruiter',
      email: 'rejected@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'pending',
    });

    const company = await Company.create({
      name: 'Beta Corp',
      slug: 'beta-corp',
      verificationStatus: 'pending',
      owner: user._id,
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: 'provisional_admin',
      permissions: ['jobs.create'],
      status: 'active',
    });

    const profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'Tech Sourcer',
      permissions: ['jobs.create'],
    });

    const admin = await User.create({
      fullName: 'Admin User',
      email: 'admin2@talvix.test',
      role: 'admin',
    });
    const adminToken = generateAccessToken(admin.id);
    const token = generateAccessToken(user.id);

    // Admin rejects recruiter
    const rejectRes = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Official domain does not match email.' });

    expect(rejectRes.status).toBe(200);

    const checkUser = await User.findById(user._id);
    expect(checkUser.recruiterVerificationStatus).toBe('rejected');

    const checkProfile = await RecruiterProfile.findOne({ user: user._id });
    expect(checkProfile.isApproved).toBe(false);
    expect(checkProfile.rejectionReason).toBe('Official domain does not match email.');

    // Recruiter corrects details
    const patchRes = await request(app)
      .patch('/api/v1/recruiters/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        designation: 'Tech Sourcer',
        phone: '+1-555-9000',
        linkedinUrl: 'https://linkedin.com/in/corrected',
      });
    expect(patchRes.status).toBe(200);

    // Resubmits for verification
    const resubmitRes = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(resubmitRes.status).toBe(200);

    const recheckUser = await User.findById(user._id);
    expect(recheckUser.recruiterVerificationStatus).toBe('pending');
  });

  it('Test 10 — Company Suspension blocks business access', async () => {
    const user = await User.create({
      fullName: 'Approved Recruiter 2',
      email: 'verified2@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });

    const company = await Company.create({
      name: 'Gamma Inc',
      slug: 'gamma-inc',
      verificationStatus: 'verified',
      owner: user._id,
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: 'provisional_admin',
      permissions: ['jobs.create'],
      status: 'active',
    });

    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'Head of Staffing',
      isApproved: true,
      permissions: ['jobs.create'],
    });

    const admin = await User.create({
      fullName: 'Admin User',
      email: 'admin3@talvix.test',
      role: 'admin',
    });
    const adminToken = generateAccessToken(admin.id);
    const token = generateAccessToken(user.id);

    // Suspend company
    const suspendCompanyRes = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Company suspended for validation fail.' });

    expect(suspendCompanyRes.status).toBe(200);

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('suspended');

    // Post job should be blocked (revoked session returns 401, or unauthorized returns 403)
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validJob());

    expect([401, 403]).toContain(jobRes.status);
  });
});
