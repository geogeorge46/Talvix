import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { Invitation } from '../src/models/Invitation.js';
import { JoinRequest } from '../src/models/JoinRequest.js';
import { OwnershipClaim } from '../src/models/OwnershipClaim.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const register = async (emailDomain = 'business.test', role = 'recruiter') => {
  sequence += 1;
  const email = `${role}.${sequence}@${emailDomain}`;
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ fullName: `${role} ${sequence}`, email, password: 'Strong!Pass123', role })
    .expect(201);
  return { user: response.body.data.user, token: response.body.data.accessToken };
};

const admin = async () => {
  sequence += 1;
  const user = await User.create({
    fullName: 'Platform Admin',
    email: `admin.${sequence}@talvix.local`,
    password: 'Strong!Pass123',
    role: 'admin',
  });
  return { user, token: generateAccessToken(user.id) };
};

const approve = async (recruiter, adminAccount) => {
  const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
  await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, adminAccount.token)
    .send({})
    .expect(200);
  return profile;
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    RecruiterProfile.init(),
    Company.init(),
    CompanyMember.init(),
    Invitation.init(),
    JoinRequest.init(),
    OwnershipClaim.init(),
    AuditLog.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    Company.deleteMany({}),
    CompanyMember.deleteMany({}),
    Invitation.deleteMany({}),
    JoinRequest.deleteMany({}),
    OwnershipClaim.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Company Ownership & Verification Lifecycle', () => {
  it('creates company as provisional_admin and promotes to primary_admin on verification', async () => {
    const recruiter = await register();
    const adminAccount = await admin();
    await approve(recruiter, adminAccount);

    // Create company
    const response = await auth('post', '/api/v1/companies', recruiter.token)
      .send({ name: 'Provisional Labs', officialEmailDomain: 'provisional.com' })
      .expect(201);
    
    const companyId = response.body.data.company._id;

    // Check provisional admin state
    const member = await CompanyMember.findOne({ company: companyId, recruiter: recruiter.user._id });
    expect(member.role).toBe('provisional_admin');
    
    const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
    expect(profile.isCompanyOwner).toBe(false);

    // Verify company
    await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token)
      .send({ notes: 'Verified documents' })
      .expect(200);

    // Verify promotion
    const updatedMember = await CompanyMember.findOne({ company: companyId, recruiter: recruiter.user._id });
    expect(updatedMember.role).toBe('primary_admin');

    const updatedProfile = await RecruiterProfile.findOne({ user: recruiter.user._id });
    expect(updatedProfile.isCompanyOwner).toBe(true);
  });
});

describe('Domain Auto-Approval & Join Requests', () => {
  it('auto-approves join request if domain matches and autoApproveDomainMembers is true', async () => {
    const adminAccount = await admin();
    
    const owner = await register('verifieddomain.com');
    await approve(owner, adminAccount);
    
    // Create company with autoApproveDomainMembers = true
    const compRes = await auth('post', '/api/v1/companies', owner.token)
      .send({ name: 'Domain Tech', officialEmailDomain: 'verifieddomain.com', autoApproveDomainMembers: true })
      .expect(201);
    
    const companyId = compRes.body.data.company._id;
    await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token).send({}).expect(200);

    // Register second user with matching domain
    const joinee = await register('verifieddomain.com');
    
    // Request to join
    const joinRes = await auth('post', `/api/v1/companies/${companyId}/join-request`, joinee.token).expect(201);
    expect(joinRes.body.data.status).toBe('approved');

    const membership = await CompanyMember.findOne({ company: companyId, recruiter: joinee.user._id });
    expect(membership.status).toBe('active');
    expect(membership.role).toBe('recruiter');
  });

  it('creates pending request if domain does not match or autoApproveDomainMembers is false', async () => {
    const adminAccount = await admin();
    
    const owner = await register('domain.com');
    await approve(owner, adminAccount);
    
    const compRes = await auth('post', '/api/v1/companies', owner.token)
      .send({ name: 'Standard Inc', officialEmailDomain: 'domain.com', autoApproveDomainMembers: false })
      .expect(201);
    
    const companyId = compRes.body.data.company._id;
    await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token).send({}).expect(200);

    const joinee = await register('domain.com');
    const joinRes = await auth('post', `/api/v1/companies/${companyId}/join-request`, joinee.token).expect(201);
    expect(joinRes.body.data.status).toBe('pending');
  });
});

describe('Ownership Disputes & Claims Overrides', () => {
  it('allows platforms admin to approve claims, transfer ownership, and demote old fake owner', async () => {
    const adminAccount = await admin();
    
    const fakeOwner = await register('fakecorp.com');
    await approve(fakeOwner, adminAccount);
    const compRes = await auth('post', '/api/v1/companies', fakeOwner.token).send({ name: 'Fake Corp' }).expect(201);
    const companyId = compRes.body.data.company._id;
    await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token).send({}).expect(200);

    const realOwner = await register('fakecorp.com');
    
    // Submit claim
    const claimRes = await auth('post', `/api/v1/companies/${companyId}/claims`, realOwner.token)
      .send({ officialEmail: 'real@fakecorp.com', linkedinUrl: 'https://linkedin.com/in/realowner' })
      .expect(201);
    
    const claimId = claimRes.body.data.claim._id;

    // Admin approves claim
    await auth('patch', `/api/v1/admin/claims/${claimId}`, adminAccount.token)
      .send({ action: 'approve', notes: 'Verified LinkedIn and corporate credentials' })
      .expect(200);

    // Assert company owner updated
    const company = await Company.findById(companyId);
    expect(company.owner.toString()).toBe(realOwner.user._id);

    // Claimant promoted
    const claimantMember = await CompanyMember.findOne({ company: companyId, recruiter: realOwner.user._id });
    expect(claimantMember.role).toBe('primary_admin');
    
    // Fake owner demoted or suspended
    const fakeMember = await CompanyMember.findOne({ company: companyId, recruiter: fakeOwner.user._id });
    expect(fakeMember.status).toBe('removed');

    const fakeUser = await User.findById(fakeOwner.user._id).select('+isActive');
    expect(fakeUser.isActive).toBe(false);
  });
});
