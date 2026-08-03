import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const createAccount = async (role = 'recruiter', companyId = null, memberRole = 'recruiter') => {
  sequence += 1;
  const user = await User.create({
    fullName: `Recruiter User ${sequence}`,
    email: `recruiter.${sequence}@talvix.test`,
    password: 'Password123!',
    role: role
  });

  let company = null;
  let member = null;

  if (companyId) {
    company = await Company.findById(companyId);
    member = await CompanyMember.create({
      company: companyId,
      recruiter: user._id,
      role: memberRole,
      status: 'active'
    });
    await RecruiterProfile.create({
      user: user._id,
      company: companyId,
      isCompanyOwner: memberRole === 'primary_admin'
    });
  } else if (role === 'recruiter') {
    company = await Company.create({
      name: `Test Company ${sequence}`,
      slug: `test-company-${sequence}`,
      verificationStatus: 'verified',
      owner: user._id
    });
    member = await CompanyMember.create({
      company: company._id,
      recruiter: user._id,
      role: memberRole,
      status: 'active'
    });
    await RecruiterProfile.create({
      user: user._id,
      company: company._id,
      isCompanyOwner: true
    });
  }

  return {
    user,
    company,
    member,
    token: generateAccessToken(user.id)
  };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await CompanyMember.init();
  await RecruiterProfile.init();
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
    Job.deleteMany({}),
    Application.deleteMany({}),
    AuditLog.deleteMany({})
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Recruiter Module APIs', () => {
  it('prevents non-recruiters or recruiters without company access from loading analytics', async () => {
    // 1. Unauthenticated
    await request(app).get('/api/v1/analytics/recruiter/dashboard').expect(401);

    // 2. Candidate
    sequence += 1;
    const cand = await User.create({
      fullName: `Candidate User ${sequence}`,
      email: `candidate.${sequence}@talvix.test`,
      password: 'Password123!',
      role: 'candidate'
    });
    const candToken = generateAccessToken(cand.id);
    await request(app)
      .get('/api/v1/analytics/recruiter/dashboard')
      .set('Authorization', `Bearer ${candToken}`)
      .expect(403);

    // 3. Recruiter without company member setup
    const recNoCompany = await User.create({
      fullName: `Recruiter No Co ${sequence}`,
      email: `recruiter.noco.${sequence}@talvix.test`,
      password: 'Password123!',
      role: 'recruiter'
    });
    await RecruiterProfile.create({
      user: recNoCompany._id,
      company: null
    });
    const recToken = generateAccessToken(recNoCompany.id);
    await request(app)
      .get('/api/v1/analytics/recruiter/dashboard')
      .set('Authorization', `Bearer ${recToken}`)
      .expect(404);
  });

  it('fetches recruiter dashboard, company dashboard, and recruiter analytics successfully', async () => {
    const { token, company, user } = await createAccount('recruiter', null, 'recruiter');

    // Seed a job
    const job = await Job.create({
      title: 'Software Engineer',
      description: 'Node.js developer',
      company: company._id,
      status: 'published',
      viewsCount: 15,
      applicationsCount: 2,
      employmentType: 'full-time',
      workMode: 'remote',
      slug: 'software-engineer',
      createdBy: user._id
    });

    // Seed an application
    await Application.create({
      job: job._id,
      company: company._id,
      candidate: user._id,
      candidateProfile: new mongoose.Types.ObjectId(),
      applicationNumber: `TVX-REC-${sequence}-${Date.now()}`,
      status: 'submitted',
      candidateSnapshot: { fullName: user.fullName },
      jobSnapshot: { title: job.title },
      skillMatch: { score: 92, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Seed audit log
    await AuditLog.create({
      company: company._id,
      actor: user._id,
      action: 'job.publish',
      newValue: { jobId: job._id },
      timestamp: new Date()
    });

    // 1. Recruiter Dashboard
    const resDashboard = await request(app)
      .get('/api/v1/analytics/recruiter/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resDashboard.body.success).toBe(true);
    expect(resDashboard.body.data.metrics.activeJobs).toBe(1);
    expect(resDashboard.body.data.recentActivity.length).toBe(1);
    expect(resDashboard.body.data.recentActivity[0].description).toContain('job · publish');

    // 2. Company Dashboard
    const resCompany = await request(app)
      .get('/api/v1/analytics/company/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resCompany.body.success).toBe(true);
    expect(resCompany.body.data.overview.activeJobs).toBe(1);
    expect(resCompany.body.data.teamSummary.recruiter[0].fullName).toBe(user.fullName);

    // 3. Recruiter Analytics
    const resAnalytics = await request(app)
      .get('/api/v1/analytics/recruiter/analytics')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resAnalytics.body.success).toBe(true);
    expect(resAnalytics.body.data.hiringFunnel.applications).toBe(1);
    expect(resAnalytics.body.data.jobPerformance.mostViewedJobs[0].title).toBe('Software Engineer');
  });

  it('restricts IP visibility in recruiter activity timeline according to role permissions', async () => {
    const primaryAdmin = await createAccount('recruiter', null, 'primary_admin');
    const companyId = primaryAdmin.company._id;

    // Normal recruiter in same company
    const normalRecruiter = await createAccount('recruiter', companyId, 'recruiter');

    // Create an audit log with IP
    const actorUser = primaryAdmin.user;
    await AuditLog.create({
      company: companyId,
      actor: actorUser._id,
      action: 'company.update',
      ipAddress: '192.168.1.50',
      userAgent: 'Mozilla/Chrome',
      timestamp: new Date()
    });

    // 1. Query by primary admin (should see IP address)
    const resAdmin = await request(app)
      .get('/api/v1/analytics/recruiter/activity-timeline')
      .set('Authorization', `Bearer ${primaryAdmin.token}`)
      .expect(200);

    expect(resAdmin.body.success).toBe(true);
    expect(resAdmin.body.data.items[0].ipAddress).toBe('192.168.1.50');

    // 2. Query by normal recruiter (should have IP address hidden)
    const resNormal = await request(app)
      .get('/api/v1/analytics/recruiter/activity-timeline')
      .set('Authorization', `Bearer ${normalRecruiter.token}`)
      .expect(200);

    expect(resNormal.body.success).toBe(true);
    expect(resNormal.body.data.items[0].ipAddress).toBe('Hidden');
  });
});
