import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Company } from '../src/models/Company.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { Application } from '../src/models/Application.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const api = (path, token) => {
  const req = request(app).get(path);
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
};

const account = async (role = 'candidate') => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} User ${sequence}`,
    email: `search.${sequence}@talvix.test`,
    password: 'Strong!Pass123',
    role,
  });
  return { user, token: generateAccessToken(user.id) };
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await User.init();
  await Company.init();
  await Job.init();
  await RecruiterProfile.init();
  await Application.init();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Company.deleteMany({});
  await Job.deleteMany({});
  await RecruiterProfile.deleteMany({});
  await Application.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Global Search API', () => {
  it('denies unauthenticated requests', async () => {
    await request(app).get('/api/v1/search?q=test').expect(401);
  });

  it('allows candidates to search published jobs', async () => {
    const candidate = await account('candidate');
    const company = await Company.create({ name: 'Acme Corp', slug: 'acme-corp', owner: new mongoose.Types.ObjectId() });
    
    // Create a published job and a draft job
    await Job.create({
      title: 'React Developer',
      status: 'published',
      company: company._id,
      createdBy: new mongoose.Types.ObjectId(),
      workMode: 'remote',
      employmentType: 'full-time',
      description: 'Cool job',
      slug: 'react-developer'
    });

    await Job.create({
      title: 'Angular Developer',
      status: 'draft',
      company: company._id,
      createdBy: new mongoose.Types.ObjectId(),
      workMode: 'remote',
      employmentType: 'full-time',
      description: 'Unpublished job',
      slug: 'angular-developer'
    });

    const res = await api('/api/v1/search?q=react', candidate.token).expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('React Developer');
    expect(res.body.data[0].type).toBe('Job');

    const draftRes = await api('/api/v1/search?q=angular', candidate.token).expect(200);
    expect(draftRes.body.data.length).toBe(0);
  });

  it('allows recruiters to search company-owned jobs and candidates', async () => {
    const recruiter = await account('recruiter');
    const company = await Company.create({ name: 'Hiring Corp', slug: 'hiring-corp', owner: recruiter.user._id });
    
    await RecruiterProfile.create({
      user: recruiter.user._id,
      company: company._id,
      isApproved: true,
    });

    const job = await Job.create({
      title: 'Golang Engineer',
      status: 'published',
      company: company._id,
      createdBy: recruiter.user._id,
      workMode: 'remote',
      employmentType: 'full-time',
      description: 'Go job',
      slug: 'golang-engineer'
    });

    const candidateUser = await User.create({
      fullName: 'Alice Jones',
      email: 'alice@talvix.test',
      password: 'Strong!Pass123',
      role: 'candidate',
    });

    await Application.create({
      job: job._id,
      candidate: candidateUser._id,
      candidateProfile: new mongoose.Types.ObjectId(),
      company: company._id,
      applicationNumber: `TVX-SEARCH-${sequence}-${Date.now()}`,
      status: 'submitted',
      candidateSnapshot: { fullName: candidateUser.fullName },
      jobSnapshot: { title: job.title },
      skillMatch: { score: 0, matchedSkills: [], missingRequiredSkills: [], breakdown: [] }
    });

    // Search jobs
    const jobRes = await api('/api/v1/search?q=golang', recruiter.token).expect(200);
    expect(jobRes.body.data.length).toBe(1);
    expect(jobRes.body.data[0].title).toBe('Golang Engineer');

    // Search candidates
    const candRes = await api('/api/v1/search?q=alice', recruiter.token).expect(200);
    expect(candRes.body.data.length).toBe(1);
    expect(candRes.body.data[0].title).toBe('Alice Jones');
    expect(candRes.body.data[0].type).toBe('Candidate');
  });

  it('allows admins to search globally across users, companies, and jobs', async () => {
    const admin = await account('admin');
    
    const company = await Company.create({ name: 'Mega Corp', slug: 'mega-corp', owner: new mongoose.Types.ObjectId() });
    await User.create({
      fullName: 'Super Admin User',
      email: 'superadmin@talvix.test',
      password: 'Strong!Pass123',
      role: 'admin',
    });

    await Job.create({
      title: 'DevOps Specialist',
      status: 'published',
      company: company._id,
      createdBy: admin.user._id,
      workMode: 'remote',
      employmentType: 'full-time',
      description: 'Cloud',
      slug: 'devops-specialist'
    });

    // Search DevOps job
    const jobRes = await api('/api/v1/search?q=devops', admin.token).expect(200);
    expect(jobRes.body.data.length).toBe(1);
    expect(jobRes.body.data[0].title).toBe('DevOps Specialist');

    // Search Mega Corp company
    const compRes = await api('/api/v1/search?q=mega', admin.token).expect(200);
    expect(compRes.body.data.length).toBe(1);
    expect(compRes.body.data[0].title).toBe('Mega Corp');

    // Search User
    const userRes = await api('/api/v1/search?q=super', admin.token).expect(200);
    expect(userRes.body.data.length).toBe(1);
    expect(userRes.body.data[0].title).toBe('Super Admin User');
  });
});
