import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { CompanyMember } from '../src/models/CompanyMember.js';
import { Job } from '../src/models/Job.js';
import { RecruiterProfile } from '../src/models/RecruiterProfile.js';
import { User } from '../src/models/User.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let replicaSet;
let sequence = 0;
const auth = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);
const register = async (role = 'recruiter') => {
  sequence += 1;
  const response = await request(app).post('/api/v1/auth/register').send({ fullName: `${role} ${sequence}`, email: `${role}.${sequence}@business.test`, password: 'Strong!Pass123', role }).expect(201);
  return { user: response.body.data.user, token: response.body.data.accessToken };
};
const admin = async () => {
  sequence += 1;
  const user = await User.create({ fullName: 'Admin User', email: `admin.${sequence}@business.test`, password: 'Strong!Pass123', role: 'admin' });
  return { user, token: generateAccessToken(user.id) };
};
const approve = async (recruiter, adminAccount) => {
  const profile = await RecruiterProfile.findOne({ user: recruiter.user._id });
  await auth('patch', `/api/v1/recruiters/admin/${profile.id}/approve`, adminAccount.token).send({}).expect(200);
  return profile;
};
const createVerifiedCompany = async (recruiter, adminAccount, name = 'Talvix Labs') => {
  await approve(recruiter, adminAccount);
  const created = await auth('post', '/api/v1/companies', recruiter.token).send({ name, industry: 'Technology', companySize: '11-50' }).expect(201);
  await auth('patch', `/api/v1/companies/admin/${created.body.data.company._id}/verify`, adminAccount.token).send({ notes: 'Documents verified' }).expect(200);
  const updatedUser = await User.findById(recruiter.user._id);
  recruiter.token = generateAccessToken(updatedUser.id, [updatedUser.role], updatedUser.tokenVersion);
  return created.body.data.company;
};

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), RecruiterProfile.init(), Company.init(), Job.init(), CompanyMember.init()]);
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), RecruiterProfile.deleteMany({}), Company.deleteMany({}), Job.deleteMany({}), CompanyMember.deleteMany({})]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('Job Recruiter Copilot AI Integration', () => {
  it('generates a professional job description from a role title', async () => {
    const administrator = await admin();
    const recruiter = await register();
    await createVerifiedCompany(recruiter, administrator, 'AI Labs');

    const res = await auth('post', '/api/v1/jobs/ai/generate-description', recruiter.token)
      .send({ title: 'Fullstack Developer', keyRequirements: 'React, Node.js' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.description).toContain('Fullstack Developer');
    expect(res.body.data.description).toContain('React, Node.js');
  });

  it('suggests technical skill tags from job title and description', async () => {
    const administrator = await admin();
    const recruiter = await register();
    await createVerifiedCompany(recruiter, administrator, 'AI Labs');

    const res = await auth('post', '/api/v1/jobs/ai/suggest-skills', recruiter.token)
      .send({ title: 'Fullstack Developer', description: 'React and Node role.' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.skills).toBeInstanceOf(Array);
    expect(res.body.data.skills).toContain('React');
  });

  it('performs an automated safety/scam verification check', async () => {
    const administrator = await admin();
    const recruiter = await register();
    await createVerifiedCompany(recruiter, administrator, 'AI Labs');

    const res = await auth('post', '/api/v1/jobs/ai/safety-check', recruiter.token)
      .send({ title: 'Fullstack Developer', description: 'React role.' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.check.isSafe).toBe(true);
    expect(res.body.data.check.riskScore).toBeLessThan(10);
  });
});
