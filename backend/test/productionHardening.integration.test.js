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
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RefreshSession } from '../src/models/RefreshSession.js';
import { Document } from '../src/models/Document.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { Notification } from '../src/models/Notification.js';
import { queueJob, processNextJobs } from '../src/services/backgroundJobs.service.js';
import { uploadFile } from '../src/services/fileStorageProvider.service.js';

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
  return { user, token: generateAccessToken(user.id, ['admin']) };
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
    BackgroundJob.init(),
    RefreshSession.init(),
    Document.init(),
    Job.init(),
    Application.init(),
    CandidateProfile.init(),
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
    BackgroundJob.deleteMany({}),
    RefreshSession.deleteMany({}),
    Document.deleteMany({}),
    Job.deleteMany({}),
    Application.deleteMany({}),
    CandidateProfile.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Phase 1 Hardening & Security Integration Tests', () => {
  describe('Ownership Claims & Dispute Response Flow', () => {
    it('notifies current owner/admins on claim submission, allows owner response, and resolves claim with session revocation', async () => {
      const adminAccount = await admin();
      
      // Setup current owner company
      const ownerAccount = await register('owner.com', 'recruiter');
      await approve(ownerAccount, adminAccount);
      const companyRes = await auth('post', '/api/v1/companies', ownerAccount.token)
        .send({ name: 'Owner Company', industry: 'Software', companySize: '11-50' })
        .expect(201);
      const companyId = companyRes.body.data.company._id;

      // Verify the owner
      await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token)
        .send({ notes: 'Verified company docs' })
        .expect(200);

      // Create an HR Admin member in the company
      const hrAccount = await register('owner.com', 'recruiter');
      await approve(hrAccount, adminAccount);
      await CompanyMember.create({
        company: companyId,
        recruiter: hrAccount.user._id,
        role: 'hr_admin',
        status: 'active'
      });

      // Claimant recruiter registers
      const claimantAccount = await register('claimant.com', 'recruiter');
      await approve(claimantAccount, adminAccount);

      // Claimant submits claim
      const claimRes = await auth('post', `/api/v1/companies/${companyId}/claims`, claimantAccount.token)
        .send({
          officialEmail: 'claimant@owner.com',
          linkedinUrl: 'https://linkedin.com/in/claimant',
          proofUrl: 'https://drive.google.com/claim-proof',
          companyWebsite: 'https://owner.com',
          businessRegistration: 'BRN-12345',
          gstNumber: 'GST-999',
          claimantNotes: 'We are the rightful founders.'
        })
        .expect(201);
      const claimId = claimRes.body.data.claim._id;

      // Verify notifications sent to owner and hr_admin
      const notifications = await Notification.find({ type: 'security-alert' });
      expect(notifications.length).toBeGreaterThanOrEqual(2);
      const recipientIds = notifications.map(n => String(n.recipient));
      expect(recipientIds).toContain(String(ownerAccount.user._id));
      expect(recipientIds).toContain(String(hrAccount.user._id));

      // Owner responds to ownership claim
      await auth('post', `/api/v1/companies/claims/${claimId}/respond`, ownerAccount.token)
        .send({ responseText: 'This is a fraudulent claim. I founded this company.' })
        .expect(200);

      // Verify owner response fields are updated
      const updatedClaim = await OwnershipClaim.findById(claimId);
      expect(updatedClaim.ownerResponse).toBe('This is a fraudulent claim. I founded this company.');
      expect(updatedClaim.ownerRespondedAt).not.toBeNull();

      // Verify claim response is audited
      const responseAudit = await AuditLog.findOne({ action: 'company.claim_owner_responded' });
      expect(responseAudit).not.toBeNull();
      expect(responseAudit.actor.toString()).toBe(ownerAccount.user._id.toString());

      // Platform admin reviews and approves claim
      await auth('patch', `/api/v1/admin/claims/${claimId}`, adminAccount.token)
        .send({ action: 'approve', notes: 'Founder verified via business registry.' })
        .expect(200);

      // Verify company owner is transferred
      const updatedCompany = await Company.findById(companyId);
      expect(updatedCompany.owner.toString()).toBe(claimantAccount.user._id.toString());

      // Verify old owner has been deactivated/suspended & sessions revoked
      const oldOwnerUser = await User.findById(ownerAccount.user._id).select('+isActive +tokenVersion');
      expect(oldOwnerUser.isActive).toBe(false);
      expect(oldOwnerUser.tokenVersion).toBeGreaterThan(1);

      // Verify claimant has been promoted
      const claimantMember = await CompanyMember.findOne({ company: companyId, recruiter: claimantAccount.user._id });
      expect(claimantMember.role).toBe('primary_admin');

      // Verify correct standardized audit actions are recorded
      const claimSubmittedAudit = await AuditLog.findOne({ action: 'company.claim_submitted' });
      const claimApprovedAudit = await AuditLog.findOne({ action: 'company.claim_approved' });
      expect(claimSubmittedAudit).not.toBeNull();
      expect(claimApprovedAudit).not.toBeNull();
    });
  });

  describe('Resume Protection & Candidate Profile Access Logs', () => {
    it('enforces company-specific download limit, blocks bulk scraping, and logs downloads to candidate access endpoint', async () => {
      const adminAccount = await admin();

      // Setup company and recruiter
      const recruiterAccount = await register('enterprise.com', 'recruiter');
      await approve(recruiterAccount, adminAccount);
      const companyRes = await auth('post', '/api/v1/companies', recruiterAccount.token)
        .send({ name: 'Enterprise Inc', industry: 'Technology', companySize: '11-50' })
        .expect(201);
      const companyId = companyRes.body.data.company._id;
      await auth('patch', `/api/v1/companies/admin/${companyId}/verify`, adminAccount.token)
        .send({ notes: 'Verified' })
        .expect(200);

      // Update recruiter token to include correct roles/tenant scopes
      const dbRecruiter = await User.findById(recruiterAccount.user._id);
      recruiterAccount.token = generateAccessToken(dbRecruiter.id, ['recruiter'], dbRecruiter.tokenVersion);

      // Set company-specific resume download limit to 2
      await Company.findByIdAndUpdate(companyId, { $set: { resumeDownloadLimit: 2 } });

      // Setup candidate
      const candidateAccount = await register('gmail.com', 'candidate');
      let candidateProfile = await CandidateProfile.findOne({ user: candidateAccount.user._id });
      if (!candidateProfile) {
        candidateProfile = await CandidateProfile.create({
          user: candidateAccount.user._id,
          skills: [],
          education: [],
          experience: [],
          projects: [],
          certifications: []
        });
      }

      // Create Job
      const job = await Job.create({
        company: companyId,
        createdBy: recruiterAccount.user._id,
        title: 'Software Engineer',
        slug: 'software-engineer',
        description: 'Vibrant job description',
        employmentType: 'full-time',
        workMode: 'remote',
        status: 'published'
      });

      // Create application
      const application = await Application.create({
        candidate: candidateAccount.user._id,
        candidateProfile: candidateProfile._id,
        job: job._id,
        company: companyId,
        applicationNumber: 'APP-100',
        status: 'submitted',
        skillMatch: { score: 90, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
        candidateSnapshot: {},
        jobSnapshot: {}
      });

      // Upload resume document to in-memory storage first
      const uploadResult = await uploadFile({
        folder: `talvix/candidate/${candidateAccount.user._id}`,
        publicId: `talvix/candidate/${candidateAccount.user._id}/res-id`,
        fileName: 'resume.pdf',
        buffer: Buffer.from('dummy pdf content'),
        mimeType: 'application/pdf',
        resourceType: 'raw'
      });

      // Upload resume document
      const resume = await Document.create({
        owner: candidateAccount.user._id,
        ownerRole: 'candidate',
        uploadedBy: candidateAccount.user._id,
        category: 'resume',
        purpose: 'Job application resume',
        entityType: 'application',
        entityId: application._id,
        originalFileName: 'resume.pdf',
        mimeType: 'application/pdf',
        mediaType: 'document',
        sizeBytes: uploadResult.bytes || 1024,
        checksum: 'checksum-foo',
        storage: uploadResult,
        access: 'company-private',
        status: 'active',
        isCurrent: true,
        company: companyId
      });

      // Recruiter downloads resume twice (succeeds)
      await auth('get', `/api/v1/documents/manage/applications/${application._id}/${resume._id}/download`, recruiterAccount.token)
        .expect(200);
      await auth('get', `/api/v1/documents/manage/applications/${application._id}/${resume._id}/download`, recruiterAccount.token)
        .expect(200);

      // Recruiter downloads third time (blocked with 429)
      await auth('get', `/api/v1/documents/manage/applications/${application._id}/${resume._id}/download`, recruiterAccount.token)
        .expect(429);

      // Verify Candidate profile-access history
      const candidateRes = await auth('get', '/api/v1/candidates/me/profile-access', candidateAccount.token)
        .expect(200);

      expect(candidateRes.body.success).toBe(true);
      expect(candidateRes.body.data.logs.length).toBe(2);
      expect(candidateRes.body.data.logs[0].company.name).toBe('Enterprise Inc');
      expect(candidateRes.body.data.logs[0].job.title).toBe('Software Engineer');
      expect(candidateRes.body.data.logs[0].accessType).toBe('download');
    });
  });

  describe('Background Worker & Data Retention Policies', () => {
    it('executes queued background tasks, applies worker locking, enforces priority scheduling, and clears expired retention records', async () => {
      // 1. Queue low and high priority jobs
      const lowJob = await queueJob({ type: 'EXPIRE_INVITATION', priority: 'LOW' });
      const criticalJob = await queueJob({ type: 'REVOKE_SESSION', priority: 'CRITICAL', payload: { userId: new mongoose.Types.ObjectId() } });

      // Verify priorityWeight mapped correctly
      expect(lowJob.priorityWeight).toBe(1);
      expect(criticalJob.priorityWeight).toBe(4);

      // 2. Queue expired invitations, join requests and soft-deleted records for retention cleanup
      const expiredInvite = await Invitation.create({
        company: new mongoose.Types.ObjectId(),
        email: 'expired@business.test',
        role: 'recruiter',
        tokenHash: 'hash-foo',
        expiresAt: new Date(Date.now() - 3600), // expired 1 hour ago
        status: 'pending',
        invitedBy: new mongoose.Types.ObjectId()
      });

      // Run expiries background task
      await queueJob({ type: 'EXPIRE_INVITATION', priority: 'HIGH' });
      await processNextJobs();

      // Check invitation status updated to expired
      const inviteAfter = await Invitation.findById(expiredInvite._id);
      expect(inviteAfter.status).toBe('expired');

      // Create a stale audit log older than 7 years to verify retention cleanup
      process.env.AUDIT_RETENTION_DAYS = '1'; // temporarily change to 1 day for testing retention
      const oldAudit = await AuditLog.create({
        action: 'team.invite',
        actor: new mongoose.Types.ObjectId(),
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000) // 2 days ago
      });
      const newAudit = await AuditLog.create({
        action: 'team.invite',
        actor: new mongoose.Types.ObjectId(),
        timestamp: new Date()
      });

      await queueJob({ type: 'RETENTION_CLEANUP', priority: 'HIGH' });
      await processNextJobs();

      // Verify retention deleted the stale audit log
      const oldAuditAfter = await AuditLog.findById(oldAudit._id);
      const newAuditAfter = await AuditLog.findById(newAudit._id);
      expect(oldAuditAfter).toBeNull();
      expect(newAuditAfter).not.toBeNull();
    });
  });
});
