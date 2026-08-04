import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { User } from '../src/models/User.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;

const api = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

const account = async (role) => {
  sequence += 1;
  const user = await User.create({
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@adminanalytics.test`,
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
    CandidateProfile.init()
  ]);
});

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Talvix Admin Analytics Dashboard Phase 1 Features', () => {
  it('enforces RBAC boundaries and restricts analytics to platform admins only', async () => {
    const candidate = await account('candidate');
    const recruiter = await account('recruiter');
    const admin = await account('admin');

    // Candidate should be blocked
    await api('get', '/api/v1/admin/analytics/overview', candidate.token)
      .expect(403);

    // Recruiter should be blocked
    await api('get', '/api/v1/admin/analytics/overview', recruiter.token)
      .expect(403);

    // Admin should pass
    const res = await api('get', '/api/v1/admin/analytics/overview', admin.token)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
  });

  it('calculates candidate top universities, skills, and applies university/department filters', async () => {
    const admin = await account('admin');

    // Create candidate profile
    const candidateA = await account('candidate');
    await CandidateProfile.create({
      user: candidateA.user.id,
      fullName: candidateA.user.fullName,
      education: [{ institution: 'Harvard University', degree: 'Ph.D', fieldOfStudy: 'Computer Science', startYear: 2018 }],
      skills: [{ name: 'React', proficiency: 'expert', yearsOfExperience: 5 }]
    });

    const res = await api('get', '/api/v1/admin/analytics/candidates', admin.token)
      .expect(200);

    expect(res.body.data.summary.totalProfiles).toBe(1);
    expect(res.body.data.breakdowns.topUniversities).toBeDefined();
    expect(res.body.data.breakdowns.topUniversities[0].key).toBe('Harvard University');
    expect(res.body.data.breakdowns.topSkills[0].key).toBe('React');

    // Test university filtering
    const filteredRes = await api('get', '/api/v1/admin/analytics/candidates?university=Harvard+University', admin.token)
      .expect(200);
    expect(filteredRes.body.data.summary.totalProfiles).toBe(1);

    const emptyRes = await api('get', '/api/v1/admin/analytics/candidates?university=Stanford+University', admin.token)
      .expect(200);
    expect(emptyRes.body.data.summary.totalProfiles).toBe(0);
  });

  it('retrieves detailed platform health statistics', async () => {
    const admin = await account('admin');

    const res = await api('get', '/api/v1/admin/analytics/health', admin.token)
      .expect(200);

    expect(res.body.data.summary.databaseState).toBe('connected');
    expect(res.body.data.summary.uptimeSeconds).toBeGreaterThan(0);
  });
});
