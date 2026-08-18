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
import { CompanyVerificationHistory } from '../src/models/CompanyVerificationHistory.js';
import { RecruiterVerificationHistory } from '../src/models/RecruiterVerificationHistory.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;

const validJob = () => ({
  title: 'Senior MERN Developer',
  description: 'Write modular monolith recruiter services.',
  employmentType: 'full-time',
  workMode: 'remote',
  skills: [{
    name: 'Node.js',
    required: true,
    minimumProficiency: 'advanced',
    minimumYearsOfExperience: 5,
    weight: 100
  }],
  salary: {
    minimum: 120000,
    maximum: 180000,
    currency: 'USD',
    period: 'yearly',
    isVisible: true
  },
  minimumExperience: 4,
  maximumExperience: 8,
  openings: 1,
  applicationDeadline: new Date(Date.now() + 10 * 86_400_000).toISOString()
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

describe('Dual Verification Integration and Edge Case Tests', () => {
  const createBaseSetup = async (recruiterVerificationStatus = 'none', companyVerificationStatus = 'none') => {
    const user = await User.create({
      fullName: 'Recruiter Bob',
      email: 'bob@talvix.test',
      role: 'recruiter',
      recruiterVerificationStatus,
    });

    const company = await Company.create({
      name: 'Bob Enterprise',
      slug: 'bob-enterprise',
      verificationStatus: companyVerificationStatus,
      owner: user._id,
    });

    const profile = await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      designation: 'VP of Recruiting',
      isApproved: recruiterVerificationStatus === 'verified',
      permissions: ['company.manage'],
    });

    const membership = await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: 'provisional_admin',
      permissions: ['jobs.create', 'jobs.update', 'jobs.publish', 'company.manage'],
      status: 'active',
    });

    const admin = await User.create({
      fullName: 'System Administrator',
      email: 'admin@talvix.test',
      role: 'admin',
    });

    const userToken = generateAccessToken(user._id);
    const adminToken = generateAccessToken(admin._id);

    return { user, company, profile, membership, admin, userToken, adminToken };
  };

  it('Test 1 — Recruiter pending + company pending after verification submission', async () => {
    const { userToken } = await createBaseSetup('none', 'none');

    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recruiterVerificationStatus).toBe('pending');
    expect(res.body.data.companyVerificationStatus).toBe('pending');

    const checkUser = await User.findOne({ email: 'bob@talvix.test' });
    expect(checkUser.recruiterVerificationStatus).toBe('pending');

    const checkCompany = await Company.findOne({ slug: 'bob-enterprise' });
    expect(checkCompany.verificationStatus).toBe('pending');
  });

  it('Test 2 — Recruiter pending + company rejected (admin rejects company, requires reason)', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');

    // Reject company with empty reason should fail (400)
    const failRes = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: '' });

    expect(failRes.status).toBe(400);

    // Reject company with valid reason succeeds
    const successRes = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Invalid website provided.' });

    expect(successRes.status).toBe(200);

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('rejected');
    expect(checkCompany.rejectionReason).toBe('Invalid website provided.');
  });

  it('Test 3 — Recruiter rejected + company pending (admin rejects recruiter, requires reason)', async () => {
    const { adminToken, profile } = await createBaseSetup('pending', 'pending');

    // Reject recruiter with empty reason should fail (400)
    const failRes = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' });

    expect(failRes.status).toBe(400);

    // Reject recruiter with valid reason succeeds
    const successRes = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Identity matches spam blacklist.' });

    expect(successRes.status).toBe(200);

    const checkProfile = await RecruiterProfile.findById(profile._id);
    expect(checkProfile.isApproved).toBe(false);
    expect(checkProfile.rejectionReason).toBe('Identity matches spam blacklist.');
  });

  it('Test 4 — Recruiter rejected + company rejected', async () => {
    const { profile, company, adminToken } = await createBaseSetup('pending', 'pending');

    await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Recruiter identity rejected' });

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Company rejected' });

    const checkUser = await User.findOne({ email: 'bob@talvix.test' });
    expect(checkUser.recruiterVerificationStatus).toBe('rejected');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('rejected');
  });

  it('Test 5 — Recruiter verified + company pending', async () => {
    const { profile, adminToken } = await createBaseSetup('pending', 'pending');

    const res = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Good candidate' });

    expect(res.status).toBe(200);

    const checkUser = await User.findOne({ email: 'bob@talvix.test' });
    expect(checkUser.recruiterVerificationStatus).toBe('verified');

    const checkCompany = await Company.findOne({ slug: 'bob-enterprise' });
    expect(checkCompany.verificationStatus).toBe('pending');
  });

  it('Test 6 — Recruiter verified + company rejected', async () => {
    const { profile, company, adminToken } = await createBaseSetup('pending', 'pending');

    await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Identity validated' });

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Business address is residential' });

    const checkUser = await User.findOne({ email: 'bob@talvix.test' });
    expect(checkUser.recruiterVerificationStatus).toBe('verified');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('rejected');
  });

  it('Test 7 — Recruiter verified + company verified', async () => {
    const { profile, company, adminToken } = await createBaseSetup('pending', 'pending');

    await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Approved identity' });

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verified company' });

    const checkUser = await User.findOne({ email: 'bob@talvix.test' });
    expect(checkUser.recruiterVerificationStatus).toBe('verified');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('verified');
  });

  it('Test 8 & 9 — Company rejection reason is saved and returned to recruiter', async () => {
    const { userToken, adminToken, company } = await createBaseSetup('pending', 'pending');

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Spam organization domain.' });

    // Recruiter fetches own profile
    const profileRes = await request(app)
      .get('/api/v1/recruiters/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.profile.company.rejectionReason).toBe('Spam organization domain.');
    expect(profileRes.body.data.profile.company.verificationStatus).toBe('rejected');
  });

  it('Test 10 & 11 — Rejected company can be resubmitted and clears reasons', async () => {
    const { userToken, adminToken, company, profile } = await createBaseSetup('pending', 'pending');

    // Admin rejects both recruiter and company
    await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Ident spam' });

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Comp spam' });

    // Recruiter resubmits verification
    const res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.recruiterVerificationStatus).toBe('pending');
    expect(res.body.data.companyVerificationStatus).toBe('pending');

    const checkProfile = await RecruiterProfile.findById(profile._id);
    expect(checkProfile.rejectionReason).toBe('');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.rejectionReason).toBe('');
    expect(checkCompany.verificationStatus).toBe('pending');
  });

  it('Test 12 — Business APIs remain blocked while company is rejected', async () => {
    const { userToken, company, adminToken } = await createBaseSetup('verified', 'pending');

    // Admin rejects company
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Failed background check' });

    // Recruiter attempts to post a job
    const jobRes = await request(app)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${userToken}`)
      .send(validJob());

    expect(jobRes.status).toBe(403);
    expect(jobRes.body.message).toContain('You do not have the required company permission');
  });

  it('Test 13 — Recruiter can edit rejected company, resets status to pending and clears reason', async () => {
    const { userToken, company, adminToken } = await createBaseSetup('verified', 'pending');

    // Admin rejects company
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Invalid tax ID.' });

    // Recruiter updates company details
    const res = await request(app)
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Corrected Bob Enterprise',
        website: 'https://bobcorrected.example.com',
        industry: 'Software Engineering',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.company.verificationStatus).toBe('pending');
    expect(res.body.data.company.rejectionReason).toBe('');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('pending');
    expect(checkCompany.rejectionReason).toBe('');
    expect(checkCompany.name).toBe('Corrected Bob Enterprise');
  });

  it('Test 14 — Recruiter cannot edit another company details', async () => {
    // Recruiter without company membership
    const rogueUser = await User.create({
      fullName: 'Rogue Recruiter',
      email: 'rogue@talvix.test',
      role: 'recruiter',
    });
    await RecruiterProfile.create({
      user: rogueUser._id,
    });
    const rogueToken = generateAccessToken(rogueUser._id);

    const res = await request(app)
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${rogueToken}`)
      .send({ name: 'Hacked Enterprise' });

    expect(res.status).toBe(403);
  });

  it('Test 15 — Full status transitions lifecycle (none -> pending -> rejected -> pending -> verified -> suspended)', async () => {
    const { userToken, adminToken, company } = await createBaseSetup('none', 'none');

    // 1. none -> pending (resubmission/submission)
    let res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.companyVerificationStatus).toBe('pending');

    // 2. pending -> rejected
    res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Rejected for review' });
    expect(res.status).toBe(200);

    // 3. rejected -> pending (recruiter edits company)
    res = await request(app)
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'New name', industry: 'New industry' });
    expect(res.status).toBe(200);
    expect(res.body.data.company.verificationStatus).toBe('pending');

    // 4. pending -> verified
    res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Looks good now' });
    expect(res.status).toBe(200);

    // 5. verified -> suspended
    res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Violation of policy' });
    expect(res.status).toBe(200);

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.verificationStatus).toBe('suspended');
  });

  it('Test 16 — Company email domain is derived and returned correctly', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');
    
    // Check if get detail derives domain from owner email
    const res = await request(app)
      .get(`/api/v1/admin/management/companies/${company._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.officialEmailDomain).toBe('talvix.test');
  });

  it('Test 17 — Pending company does not show verifiedAt or other transition metadata', async () => {
    const { company } = await createBaseSetup('pending', 'pending');
    expect(company.verifiedAt).toBeNull();
    expect(company.verifiedBy).toBeNull();
    expect(company.rejectedAt).toBeNull();
    expect(company.rejectedBy).toBeNull();
    expect(company.suspendedAt).toBeNull();
    expect(company.suspendedBy).toBeNull();
  });

  it('Test 18 — Verified, Rejected, and Suspended states show proper metadata', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');

    // 1. Verify company
    let res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verified OK' });
    expect(res.status).toBe(200);

    let checkCompany = await Company.findById(company._id);
    expect(checkCompany.verifiedBy).toBeDefined();
    expect(checkCompany.verifiedAt).toBeDefined();
    expect(checkCompany.rejectedAt).toBeNull();
    expect(checkCompany.suspendedAt).toBeNull();

    // 2. Suspend company
    res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Policy violation' });
    expect(res.status).toBe(200);

    checkCompany = await Company.findById(company._id);
    expect(checkCompany.suspendedBy).toBeDefined();
    expect(checkCompany.suspendedAt).toBeDefined();
    expect(checkCompany.verifiedAt).toBeNull();

    // 3. Reject company (move it back to pending first to reject)
    checkCompany.verificationStatus = 'pending';
    await checkCompany.save();

    res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Invalid proof document' });
    expect(res.status).toBe(200);

    checkCompany = await Company.findById(company._id);
    expect(checkCompany.rejectedBy).toBeDefined();
    expect(checkCompany.rejectedAt).toBeDefined();
    expect(checkCompany.verifiedAt).toBeNull();
    expect(checkCompany.suspendedAt).toBeNull();
  });

  it('Test 19 — Company rejection requires a reason', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');

    const res = await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Rejection reason is required');
  });

  it('Test 20 — Status transitions log correct history timeline actions', async () => {
    const { userToken, adminToken, company } = await createBaseSetup('none', 'none');

    // 1. Submit (none -> pending)
    await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer ${userToken}`);

    // 2. Reject (pending -> rejected)
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Wrong address' });

    // 3. Resubmit/Update (rejected -> pending)
    await request(app)
      .patch('/api/v1/companies/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Bob Inc.' });

    // 4. Verify (pending -> verified)
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verified OK' });

    // 5. Suspend (verified -> suspended)
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Spamming' });

    // 6. Restore (suspended -> verified)
    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Restored corporate' });

    // Fetch history
    const history = await CompanyVerificationHistory.find({ companyId: company._id }).sort({ timestamp: 1 });
    expect(history.length).toBe(6);
    expect(history[0].action).toBe('verification.submitted');
    expect(history[1].action).toBe('verification.rejected');
    expect(history[1].reason).toBe('Wrong address');
    expect(history[2].action).toBe('verification.resubmitted');
    expect(history[3].action).toBe('verification.approved');
    expect(history[4].action).toBe('verification.suspended');
    expect(history[5].action).toBe('verification.restored');

    const checkCompany = await Company.findById(company._id);
    expect(checkCompany.rejectionReason).toBe('');
  });

  it('Test 21 — Admin can retrieve verification history successfully with pagination', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');

    await CompanyVerificationHistory.create({
      companyId: company._id,
      action: 'verification.submitted',
      previousStatus: 'none',
      newStatus: 'pending',
      performedBy: company.owner,
      performedByName: 'Bob Recruiter',
    });

    const res = await request(app)
      .get(`/api/v1/admin/management/companies/${company._id}/verification-history?limit=10&page=1`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].action).toBe('verification.submitted');
    expect(res.body.data.items[0].performedBy.name).toBe('Bob Recruiter');
    expect(res.body.data.pagination).toBeDefined();
  });

  it('Test 22 — Unauthorized users cannot retrieve verification history', async () => {
    const { userToken, company } = await createBaseSetup('pending', 'pending');

    const res = await request(app)
      .get(`/api/v1/admin/management/companies/${company._id}/verification-history`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('Test 23 — Existing enterprise AuditLog events continue working', async () => {
    const { adminToken, company } = await createBaseSetup('pending', 'pending');

    const countBefore = await AuditLog.countDocuments({ company: company._id });

    await request(app)
      .patch(`/api/v1/companies/admin/${company._id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'Verify OK' });

    const countAfter = await AuditLog.countDocuments({ company: company._id });
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  it('Test 24 — Recruiter verification history, transitions, detail population, and admin history query', async () => {
    const { userToken, adminToken, user, profile } = await createBaseSetup('none', 'none');

    // 1. Submit recruiter verification (none -> pending)
    let res = await request(app)
      .post('/api/v1/recruiters/me/submit-verification')
      .set('Authorization', `Bearer={userToken}`) // Note: base setup token is set correctly
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);

    const rUserSubmit = await User.findById(user._id);
    expect(rUserSubmit.recruiterVerificationStatus).toBe('pending');

    // Check recruiter history contains verification.submitted
    let history = await RecruiterVerificationHistory.find({ recruiterId: user._id }).sort({ timestamp: 1 });
    expect(history.length).toBe(1);
    expect(history[0].action).toBe('verification.submitted');

    // 2. Reject recruiter verification (pending -> rejected)
    res = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Invalid credentials document' });
    expect(res.status).toBe(200);

    const rUserReject = await User.findById(user._id);
    expect(rUserReject.recruiterVerificationStatus).toBe('rejected');

    history = await RecruiterVerificationHistory.find({ recruiterId: user._id }).sort({ timestamp: 1 });
    expect(history.length).toBe(2);
    expect(history[1].action).toBe('verification.rejected');
    expect(history[1].reason).toBe('Invalid credentials document');

    // 3. Approve recruiter (rejected -> verified)
    res = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);

    const rUserApprove = await User.findById(user._id).select('+isActive');
    expect(rUserApprove.recruiterVerificationStatus).toBe('verified');
    expect(rUserApprove.isActive).toBe(true);

    history = await RecruiterVerificationHistory.find({ recruiterId: user._id }).sort({ timestamp: 1 });
    expect(history[3 - 1].action).toBe('verification.approved');

    // 4. Suspend recruiter (verified -> suspended)
    res = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Malicious posting behavior' });
    expect(res.status).toBe(200);

    const rUserSuspend = await User.findById(user._id).select('+isActive');
    expect(rUserSuspend.recruiterVerificationStatus).toBe('suspended');
    expect(rUserSuspend.isActive).toBe(false);

    history = await RecruiterVerificationHistory.find({ recruiterId: user._id }).sort({ timestamp: 1 });
    expect(history[4 - 1].action).toBe('verification.suspended');
    expect(history[4 - 1].reason).toBe('Malicious posting behavior');

    // 5. Restore recruiter (suspended -> verified)
    res = await request(app)
      .patch(`/api/v1/recruiters/admin/${profile._id}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);

    const rUserRestore = await User.findById(user._id).select('+isActive');
    expect(rUserRestore.recruiterVerificationStatus).toBe('verified');
    expect(rUserRestore.isActive).toBe(true);

    history = await RecruiterVerificationHistory.find({ recruiterId: user._id }).sort({ timestamp: 1 });
    expect(history[5 - 1].action).toBe('verification.restored');

    // 6. Test Admin Recruiter detail API populates tracking fields and membership details
    res = await request(app)
      .get(`/api/v1/admin/management/recruiters/${profile._id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.recruiterVerificationStatus).toBe('verified');
    expect(res.body.data.approvedBy).toBeDefined();
    expect(res.body.data.restoredBy).toBeDefined();
    expect(res.body.data.membership).toBeDefined();

    // 7. Test Admin Recruiter verification history endpoint
    res = await request(app)
      .get(`/api/v1/admin/management/recruiters/${profile._id}/verification-history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(5);
    expect(res.body.data.items[0].action).toBe('verification.restored'); // sorted desc (newest first)
  });
});
