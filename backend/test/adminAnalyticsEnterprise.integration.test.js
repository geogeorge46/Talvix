import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { User } from '../src/models/User.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Job } from '../src/models/Job.js';
import { Application } from '../src/models/Application.js';
import { Offer } from '../src/models/Offer.js';
import { InterviewSchedule } from '../src/models/InterviewSchedule.js';
import { Assessment } from '../src/models/Assessment.js';
import { AssessmentAttempt } from '../src/models/AssessmentAttempt.js';
import { BackgroundJob } from '../src/models/BackgroundJob.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role, fullName = '') => {
  sequence += 1;
  const name = fullName || `${role} ${sequence}`;
  const user = await User.create({
    fullName: name,
    email: `${role}.${sequence}@adminenterprise.test`,
    password: 'Strong!Pass123',
    role,
    isVerified: true,
    isActive: true
  });
  return { user, token: generateAccessToken(user.id) };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([
    User.init(),
    Company.init(),
    CandidateProfile.init(),
    Job.init(),
    Application.init(),
    Offer.init(),
    InterviewSchedule.init(),
    Assessment.init(),
    AssessmentAttempt.init(),
    BackgroundJob.init(),
    RecruiterProfile.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Admin Analytics Dashboard Phase 2 Enterprise Enhancements', () => {
  it('verifies recruiter performance leaderboards, sorting, pagination, and productivity score calculations', async () => {
    const admin = await account('admin');
    
    // Create recruiters
    const rec1 = await account('recruiter', 'Alice Recruiter');
    const rec2 = await account('recruiter', 'Bob Recruiter');
    
    await RecruiterProfile.create([
      { user: rec1.user.id, isApproved: true, company: new mongoose.Types.ObjectId() },
      { user: rec2.user.id, isApproved: true, company: new mongoose.Types.ObjectId() }
    ]);
    
    // Alice created a job and published it
    await Job.create({
      title: 'Senior Software Engineer',
      createdBy: rec1.user.id,
      company: new mongoose.Types.ObjectId(),
      status: 'published',
      viewsCount: 10,
      applicationsCount: 2,
      workMode: 'onsite',
      employmentType: 'full-time',
      description: 'A job description is required here.',
      slug: 'senior-software-engineer-slug-1'
    });
    
    // Bob created a job but left it as draft
    await Job.create({
      title: 'Junior UI Designer',
      createdBy: rec2.user.id,
      company: new mongoose.Types.ObjectId(),
      status: 'draft',
      viewsCount: 2,
      applicationsCount: 0,
      workMode: 'remote',
      employmentType: 'part-time',
      description: 'A job description is required here.',
      slug: 'junior-ui-designer-slug-2'
    });
    
    // Alice processed applications
    const candidate1 = await account('candidate');
    await Application.create({
      candidate: candidate1.user.id,
      candidateProfile: new mongoose.Types.ObjectId(),
      job: new mongoose.Types.ObjectId(),
      company: new mongoose.Types.ObjectId(),
      status: 'hired',
      submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      skillMatch: { score: 95, matchedSkills: [], missingRequiredSkills: [], breakdown: [] },
      applicationNumber: 'APP-TEST-REC-1',
      jobSnapshot: { title: 'Senior Software Engineer' },
      candidateSnapshot: { fullName: 'Candidate 1', email: 'cand1@test.com' },
      statusHistory: [
        { from: 'submitted', to: 'hired', changedBy: rec1.user.id, changedAt: new Date() }
      ]
    });

    const res = await api('get', '/api/v1/admin/analytics/recruiters?sortBy=productivityScore&sortOrder=desc', admin.token)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    expect(res.body.data.breakdowns.leaderboard).toBeDefined();
    
    const leaderboard = res.body.data.breakdowns.leaderboard;
    expect(leaderboard.length).toBeGreaterThanOrEqual(2);
    
    // Alice should have a higher productivity score than Bob
    const aliceEntry = leaderboard.find(x => x.email === rec1.user.email);
    const bobEntry = leaderboard.find(x => x.email === rec2.user.email);
    
    expect(aliceEntry.jobsPublished).toBe(1);
    expect(aliceEntry.candidatesHired).toBe(1);
    expect(aliceEntry.averageTimeToHireDays).toBe(5); // 5 days calculated
    expect(aliceEntry.productivityScore).toBeGreaterThan(bobEntry.productivityScore);
  });

  it('verifies candidate experience distribution, conversions, and top skills heatmap', async () => {
    const admin = await account('admin');
    
    // Create candidate profile with 3 years of work experience
    const cand1 = await account('candidate');
    await CandidateProfile.create({
      user: cand1.user.id,
      experience: [
        {
          company: 'TechCorp',
          title: 'Developer',
          startDate: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 1 * 365 * 24 * 60 * 60 * 1000) // 3 years of experience
        }
      ],
      skills: [
        { name: 'Node.js', proficiency: 'expert', yearsOfExperience: 3 },
        { name: 'TypeScript', proficiency: 'intermediate', yearsOfExperience: 2 }
      ],
      education: [
        { institution: 'MIT', degree: 'BS', fieldOfStudy: 'Engineering', startYear: 2014 }
      ]
    });

    const res = await api('get', '/api/v1/admin/analytics/candidates', admin.token)
      .expect(200);

    expect(res.body.data.breakdowns.experienceLevels).toBeDefined();
    const midLevel = res.body.data.breakdowns.experienceLevels.find(x => x.key === 'Mid Level (2-5y)');
    expect(midLevel.count).toBe(1);
    
    expect(res.body.data.breakdowns.topSkills.map(s => s.key)).toContain('Node.js');
    expect(res.body.data.breakdowns.topSkills.map(s => s.key)).toContain('TypeScript');
  });

  it('verifies job performance conversion rates, averages, and department rankings', async () => {
    const admin = await account('admin');
    
    const companyId = new mongoose.Types.ObjectId();
    await Job.create({
      title: 'DevOps Engineer',
      createdBy: new mongoose.Types.ObjectId(),
      company: companyId,
      status: 'published',
      viewsCount: 200,
      applicationsCount: 20,
      department: 'Infrastructure',
      location: { city: 'Mumbai', country: 'India' },
      workMode: 'onsite',
      employmentType: 'full-time',
      description: 'Job description text.',
      slug: 'devops-engineer-slug'
    });

    const res = await api('get', '/api/v1/admin/analytics/jobs', admin.token)
      .expect(200);

    expect(res.body.data.summary.totalViews).toBe(200);
    expect(res.body.data.summary.totalApplications).toBe(20);
    expect(res.body.data.summary.applyConversionRate).toBe(10); // 10%
    
    const deptInfo = res.body.data.breakdowns.departmentPerformance.find(x => x.key === 'Infrastructure');
    expect(deptInfo.count).toBe(20);
  });

  it('verifies assessment analytics, programming languages, and integrity risk scores', async () => {
    const admin = await account('admin');
    
    const assessmentId = new mongoose.Types.ObjectId();
    await AssessmentAttempt.create({
      candidate: new mongoose.Types.ObjectId(),
      assessment: assessmentId,
      status: 'completed',
      startedAt: new Date(Date.now() - 60000),
      submittedAt: new Date(),
      attemptNumber: 1,
      company: new mongoose.Types.ObjectId(),
      application: new mongoose.Types.ObjectId(),
      assignment: new mongoose.Types.ObjectId(),
      answers: [
        {
          question: new mongoose.Types.ObjectId(),
          answerType: 'code',
          language: 'python',
          questionType: 'coding',
          questionId: new mongoose.Types.ObjectId()
        }
      ],
      questionResults: [
        {
          question: new mongoose.Types.ObjectId(),
          isCorrect: true,
          questionId: new mongoose.Types.ObjectId(),
          codingResult: { time: 0.12, memory: 4500 }
        }
      ],
      evaluation: { percentage: 100, passed: true },
      integrity: { cheatingRiskScore: 78, suspiciousEvents: [{ eventType: 'tab-switched', timestamp: new Date() }] }
    });

    const res = await api('get', '/api/v1/admin/analytics/assessments', admin.token)
      .expect(200);

    expect(res.body.data.summary.averageExecutionTimeMs).toBe(120); // 0.12s -> 120ms
    expect(res.body.data.summary.cheatingIncidents).toBe(1);
    
    const langInfo = res.body.data.breakdowns.languageUsage.find(x => x.key === 'python');
    expect(langInfo.count).toBe(1);
  });

  it('verifies offer salary bands, accept delays, and decline categories', async () => {
    const admin = await account('admin');
    
    const companyId = new mongoose.Types.ObjectId();
    const jobId = new mongoose.Types.ObjectId();
    const appId = new mongoose.Types.ObjectId();
    await Offer.create({
      candidate: new mongoose.Types.ObjectId(),
      company: companyId,
      createdBy: new mongoose.Types.ObjectId(),
      status: 'declined',
      department: 'Marketing',
      title: 'Offer Title',
      job: jobId,
      application: appId,
      chainId: new mongoose.Types.ObjectId(),
      offerNumber: 1,
      workMode: 'onsite',
      employmentType: 'full-time',
      compensation: { period: 'monthly', currency: 'INR', base: 850000, variable: 50000 },
      jobSnapshot: { title: 'Marketing Manager', department: 'Marketing' },
      candidateSnapshot: { fullName: 'Candidate Name', email: 'candidate@test.com' },
      decline: { category: 'compensation', reason: 'Better offer elsewhere' }
    });

    const res = await api('get', '/api/v1/admin/analytics/offers', admin.token)
      .expect(200);

    expect(res.body.data.summary.averageSalary).toBe(850000);
    
    const declineInfo = res.body.data.breakdowns.declineReasons.find(x => x.key === 'compensation');
    expect(declineInfo.count).toBe(1);
  });

  it('verifies platform health system connections and background queues diagnostics', async () => {
    const admin = await account('admin');
    
    await BackgroundJob.create([
      { type: 'SEND_EMAIL', priority: 'HIGH', status: 'pending' },
      { type: 'AI_ASSESSMENT_EVALUATION', priority: 'CRITICAL', status: 'processing' },
      { type: 'SEND_EMAIL', priority: 'MEDIUM', status: 'failed', attempts: 2 }
    ]);

    const res = await api('get', '/api/v1/admin/analytics/health', admin.token)
      .expect(200);

    expect(res.body.data.summary.queueSizes).toBe(1);
    expect(res.body.data.summary.runningJobs).toBe(1);
    expect(res.body.data.summary.failedJobs).toBe(1);
    expect(res.body.data.summary.retryCounts).toBe(1);
  });

  it('verifies database compound indexes exist on key performance collections', async () => {
    const jobIndexes = await mongoose.connection.db.collection('jobs').indexes();
    const appIndexes = await mongoose.connection.db.collection('applications').indexes();
    const offerIndexes = await mongoose.connection.db.collection('offers').indexes();
    
    const jobHasCompanyIndex = jobIndexes.some(idx => idx.key.company === 1 && idx.key.status === 1);
    const appHasCompanyJobIndex = appIndexes.some(idx => idx.key.company === 1 && idx.key.job === 1 && idx.key.status === 1);
    const offerHasCompanyRecruiterIndex = offerIndexes.some(idx => idx.key.company === 1 && idx.key.createdBy === 1);
    
    expect(jobHasCompanyIndex).toBe(true);
    expect(appHasCompanyJobIndex).toBe(true);
    expect(offerHasCompanyRecruiterIndex).toBe(true);
  });

  it('verifies advanced fuzzy search matches recruiters and candidates', async () => {
    const admin = await account('admin');
    
    // Recruiter search test
    const targetRec = await account('recruiter', 'Zachary Recruiter');
    await RecruiterProfile.create({ user: targetRec.user.id, isApproved: true, company: new mongoose.Types.ObjectId() });
    
    const recRes = await api('get', '/api/v1/admin/analytics/recruiters?search=Zachary', admin.token)
      .expect(200);
    expect(recRes.body.data.breakdowns.pagination.total).toBe(1);
    expect(recRes.body.data.breakdowns.leaderboard[0].fullName).toBe('Zachary Recruiter');
    
    // Candidate search test
    const targetCand = await account('candidate', 'Yolanda Candidate');
    await CandidateProfile.create({ user: targetCand.user.id });
    
    const candRes = await api('get', '/api/v1/admin/analytics/candidates?search=Yolanda', admin.token)
      .expect(200);
    expect(candRes.body.data.summary.totalProfiles).toBe(1);
  });
});
