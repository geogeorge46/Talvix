import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Application } from '../src/models/Application.js';
import { Company } from '../src/models/Company.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { User } from '../src/models/User.js';
import { Job } from '../src/models/Job.js';
import { Offer } from '../src/models/Offer.js';
import { OfferTemplate } from '../src/models/OfferTemplate.js';
import { CandidateOnboarding } from '../src/models/CandidateOnboarding.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { executeJob } from '../src/services/backgroundJobs.service.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';

let db;
let seq = 0;
const permissions = ['offers.view', 'offers.manage', 'offers.approve', 'offers.send', 'documents.view', 'documents.manage'];
const api = (m, p, t) => request(app)[m](p).set('Authorization', `Bearer ${t}`);

const user = async (role) => {
  seq++;
  const u = await User.create({
    fullName: `${role} ${seq}`,
    email: `${role}${seq}@offer.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user: u, token: generateAccessToken(u.id, [role]) };
};

const recruiter = async () => {
  const a = await user('recruiter');
  const company = await Company.create({
    name: `Company ${seq}`,
    slug: `company-${seq}`,
    owner: a.user.id,
    verificationStatus: 'verified',
    isActive: true,
    offerApprovalWorkflowEnabled: true,
    teamMembers: [{ recruiter: a.user.id, role: 'owner', permissions, status: 'active' }]
  });
  await RecruiterProfile.create({
    user: a.user.id,
    company: company.id,
    isApproved: true,
    isCompanyOwner: true,
    permissions,
  });
  return { ...a, company };
};

const application = async (o, c, job) =>
  Application.create({
    candidate: c.user.id,
    candidateProfile: new mongoose.Types.ObjectId(),
    job: job.id,
    company: o.company.id,
    applicationNumber: `TVX-OFR-APP-${seq}-${Date.now()}`,
    status: 'interview-completed',
    candidateSnapshot: { fullName: c.user.fullName },
    jobSnapshot: { title: job.title },
    skillMatch: {
      score: 0,
      matchedSkills: [],
      missingRequiredSkills: [],
      breakdown: [],
    },
  });

beforeAll(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(db.getUri());
  await Promise.all([
    User.init(),
    Company.init(),
    RecruiterProfile.init(),
    CandidateProfile.init(),
    Application.init(),
    Job.init(),
    OfferTemplate.init(),
    Offer.init(),
    CandidateOnboarding.init(),
    AuditLog.init(),
    BackgroundJob.init(),
  ]);
});

beforeEach(async () =>
  Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})))
);

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

describe('Offer Management Hardening tests', () => {
  it('should support offer creation, sequential approval chains, document previews, and signing', async () => {
    const owner = await recruiter();
    const manager = await user('recruiter');
    
    // Add manager to company team members
    owner.company.teamMembers.push({ recruiter: manager.user.id, role: 'member', permissions, status: 'active' });
    await owner.company.save();
    await RecruiterProfile.create({
      user: manager.user.id,
      company: owner.company.id,
      isApproved: true,
      permissions
    });

    const job = await Job.create({
      company: owner.company.id,
      title: 'Principal Architect',
      hiringManager: manager.user.id,
      description: 'Test job description',
      employmentType: 'full-time',
      workMode: 'hybrid',
      slug: `principal-architect-${Date.now()}`,
      createdBy: owner.user.id,
      status: 'published'
    });

    const cand = await user('candidate');
    const appRecord = await application(owner, cand, job);

    // Create offer template requiring Hiring Manager and Primary Admin approvals
    const t = await api('post', '/api/v1/offers/templates', owner.token)
      .send({
        name: 'Executive Template',
        approvalRequired: true,
        requiredApproverRoles: ['hiring-manager', 'company-primary-admin'],
        employmentType: 'full-time',
        defaultValidityDays: 14,
        defaultCompensation: {
          currency: 'USD',
          period: 'yearly',
          base: 150000,
          variable: 30000,
          bonus: 10000,
          equity: {
            enabled: true,
            type: 'RSUs',
            quantity: 1000,
            vestingTerms: '4 year vesting schedule'
          }
        }
      })
      .expect(201);

    // Draft offer
    const o = await api('post', '/api/v1/offers', owner.token)
      .send({
        applicationId: appRecord.id,
        templateId: t.body.data.template._id,
        title: 'Principal Architect',
        employmentType: 'full-time',
        workMode: 'hybrid',
        joiningDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        validityDays: 10,
        compensation: {
          period: 'yearly',
          base: 160000,
          variable: 35000,
          bonus: 15000,
          equity: {
            enabled: true,
            type: 'RSUs',
            quantity: 1200,
            vestingTerms: '4 year vesting schedule'
          }
        }
      })
      .expect(201);

    const offerId = o.body.data.offer._id;

    // Verify AuditLog for creation
    const createLogs = await AuditLog.find({ action: 'offer.create' });
    expect(createLogs).toHaveLength(1);

    // Submit for approval
    await api('patch', `/api/v1/offers/manage/${offerId}/request-approval`, owner.token).expect(200);

    const reqOffer = await Offer.findById(offerId);
    expect(reqOffer.status).toBe('pending-approval');
    expect(reqOffer.approvalChain).toHaveLength(2);
    expect(reqOffer.approvalChain[0].role).toBe('hiring-manager');
    expect(reqOffer.approvalChain[0].approver.toString()).toBe(manager.user.id.toString());
    expect(reqOffer.approvalChain[1].role).toBe('company-primary-admin');
    expect(reqOffer.approvalChain[1].approver.toString()).toBe(owner.user.id.toString());

    // Try to approve next step (owner) ahead of hiring manager (should fail/restrict)
    await api('patch', `/api/v1/offers/approvals/${offerId}/approve`, owner.token)
      .send({ comments: 'Looks good' })
      .expect(403);

    // Approve step 1 as Hiring Manager (manager recruiter)
    await api('patch', `/api/v1/offers/approvals/${offerId}/approve`, manager.token)
      .send({ comments: 'Perfect budget allocation.' })
      .expect(200);

    // Approve step 2 as Primary Admin (owner)
    await api('patch', `/api/v1/offers/approvals/${offerId}/approve`, owner.token)
      .send({ comments: 'Approved executive hire.' })
      .expect(200);

    // Verify overall offer approved
    const approvedOffer = await Offer.findById(offerId);
    expect(approvedOffer.status).toBe('approved');

    // Preview letter before sending
    const preview = await api('get', `/api/v1/offers/manage/${offerId}/letter/preview`, owner.token)
      .expect(200);
    expect(preview.body.data.html).toContain('OFFER OF EMPLOYMENT');
    expect(preview.body.data.html).toContain('160000');

    // Recruiter sends offer to candidate
    await api('patch', `/api/v1/offers/manage/${offerId}/send`, owner.token).expect(200);

    // Verify Application status transitions to offer-sent
    const appSent = await Application.findById(appRecord.id);
    expect(appSent.status).toBe('offer-sent');

    // Candidate views offer
    await api('patch', `/api/v1/offers/me/${offerId}/view`, cand.token).expect(200);
    const viewedOffer = await Offer.findById(offerId);
    expect(viewedOffer.status).toBe('viewed');

    // Candidate downloads offer letter PDF/HTML
    const download = await api('get', `/api/v1/offers/me/${offerId}/letter/download`, cand.token)
      .expect(200);
    expect(download.headers['content-disposition']).toContain('attachment');

    // Candidate accepts offer with signature
    await api('patch', `/api/v1/offers/me/${offerId}/accept`, cand.token)
      .send({ comments: 'Excited!', signature: 'John Cand Doe' })
      .expect(200);

    const acceptedOffer = await Offer.findById(offerId);
    expect(acceptedOffer.status).toBe('accepted');
    expect(acceptedOffer.candidateResponse.electronicSignature).toBe('John Cand Doe');
    expect(acceptedOffer.candidateResponse.ipAddress).toBeDefined();

    const appAccepted = await Application.findById(appRecord.id);
    expect(appAccepted.status).toBe('offer-accepted');

    // Recruiter confirms hire (triggers onboarding and moves application to 'hired')
    await api('patch', `/api/v1/offers/manage/${offerId}/confirm-hire`, owner.token).expect(200);

    const hiredApp = await Application.findById(appRecord.id);
    expect(hiredApp.status).toBe('hired');

    const onboardingOffer = await Offer.findById(offerId);
    expect(onboardingOffer.status).toBe('onboarding-started');

    // Onboarding checklist generated
    const onboarding = await CandidateOnboarding.findOne({ offer: offerId });
    expect(onboarding.status).toBe('in-progress');
    expect(onboarding.tasks).toHaveLength(4);

    // Recruiter completes onboarding
    await api('patch', `/api/v1/offers/manage/${offerId}/onboarding/complete`, owner.token).expect(200);

    const finalOffer = await Offer.findById(offerId);
    expect(finalOffer.status).toBe('completed');
    const completedOnboarding = await CandidateOnboarding.findOne({ offer: offerId });
    expect(completedOnboarding.status).toBe('completed');
  });

  it('should support offer AI benchmarking and analysis', async () => {
    const owner = await recruiter();
    const cand = await user('candidate');
    const job = await Job.create({
      company: owner.company.id,
      title: 'Senior Devops',
      hiringManager: owner.user.id,
      description: 'Senior roles',
      employmentType: 'full-time',
      workMode: 'remote',
      slug: `devops-${Date.now()}`,
      createdBy: owner.user.id,
      status: 'published'
    });
    const appRecord = await application(owner, cand, job);

    const o = await Offer.create({
      offerNumber: `TVX-OFR-${Date.now()}`,
      chainId: new mongoose.Types.ObjectId(),
      company: owner.company.id,
      job: job.id,
      application: appRecord.id,
      candidate: cand.user.id,
      createdBy: owner.user.id,
      title: 'Devops',
      employmentType: 'full-time',
      workMode: 'remote',
      compensation: { period: 'yearly', base: 110000, variable: 10000, baseFormatted: '110000', estimatedTotal: 120000 },
      candidateSnapshot: { fullName: cand.user.fullName },
      jobSnapshot: { title: job.title, companyName: owner.company.name }
    });

    const analysis = await api('get', `/api/v1/offers/manage/${o.id}/ai-analysis`, owner.token)
      .expect(200);
    
    expect(analysis.body.data.analysis.salaryBenchmarking.status).toBeDefined();
    expect(analysis.body.data.analysis.offerQualityAnalysis.score).toBeGreaterThan(0);
  });

  it('should run background job to expire offers past their validity date', async () => {
    const owner = await recruiter();
    const cand = await user('candidate');
    const job = await Job.create({
      company: owner.company.id,
      title: 'QA Engineer',
      hiringManager: owner.user.id,
      description: 'Quality assurance',
      employmentType: 'full-time',
      workMode: 'onsite',
      slug: `qa-${Date.now()}`,
      createdBy: owner.user.id,
      status: 'published'
    });
    const appRecord = await application(owner, cand, job);

    // Create an offer that expired yesterday
    const yesterday = new Date(Date.now() - 86400000);
    const o = await Offer.create({
      offerNumber: `TVX-OFR-${Date.now()}`,
      chainId: new mongoose.Types.ObjectId(),
      company: owner.company.id,
      job: job.id,
      application: appRecord.id,
      candidate: cand.user.id,
      createdBy: owner.user.id,
      title: 'QA',
      employmentType: 'full-time',
      workMode: 'onsite',
      status: 'sent',
      expiresAt: yesterday,
      compensation: { period: 'yearly', base: 80000, estimatedTotal: 80000 },
      candidateSnapshot: { fullName: cand.user.fullName },
      jobSnapshot: { title: job.title, companyName: owner.company.name }
    });

    // Run the expiration background job
    const jobRecord = await BackgroundJob.create({
      type: 'EXPIRE_OFFERS',
      status: 'pending'
    });

    await executeJob(jobRecord);

    const expiredOffer = await Offer.findById(o.id);
    expect(expiredOffer.status).toBe('expired');

    const expireLogs = await AuditLog.find({ action: 'offer.expire' });
    expect(expireLogs).toHaveLength(1);
    expect(expireLogs[0].targetUser.toString()).toBe(cand.user.id.toString());
  });
});
