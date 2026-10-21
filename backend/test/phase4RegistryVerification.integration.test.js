import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CompanyRegistryCheck } from '../src/models/CompanyRegistryCheck.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { isValidCIN, isValidGSTIN, isValidUdyam } from '../src/utils/formatValidation.js';
import { isFuzzyNameMatch, normalizeCompanyName } from '../src/services/registryVerification.service.js';

let replicaSet;
let sequence = 0;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    Company.init(),
    CompanyMember.init(),
    RecruiterProfile.init(),
    CompanyRegistryCheck.init(),
    AuditLog.init()
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
});

describe('Phase 4: Business Registry Verification & Fraud Risk Checks Integration', () => {
  let adminToken;
  let adminUser;
  let recruiterToken;
  let recruiterUser;
  let testCompany;

  beforeEach(async () => {
    sequence += 1;
    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      CompanyMember.deleteMany({}),
      RecruiterProfile.deleteMany({}),
      CompanyRegistryCheck.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    // 1. Create Admin User (register as recruiter then promote to admin)
    const adminRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: `Admin ${sequence}`,
        email: `admin.${sequence}@talvix.admin`,
        password: 'Password123!',
        role: 'recruiter'
      });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.data.accessToken;
    adminUser = adminRes.body.data.user;
    await User.findByIdAndUpdate(adminUser._id || adminUser.id, { role: 'admin' });

    // 2. Create Recruiter User & Company
    const recruiterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: `Recruiter Alex ${sequence}`,
        email: `recruiter.${sequence}@acmecorp${sequence}.com`,
        password: 'Password123!',
        role: 'recruiter'
      });
    expect(recruiterRes.status).toBe(201);
    recruiterToken = recruiterRes.body.data.accessToken;
    recruiterUser = recruiterRes.body.data.user;

    await RecruiterProfile.updateOne(
      { user: recruiterUser._id || recruiterUser.id },
      { $set: { isApproved: true, verificationStatus: 'verified' } }
    );

    const companyRes = await request(app)
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        name: `Acme Technologies ${sequence}`,
        officialEmailDomain: `acmecorp${sequence}.com`,
        legalName: `Acme Technologies Private Limited ${sequence}`,
        entityType: 'private_limited',
        cin: 'U72200MH2020PTC123456',
        gstin: '27AAPCU1234P1ZV',
        udyamRegistrationNumber: 'UDYAM-MH-01-0012345'
      });
    expect(companyRes.status).toBe(201);
    testCompany = companyRes.body.data.company;
  });

  describe('Format Validation & String Normalization Utilities', () => {
    it('validates CIN, GSTIN, and Udyam formats accurately', () => {
      expect(isValidCIN('U72200MH2020PTC123456')).toBe(true);
      expect(isValidCIN('INVALID-CIN')).toBe(false);

      expect(isValidCIN('AAA-1234')).toBe(true); // Valid LLPIN pattern

      expect(isValidGSTIN('27AAPCU1234P1ZV')).toBe(true);
      expect(isValidGSTIN('INVALID-GSTIN')).toBe(false);

      expect(isValidUdyam('UDYAM-MH-01-0012345')).toBe(true);
      expect(isValidUdyam('INVALID-UDYAM')).toBe(false);
    });

    it('performs fuzzy legal name matching ignoring punctuation and corporate suffixes', () => {
      expect(normalizeCompanyName('Acme Technologies Pvt. Ltd.')).toBe('acme technologies');
      expect(isFuzzyNameMatch('Acme Technologies Pvt Ltd', 'Acme Technologies Private Limited')).toBe(true);
      expect(isFuzzyNameMatch('Acme Technologies Inc', 'Global Solutions Corp')).toBe(false);
    });
  });

  describe('Admin Registry Verification Execution', () => {
    it('executes a registry check and records outcome without changing company verification status', async () => {
      const runRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'company_registration',
          provider: 'mock_registry'
        });

      expect(runRes.status).toBe(201);
      expect(runRes.body.success).toBe(true);
      const check = runRes.body.data.check;

      expect(check.companyId).toBe(testCompany._id);
      expect(check.checkType).toBe('company_registration');
      expect(check.outcome).toBe('match');
      expect(check.matchedFields).toContain('legalName');
      expect(check.riskScore).toBe(0);

      // Verify Company verificationStatus remains unchanged at 'none' (Authoritative rule!)
      const dbCompany = await Company.findById(testCompany._id);
      expect(dbCompany.verificationStatus).toBe('none');

      // Verify audit log entry
      const auditLog = await AuditLog.findOne({ action: 'company.registry_check_performed', company: testCompany._id });
      expect(auditLog).not.toBeNull();
    });

    it('detects name mismatches and calculates explainable risk indicators', async () => {
      await Company.findByIdAndUpdate(testCompany._id, {
        cin: 'MISMATCH-U72200MH2020PTC123456',
        legalName: 'Completely Unrelated Name Inc'
      });

      const runRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'company_registration',
          provider: 'mock_registry',
          options: { simulateMismatch: true }
        });

      expect(runRes.status).toBe(201);
      const check = runRes.body.data.check;

      expect(check.outcome).toBe('mismatch');
      expect(check.mismatchedFields.some((f) => f.field === 'legalName')).toBe(true);
      expect(check.riskIndicators.some((r) => r.code === 'REGISTRY_NAME_MISMATCH')).toBe(true);
      expect(check.riskScore).toBeGreaterThan(0);
    });

    it('handles provider outages (unavailable) without rejecting or altering company status', async () => {
      const runRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'company_registration',
          provider: 'mock_registry',
          options: { simulateUnavailable: true }
        });

      expect(runRes.status).toBe(201);
      const check = runRes.body.data.check;
      expect(check.outcome).toBe('unavailable');
      expect(check.riskIndicators.some((r) => r.code === 'REGISTRY_UNAVAILABLE')).toBe(true);

      // Verify company status was NOT changed to rejected or suspended
      const dbCompany = await Company.findById(testCompany._id);
      expect(dbCompany.verificationStatus).toBe('none');
    });

    it('retrieves all registry checks for a company for admin inspection', async () => {
      await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ checkType: 'company_registration' });

      const listRes = await request(app)
        .get(`/api/v1/companies/admin/${testCompany._id}/registry-checks`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.checks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Admin Registry Check Overrides', () => {
    it('allows an admin to override a check record with mandatory reason and logs audit event', async () => {
      const runRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'company_registration',
          options: { simulateMismatch: true }
        });

      const checkId = runRes.body.data.check._id;

      // Attempt override without reason should fail (400)
      const badOverrideRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/${checkId}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' });
      expect(badOverrideRes.status).toBe(400);

      // Valid override with reason
      const overrideRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/${checkId}/override`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Verified manually via official physical GST certificate and MCA incorporation document' });

      expect(overrideRes.status).toBe(200);
      expect(overrideRes.body.data.check.status).toBe('overridden');
      expect(overrideRes.body.data.check.overrideReason).toContain('Verified manually');

      // Verify AuditLog
      const audit = await AuditLog.findOne({ action: 'company.registry_check_overridden', company: testCompany._id });
      expect(audit).not.toBeNull();
    });
  });

  describe('Recruiter Verification Summary View', () => {
    it('provides a privacy-safe verification summary to recruiters without exposing internal vendor secrets', async () => {
      await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ checkType: 'company_registration' });

      const summaryRes = await request(app)
        .get('/api/v1/companies/me/verification-summary')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.success).toBe(true);
      const summary = summaryRes.body.data.summary;

      expect(summary.companyId).toBe(testCompany._id);
      expect(summary.verificationStatus).toBe('none');
      expect(summary.registryCheckCount).toBe(1);
      expect(summary.latestRegistryCheck.outcome).toBe('match');
      expect(summary).not.toHaveProperty('riskScore');
      expect(summary).not.toHaveProperty('providerSecrets');
    });
  });

  describe('Phase 4A: GSTIN, LLPIN, and Authorization Checks', () => {
    it('executes a GSTIN check and flags inactive/cancelled tax status', async () => {
      await Company.findByIdAndUpdate(testCompany._id, {
        gstin: 'CANCELLED-27AAPCU1234P1ZV'
      });

      const res = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'gst_registration',
          provider: 'gst_registry',
          options: { simulateCancelled: true }
        });

      expect(res.status).toBe(201);
      const check = res.body.data.check;
      expect(check.checkType).toBe('gst_registration');
      expect(check.outcome).toBe('mismatch');
      expect(check.riskIndicators.some((r) => r.code === 'REGISTRY_STATUS_INACTIVE')).toBe(true);
      expect(check.maskedIdentifier).toContain('****');
    });

    it('supports LLPIN verification for Limited Liability Partnerships', async () => {
      await Company.findByIdAndUpdate(testCompany._id, {
        entityType: 'llp',
        cin: 'AAA-1234',
        legalName: 'Acme Advisory LLP'
      });

      const res = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          checkType: 'company_registration',
          provider: 'mca_registry'
        });

      expect(res.status).toBe(201);
      const check = res.body.data.check;
      expect(check.identifierType).toBe('llpin');
      expect(check.outcome).toBe('match');
      expect(check.matchedFields).toContain('legalName');
    });

    it('allows an authorized recruiter to run a registry check on their own company', async () => {
      const res = await request(app)
        .post('/api/v1/companies/me/registry-checks/run')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({
          checkType: 'company_registration'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.check.companyId).toBe(testCompany._id);

      const listRes = await request(app)
        .get('/api/v1/companies/me/registry-checks')
        .set('Authorization', `Bearer ${recruiterToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.checks.length).toBeGreaterThanOrEqual(1);
    });

    it('prevents non-admins from running or overriding registry checks on admin endpoints', async () => {
      const runRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/run`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ checkType: 'company_registration' });

      expect(runRes.status).toBe(403);

      const overrideRes = await request(app)
        .post(`/api/v1/companies/admin/${testCompany._id}/registry-checks/60d5ecb0483d86c1aafc572a/override`)
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ reason: 'Unauthorized override attempt' });

      expect(overrideRes.status).toBe(403);
    });
  });
});
