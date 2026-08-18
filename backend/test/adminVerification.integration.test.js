import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
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
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    RecruiterProfile.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Admin Verification & Authorization API Guard Tests', () => {
  it('Edge Case 1 — Normal recruiter cannot access Admin management endpoints (403)', async () => {
    const user = await User.create({
      fullName: 'Regular Recruiter',
      email: 'recruiter@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });

    const token = generateAccessToken(user.id);

    // Call admin pending recruiters list
    const res = await request(app)
      .get('/api/v1/recruiters/admin/pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('Edge Case 2 — Unauthenticated requests are rejected with 401', async () => {
    // Submit verification without token
    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification');

    expect(res.status).toBe(401);
  });

  it('Edge Case 3 — Duplicate submissions are rejected with 400', async () => {
    const user = await User.create({
      fullName: 'Pending Recruiter',
      email: 'pending@talvix.test',
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
      permissions: ['jobs.create'],
      status: 'active',
    });

    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'Director of Talent',
    });

    const token = generateAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Verification request is already pending');
  });

  it('Edge Case 4 — Recruiter cannot submit verification without designation/profile completion', async () => {
    const user = await User.create({
      fullName: 'No Profile Recruiter',
      email: 'noprofile@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'none',
    });

    const company = await Company.create({
      name: 'Alpha Inc',
      slug: 'alpha-inc',
      verificationStatus: 'none',
      owner: user._id,
    });

    await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: 'provisional_admin',
      status: 'active',
    });

    // Profile exists but designation is empty
    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: '',
    });

    const token = generateAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Please complete step 1');
  });

  it('Edge Case 5 — Recruiter cannot submit verification without company link', async () => {
    const user = await User.create({
      fullName: 'No Company Recruiter',
      email: 'nocompany@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'none',
    });

    // Profile exists with designation, but no company
    await RecruiterProfile.create({
      user: user._id,
      company: null,
      designation: 'Lead recruiter',
    });

    const token = generateAccessToken(user._id);

    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Please complete step 2');
  });

  it('Edge Case 6 — Verified Recruiter + Unverified Company blocks business access', async () => {
    const user = await User.create({
      fullName: 'Verified Recruiter',
      email: 'rec@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus: 'verified',
    });

    // Company is still 'none' or 'pending'
    const company = await Company.create({
      name: 'Beta Inc',
      slug: 'beta-inc',
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

    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'Staffer',
      isApproved: true,
      permissions: ['jobs.create'],
    });

    const token = generateAccessToken(user._id);

    // Business action should return 403 because company is not verified
    const res = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(validJob());

    expect(res.status).toBe(403);
  });
});
