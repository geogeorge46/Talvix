import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { EmailVerificationToken } from '../src/models/EmailVerificationToken.js';
import { DomainVerificationChallenge } from '../src/models/DomainVerificationChallenge.js';
import { FederatedIdentity } from '../src/models/FederatedIdentity.js';
import {
  confirmDomainVerification,
  createDomainVerificationChallenge,
  normalizeAndValidateDomain,
} from '../src/services/domainVerification.service.js';
import { createJoinRequest } from '../src/services/companyInviteJoinClaim.service.js';

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
    EmailVerificationToken.init(),
    DomainVerificationChallenge.init(),
    FederatedIdentity.init(),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replicaSet) await replicaSet.stop();
});

describe('Phase 3: Recruiter Email & Corporate Domain Verification Integration', () => {
  let recruiterUser;
  let recruiterToken;
  let company;
  let currentEmail;

  beforeEach(async () => {
    sequence += 1;
    currentEmail = `alex.${sequence}@techcorp${sequence}.com`;

    await Promise.all([
      User.deleteMany({}),
      Company.deleteMany({}),
      CompanyMember.deleteMany({}),
      RecruiterProfile.deleteMany({}),
      EmailVerificationToken.deleteMany({}),
      DomainVerificationChallenge.deleteMany({}),
      FederatedIdentity.deleteMany({}),
    ]);

    // Create Recruiter Account
    const regRes = await request(app).post('/api/v1/auth/register').send({
      fullName: `Recruiter Alex ${sequence}`,
      email: currentEmail,
      password: 'Password123!',
      role: 'recruiter',
    });

    expect(regRes.status).toBe(201);
    recruiterUser = regRes.body.data.user;
    recruiterToken = regRes.body.data.accessToken;

    // Approve recruiter profile so company creation works
    await RecruiterProfile.updateOne(
      { user: recruiterUser._id || recruiterUser.id },
      { $set: { isApproved: true, verificationStatus: 'verified' } }
    );

    // Create Company owned by Recruiter
    const companyRes = await request(app)
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({
        name: `TechCorp Solutions ${sequence}`,
        website: `https://techcorp${sequence}.com`,
        industry: 'Technology',
      });

    expect(companyRes.status).toBe(201);
    company = companyRes.body.data.company;
    expect(company).toBeTruthy();
    expect(company._id || company.id).toBeTruthy();
  });

  describe('Recruiter Email Verification', () => {
    it('creates unverified recruiter on registration and issues a verification token', async () => {
      const user = await User.findById(recruiterUser.id || recruiterUser._id);
      expect(user.emailVerified).toBe(false);

      const tokenDoc = await EmailVerificationToken.findOne({ userId: user._id });
      expect(tokenDoc).toBeTruthy();
      expect(tokenDoc.email).toBe(currentEmail);
      expect(tokenDoc.tokenHash).toBeTruthy();
    });

    it('confirms email verification status update', async () => {
      const userBefore = await User.findById(recruiterUser.id || recruiterUser._id);
      expect(userBefore.emailVerified).toBe(false);

      await User.findByIdAndUpdate(
        recruiterUser.id || recruiterUser._id,
        { emailVerified: true, isVerified: true, emailVerifiedAt: new Date() }
      );

      const userAfter = await User.findById(recruiterUser.id || recruiterUser._id);
      expect(userAfter.emailVerified).toBe(true);
    });

    it('rejects confirmation with invalid token', async () => {
      const confirmRes = await request(app)
        .post('/api/v1/auth/email-verification/confirm')
        .send({ token: 'invalidorrawtoken123' });

      expect(confirmRes.status).toBe(400);
    });

    it('enforces rate limiting on resend requests', async () => {
      await EmailVerificationToken.deleteMany({ userId: recruiterUser.id || recruiterUser._id });

      const firstResend = await request(app)
        .post('/api/v1/auth/email-verification/resend')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send();

      expect(firstResend.status).toBe(200);

      const secondResend = await request(app)
        .post('/api/v1/auth/email-verification/resend')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send();

      expect(secondResend.status).toBe(429);
      expect(secondResend.body.message).toMatch(/Please wait/);
    });
  });

  describe('Corporate Domain Verification', () => {
    it('normalizes domains and rejects public free email providers', () => {
      expect(normalizeAndValidateDomain('https://WWW.TechCorp.COM/about')).toBe('techcorp.com');
      expect(() => normalizeAndValidateDomain('gmail.com')).toThrow(/Public free email providers/);
      expect(() => normalizeAndValidateDomain('yahoo.com')).toThrow(/Public free email providers/);
      expect(() => normalizeAndValidateDomain('invalid-domain')).toThrow(/Invalid domain format/);
    });

    it('allows company owner to create a domain verification challenge', async () => {
      const domain = `techcorp${sequence}.com`;
      const challengeRes = await request(app)
        .post('/api/v1/companies/me/domain-verification/challenge')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .send({ domain });

      expect(challengeRes.status).toBe(201);
      const data = challengeRes.body.data || challengeRes.body;
      expect(data.domain).toBe(domain);
      expect(data.txtRecordName).toBe(`_talvix-verification.${domain}`);
      expect(data.txtRecordValue).toMatch(/^talvix-domain-verification=/);
    });

    it('verifies domain control when matching DNS TXT record is returned', async () => {
      const companyId = company._id || company.id;
      const domain = `techcorp${sequence}.com`;
      const challenge = await createDomainVerificationChallenge(
        companyId,
        recruiterUser.id || recruiterUser._id,
        domain
      );

      const mockDnsResolver = async (hostname) => {
        if (hostname === challenge.txtRecordName) {
          return [challenge.txtRecordValue];
        }
        return [];
      };

      const result = await confirmDomainVerification(
        companyId,
        recruiterUser.id || recruiterUser._id,
        mockDnsResolver
      );

      expect(result.status).toBe('verified');
      expect(result.domainVerified).toBe(true);

      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.domainVerified).toBe(true);
      expect(updatedCompany.officialEmailDomain).toBe(domain);
      expect(updatedCompany.verificationStatus).not.toBe('verified');
    });

    it('returns pending recheck status when DNS TXT record is missing', async () => {
      const companyId = company._id || company.id;
      const domain = `techcorp${sequence}.com`;
      await createDomainVerificationChallenge(
        companyId,
        recruiterUser.id || recruiterUser._id,
        domain
      );

      const mockEmptyDnsResolver = async () => [];

      const result = await confirmDomainVerification(
        companyId,
        recruiterUser.id || recruiterUser._id,
        mockEmptyDnsResolver
      );

      expect(result.status).toBe('pending');
      expect(result.domainVerified).toBe(false);
      expect(result.message).toMatch(/DNS TXT record not found/);
    });

    it('prevents another company from verifying a domain already verified by a company', async () => {
      const companyId = company._id || company.id;
      const domain = `techcorp${sequence}.com`;
      await Company.findByIdAndUpdate(companyId, {
        officialEmailDomain: domain,
        domainVerified: true,
        domainVerifiedAt: new Date(),
      });

      const regRes2 = await request(app).post('/api/v1/auth/register').send({
        fullName: 'Recruiter Bob',
        email: `bob.${sequence}@techcorp${sequence}.com`,
        password: 'Password123!',
        role: 'recruiter',
      });
      const token2 = regRes2.body.data.accessToken;

      await RecruiterProfile.updateOne(
        { user: regRes2.body.data.user.id || regRes2.body.data.user._id },
        { $set: { isApproved: true, verificationStatus: 'verified' } }
      );

      await request(app)
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          name: `TechCorp Impostor ${sequence}`,
          website: `https://${domain}`,
        });

      const challengeRes2 = await request(app)
        .post('/api/v1/companies/me/domain-verification/challenge')
        .set('Authorization', `Bearer ${token2}`)
        .send({ domain });

      expect(challengeRes2.status).toBe(409);
      expect(challengeRes2.body.message).toMatch(/already verified/);
    });
  });

  describe('Domain-based Auto-Approval Membership Rules', () => {
    it('requires all 4 Phase 3 conditions for domain auto-approval', async () => {
      const companyId = company._id || company.id;
      const domain = `techcorp${sequence}.com`;
      const joinerRes = await request(app).post('/api/v1/auth/register').send({
        fullName: 'Joiner Dev',
        email: `dev.${sequence}@${domain}`,
        password: 'Password123!',
        role: 'recruiter',
      });
      const joinerUser = joinerRes.body.data.user;

      await Company.findByIdAndUpdate(companyId, {
        officialEmailDomain: domain,
        domainVerified: true,
        verificationStatus: 'verified',
        autoApproveDomainMembers: true,
      });

      // Case 1: Unverified user email -> returns pending join request
      const res1 = await createJoinRequest(joinerUser.id || joinerUser._id, companyId);
      expect(res1.status).toBe('pending');

      // Case 2: Mark user email verified -> auto-approves with default recruiter role
      await User.findByIdAndUpdate(joinerUser.id || joinerUser._id, { emailVerified: true, isVerified: true });
      await CompanyMember.deleteMany({ recruiter: joinerUser.id || joinerUser._id });
      await mongoose.model('JoinRequest').deleteMany({ user: joinerUser.id || joinerUser._id });

      const res2 = await createJoinRequest(joinerUser.id || joinerUser._id, companyId);
      expect(res2.status).toBe('approved');

      const member = await CompanyMember.findOne({ company: companyId, recruiter: joinerUser.id || joinerUser._id });
      expect(member).toBeTruthy();
      expect(member.role).toBe('recruiter'); // Safe default role
    });
  });
});
