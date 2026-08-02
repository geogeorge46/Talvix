import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { User } from '../src/models/User.js';
import { RefreshSession } from '../src/models/RefreshSession.js';
import { FederatedIdentity } from '../src/models/FederatedIdentity.js';
import { OnboardingSession } from '../src/models/OnboardingSession.js';
import { CandidateProfile } from '../src/models/CandidateProfile.js';
import { Company } from '../src/models/Company.js';

let repl;
let originalFetch;
let app;

beforeAll(async () => {
  // Set env vars before importing app so env configuration parses them successfully
  process.env.GITHUB_CLIENT_ID = 'mock-client-id';
  process.env.GITHUB_CLIENT_SECRET = 'mock-client-secret';

  const appModule = await import('../src/app.js');
  app = appModule.app;

  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all([
    User.init(),
    RefreshSession.init(),
    FederatedIdentity.init(),
    OnboardingSession.init(),
    CandidateProfile.init(),
    Company.init(),
  ]);

  originalFetch = global.fetch;
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RefreshSession.deleteMany({}),
    FederatedIdentity.deleteMany({}),
    OnboardingSession.deleteMany({}),
    CandidateProfile.deleteMany({}),
    Company.deleteMany({}),
  ]);
  vi.restoreAllMocks();
});

afterAll(async () => {
  global.fetch = originalFetch;
  await mongoose.disconnect();
  if (repl) await repl.stop();
});

const setupMockFetch = (githubId, email, name = 'GitHub User') => {
  global.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('/login/oauth/access_token')) {
      return Promise.resolve({
        json: () => Promise.resolve({ access_token: 'mock-access-token' }),
      });
    }
    if (url.includes('/api.github.com/user/emails')) {
      return Promise.resolve({
        json: () => Promise.resolve([{ email, primary: true, verified: true }]),
      });
    }
    if (url.includes('/api.github.com/user')) {
      return Promise.resolve({
        json: () => Promise.resolve({ id: githubId, name, login: 'githubuser', avatar_url: 'https://avatar.url/123' }),
      });
    }
    return Promise.reject(new Error('Unknown mock URL: ' + url));
  });
};

describe('GitHub OAuth SSO System', () => {
  describe('POST /api/v1/auth/github', () => {
    it('returns onboardingRequired and creates OnboardingSession for new GitHub users', async () => {
      setupMockFetch(12345, 'newgithub@talvix.test', 'GitHub Legend');

      const response = await request(app)
        .post('/api/v1/auth/github')
        .send({ code: 'mock-code' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.onboardingRequired).toBe(true);
      expect(response.body.data.onboardingSessionId).toBeDefined();

      const session = await OnboardingSession.findById(response.body.data.onboardingSessionId);
      expect(session).toBeDefined();
      expect(session.githubId).toBe('12345');
      expect(session.email).toBe('newgithub@talvix.test');
    });

    it('links GitHub and logs in automatically if the email already belongs to a LOCAL user', async () => {
      // 1. Create local user
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Local User',
          email: 'local@talvix.test',
          password: 'Password123!',
          role: 'candidate',
        })
        .expect(201);

      // 2. Mock GitHub fetch with matching email
      setupMockFetch(9999, 'local@talvix.test');

      const response = await request(app)
        .post('/api/v1/auth/github')
        .send({ code: 'mock-code' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.githubId).toBe('9999');

      // Verify FederatedIdentity was created
      const federated = await FederatedIdentity.findOne({ userId: response.body.data.user._id, provider: 'GITHUB' });
      expect(federated).not.toBeNull();
      expect(federated.providerId).toBe('9999');
    });

    it('logs in existing user directly if githubId matches', async () => {
      // 1. Create existing github user
      const user = await User.create({
        fullName: 'Github User',
        name: 'Github User',
        email: 'git@talvix.test',
        githubId: '7777',
        providers: ['GITHUB'],
        role: 'candidate',
        roles: ['candidate'],
        emailVerified: true,
      });

      await FederatedIdentity.create({
        userId: user._id,
        provider: 'GITHUB',
        providerId: '7777',
        email: 'git@talvix.test',
      });

      setupMockFetch(7777, 'git@talvix.test');

      const response = await request(app)
        .post('/api/v1/auth/github')
        .send({ code: 'mock-code' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user._id).toBe(user.id);
    });
  });

  describe('POST /api/v1/auth/github/complete', () => {
    it('completes onboarding for candidate role', async () => {
      // 1. Create onboarding session
      const session = await OnboardingSession.create({
        email: 'gitonboard@talvix.test',
        githubId: '8888',
        name: 'GitHub Candidate',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/auth/github/complete')
        .send({
          onboardingSessionId: session.id,
          role: 'candidate',
          onboardingData: {
            college: 'Stanford University',
            degree: 'B.S. Computer Science',
            skills: ['React', 'TypeScript'],
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.role).toBe('candidate');

      // Verify profile setup
      const profile = await CandidateProfile.findOne({ user: response.body.data.user._id });
      expect(profile).not.toBeNull();
      expect(profile.education[0].institution).toBe('Stanford University');
      expect(profile.skills[0].name).toBe('React');

      // Verify onboarding session cleaned up
      const deletedSession = await OnboardingSession.findById(session.id);
      expect(deletedSession).toBeNull();
    });
  });

  describe('Link / Unlink settings connected accounts', () => {
    it('links and unlinks GitHub from standard user settings successfully', async () => {
      // 1. Register and login local user
      const registerRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'Link User',
          email: 'link@talvix.test',
          password: 'Password123!',
          role: 'candidate',
        })
        .expect(201);

      const token = registerRes.body.data.accessToken;

      setupMockFetch(1010, 'link@talvix.test');

      // 2. Link account
      const linkRes = await request(app)
        .post('/api/v1/auth/link-github')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'mock-code' })
        .expect(200);

      expect(linkRes.body.success).toBe(true);
      expect(linkRes.body.data.user.githubId).toBe('1010');

      // Verify DB
      const federated = await FederatedIdentity.findOne({ userId: linkRes.body.data.user._id, provider: 'GITHUB' });
      expect(federated).not.toBeNull();

      // 3. Unlink account
      const unlinkRes = await request(app)
        .delete('/api/v1/auth/unlink-github')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(unlinkRes.body.success).toBe(true);
      expect(unlinkRes.body.data.user.githubId).toBeNull();

      // Verify DB cleaned
      const deletedFederated = await FederatedIdentity.findOne({ userId: linkRes.body.data.user._id, provider: 'GITHUB' });
      expect(deletedFederated).toBeNull();
    });
  });
});
