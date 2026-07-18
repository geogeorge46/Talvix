import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { User } from '../src/models/User.js';

let replicaSet;
let sequence = 0;

const credentials = (role = 'candidate') => {
  sequence += 1;
  return {
    fullName: `${role} ${sequence}`,
    email: `${role}.${sequence}@talvix.test`,
    password: 'Strong!Pass123',
    role,
  };
};

const register = async (role = 'candidate') => {
  const input = credentials(role);
  const response = await request(app).post('/api/v1/auth/register').send(input).expect(201);
  return { input, response, token: response.body.data.accessToken, user: response.body.data.user };
};

const authenticated = (method, path, token) => request(app)[method](path).set('Authorization', `Bearer ${token}`);

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
  await Promise.all([User.init(), CandidateProfile.init()]);
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), CandidateProfile.deleteMany({})]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('candidate profile registration', () => {
  it('creates a profile atomically for candidates but not recruiters', async () => {
    const candidate = await register();
    const recruiter = await register('recruiter');

    expect(await CandidateProfile.exists({ user: candidate.user._id })).toBeTruthy();
    expect(await CandidateProfile.exists({ user: recruiter.user._id })).toBeNull();
  });

  it('lets a candidate retrieve their own profile', async () => {
    const candidate = await register();
    const response = await authenticated('get', '/api/v1/candidates/me', candidate.token).expect(200);

    expect(response.body.data.profile.user.email).toBe(candidate.input.email);
    expect(response.body.data.profile.profileCompletion).toBe(0);
  });
});

describe('candidate authorization and protected updates', () => {
  it('prevents recruiters from modifying candidate self-service data', async () => {
    const recruiter = await register('recruiter');
    await authenticated('patch', '/api/v1/candidates/me', recruiter.token)
      .send({ headline: 'Unauthorized' })
      .expect(403);
  });

  it('prevents candidates from using recruiter search', async () => {
    const candidate = await register();
    await authenticated('get', '/api/v1/candidates', candidate.token).expect(403);
  });

  it('rejects protected and unknown fields instead of mass assigning them', async () => {
    const candidate = await register();
    const response = await authenticated('patch', '/api/v1/candidates/me', candidate.token)
      .send({ profileCompletion: 100, user: new mongoose.Types.ObjectId().toString() })
      .expect(400);

    expect(response.body.message).toBe('Validation failed');
    const profile = await CandidateProfile.findOne({ user: candidate.user._id });
    expect(profile.profileCompletion).toBe(0);
  });
});

describe('nested candidate data', () => {
  it('adds, updates, and deletes education and validates nested IDs', async () => {
    const candidate = await register();
    const created = await authenticated('post', '/api/v1/candidates/me/education', candidate.token)
      .send({ institution: 'Talvix University', degree: 'B.Tech', startYear: 2020, endYear: 2024 })
      .expect(201);
    const educationId = created.body.data.entries[0]._id;

    const updated = await authenticated(
      'patch',
      `/api/v1/candidates/me/education/${educationId}`,
      candidate.token,
    )
      .send({ grade: 'A' })
      .expect(200);
    expect(updated.body.data.entry.grade).toBe('A');

    await authenticated('delete', '/api/v1/candidates/me/education/not-an-id', candidate.token).expect(400);
    await authenticated(
      'delete',
      `/api/v1/candidates/me/education/${educationId}`,
      candidate.token,
    ).expect(200);
    expect((await CandidateProfile.findOne({ user: candidate.user._id })).education).toHaveLength(0);
  });

  it('manages skills and rejects case-insensitive duplicates', async () => {
    const candidate = await register();
    const created = await authenticated('post', '/api/v1/candidates/me/skills', candidate.token)
      .send([
        { name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4 },
        { name: 'MongoDB', proficiency: 'intermediate', yearsOfExperience: 3 },
      ])
      .expect(201);
    const skillId = created.body.data.entries[0]._id;

    await authenticated('post', '/api/v1/candidates/me/skills', candidate.token)
      .send({ name: 'node.JS', proficiency: 'expert', yearsOfExperience: 5 })
      .expect(409);

    const updated = await authenticated(
      'patch',
      `/api/v1/candidates/me/skills/${skillId}`,
      candidate.token,
    )
      .send({ proficiency: 'expert' })
      .expect(200);
    expect(updated.body.data.entry.proficiency).toBe('expert');

    await authenticated('delete', `/api/v1/candidates/me/skills/${skillId}`, candidate.token).expect(200);
  });

  it('recalculates completion after relevant updates', async () => {
    const candidate = await register();
    await authenticated('patch', '/api/v1/candidates/me', candidate.token)
      .send({ headline: 'Backend Engineer', bio: 'Production Node.js engineer.' })
      .expect(200);
    await authenticated('post', '/api/v1/candidates/me/skills', candidate.token)
      .send({ name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4 })
      .expect(201);

    const profile = await CandidateProfile.findOne({ user: candidate.user._id });
    expect(profile.profileCompletion).toBe(30);
  });
});

describe('candidate privacy and search', () => {
  it('hides private profiles and exposes public profiles to recruiters', async () => {
    const candidate = await register();
    const recruiter = await register('recruiter');
    const profile = await CandidateProfile.findOne({ user: candidate.user._id });

    await authenticated('patch', '/api/v1/candidates/me', candidate.token)
      .send({ profileVisibility: 'private' })
      .expect(200);
    await authenticated('get', `/api/v1/candidates/${profile.id}`, recruiter.token).expect(404);

    await authenticated('patch', '/api/v1/candidates/me', candidate.token)
      .send({ profileVisibility: 'public' })
      .expect(200);
    await authenticated('get', `/api/v1/candidates/${profile.id}`, recruiter.token).expect(200);
  });

  it('paginates and filters visible profiles without returning private profiles', async () => {
    const first = await register();
    const second = await register();
    const privateCandidate = await register();
    const recruiter = await register('recruiter');

    await authenticated('patch', '/api/v1/candidates/me', first.token)
      .send({ headline: 'Node Platform Engineer', location: { city: 'Bengaluru', country: 'India' }, profileVisibility: 'public' })
      .expect(200);
    await authenticated('post', '/api/v1/candidates/me/skills', first.token)
      .send({ name: 'Node.js', proficiency: 'expert', yearsOfExperience: 5 })
      .expect(201);
    await authenticated('patch', '/api/v1/candidates/me', second.token)
      .send({ headline: 'Frontend Engineer', profileVisibility: 'public' })
      .expect(200);
    await authenticated('patch', '/api/v1/candidates/me', privateCandidate.token)
      .send({ headline: 'Node Private Engineer', profileVisibility: 'private' })
      .expect(200);

    const filtered = await authenticated(
      'get',
      '/api/v1/candidates?skills=Node.js&location=Bengaluru&page=1&limit=1',
      recruiter.token,
    ).expect(200);
    expect(filtered.body.data.candidates).toHaveLength(1);
    expect(filtered.body.data.pagination).toMatchObject({ page: 1, limit: 1, total: 1, pages: 1 });

    const searched = await authenticated(
      'get',
      '/api/v1/candidates?search=Node&page=1&limit=10',
      recruiter.token,
    ).expect(200);
    expect(searched.body.data.pagination.total).toBe(1);
  });
});
