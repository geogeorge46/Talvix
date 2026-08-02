import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';

import { app } from '../src/app.js';
import { User } from '../src/models/User.js';
import { PasswordResetToken } from '../src/models/PasswordResetToken.js';
import { RefreshSession } from '../src/models/RefreshSession.js';
import { FederatedIdentity } from '../src/models/FederatedIdentity.js';
import { verifyPassword } from '../src/utils/password.js';
import { generateAccessToken } from '../src/utils/jwt.js';

let repl;

beforeAll(async () => {
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri());
  await Promise.all([
    User.init(),
    PasswordResetToken.init(),
    RefreshSession.init(),
    FederatedIdentity.init(),
  ]);
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    PasswordResetToken.deleteMany({}),
    RefreshSession.deleteMany({}),
    FederatedIdentity.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await repl.stop();
});

const registerUser = async (email, password = 'Strong!Pass123') => {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Test User',
      email,
      password,
      role: 'candidate',
    })
    .expect(201);
  return response.body.data;
};

const createGoogleOnlyUser = async (email) => {
  const user = await User.create({
    fullName: 'Google User',
    name: 'Google User',
    email,
    password: null,
    role: 'candidate',
    roles: ['candidate'],
    googleId: 'google-sub-12345',
    emailVerified: true,
  });

  await FederatedIdentity.create({
    userId: user._id,
    provider: 'GOOGLE',
    providerId: 'google-sub-12345',
    email,
  });

  return user;
};

describe('Password Recovery System', () => {
  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns 200 with generic success message for non-existent emails', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@talvix.test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset instructions have been sent');

      // Assert no token created
      const tokensCount = await PasswordResetToken.countDocuments();
      expect(tokensCount).toBe(0);
    });

    it('creates a PasswordResetToken for registered local accounts', async () => {
      const email = 'local@talvix.test';
      await registerUser(email);

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect(response.body.success).toBe(true);

      const dbToken = await PasswordResetToken.findOne();
      expect(dbToken).not.toBeNull();
      expect(dbToken.usedAt).toBeNull();
      expect(dbToken.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns generic response and does NOT create a token for Google-only accounts', async () => {
      const email = 'googleonly@talvix.test';
      await createGoogleOnlyUser(email);

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Assert no token created for Google-only accounts
      const tokensCount = await PasswordResetToken.countDocuments();
      expect(tokensCount).toBe(0);
    });
  });

  describe('GET /api/v1/auth/reset-password/validate', () => {
    it('returns 200 for a valid reset token', async () => {
      const user = await createGoogleOnlyUser('test@validate.test'); // temp user
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      const response = await request(app)
        .get(`/api/v1/auth/reset-password/validate?token=${rawToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token is valid');
    });

    it('returns 400 for an invalid, expired, or already used reset token', async () => {
      // 1. Invalid token
      await request(app)
        .get('/api/v1/auth/reset-password/validate?token=nonexistent_token')
        .expect(400);

      // 2. Expired token
      const user = await createGoogleOnlyUser('test-expired@validate.test');
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000), // Expired 1s ago
      });

      await request(app)
        .get(`/api/v1/auth/reset-password/validate?token=${rawToken}`)
        .expect(400);

      // 3. Already used token
      const rawUsedToken = crypto.randomBytes(32).toString('hex');
      const usedTokenHash = crypto.createHash('sha256').update(rawUsedToken).digest('hex');

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash: usedTokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: new Date(),
      });

      await request(app)
        .get(`/api/v1/auth/reset-password/validate?token=${rawUsedToken}`)
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('successfully resets password, increments tokenVersion, and revokes refresh sessions', async () => {
      const email = 'reset@talvix.test';
      const registerData = await registerUser(email);
      const user = await User.findOne({ email }).select('+password');
      const originalPasswordHash = user.password;
      const originalVersion = user.tokenVersion || 1;

      // Mock an active refresh session
      await RefreshSession.create({
        userId: user._id,
        tokenHash: 'dummy_hash',
        expiresAt: new Date(Date.now() + 100000),
        isActive: true,
      });

      // Request forgot password to get token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });

      // Submit reset password
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'New!StrongPass1234',
        });

      if (response.status !== 200) {
        console.error('RESET PASSWORD FAIL:', response.body);
      }
      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);

      // Verify password hash updated
      const updatedUser = await User.findById(user._id).select('+password');
      expect(updatedUser.password).not.toBe(originalPasswordHash);
      expect(await verifyPassword('New!StrongPass1234', updatedUser.password)).toBe(true);

      // Verify tokenVersion incremented
      expect(updatedUser.tokenVersion).toBe(originalVersion + 1);

      // Verify token marked used
      const dbToken = await PasswordResetToken.findOne({ tokenHash });
      expect(dbToken.usedAt).not.toBeNull();

      // Verify refresh sessions revoked
      const activeSessionsCount = await RefreshSession.countDocuments({ userId: user._id, isActive: true });
      expect(activeSessionsCount).toBe(0);
    });

    it('rejects resetting with an expired or consumed token', async () => {
      const email = 'reset-fail@talvix.test';
      const registerData = await registerUser(email);
      const user = await User.findOne({ email });

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'New!StrongPass1234',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/set-password (SSO accounts)', () => {
    it('provisions a local password hash and LOCAL FederatedIdentity record', async () => {
      const email = 'sso-set@talvix.test';
      const user = await createGoogleOnlyUser(email);

      // We need to generate a valid access token to authenticate request.user
      const loginResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          fullName: 'SSO Set User',
          email: 'dummy@talvix.test',
          password: 'Strong!Pass123',
          role: 'candidate',
        });
      const token = loginResponse.body.data.accessToken;

      // Mock req.user.id on request by injecting token belonging to the Google user
      const customToken = generateAccessToken(user._id, ['candidate'], 1);

      const response = await request(app)
        .post('/api/v1/auth/set-password')
        .set('Authorization', `Bearer ${customToken}`)
        .send({ password: 'New!GoogleLocalPass123' })
        .expect(200);

      expect(response.body.success).toBe(true);

      const updatedUser = await User.findById(user._id).select('+password');
      expect(updatedUser.password).not.toBeNull();
      expect(await verifyPassword('New!GoogleLocalPass123', updatedUser.password)).toBe(true);

      // Verify LOCAL FederatedIdentity created
      const localIdentity = await FederatedIdentity.findOne({
        userId: user._id,
        provider: 'LOCAL',
      });
      expect(localIdentity).not.toBeNull();
      expect(localIdentity.providerId).toBe(email);
    });

    it('rejects set-password if local password is already bound', async () => {
      const email = 'local-exists@talvix.test';
      const registerData = await registerUser(email);
      const user = await User.findOne({ email });

      const customToken = generateAccessToken(user._id, ['candidate'], 1);

      await request(app)
        .post('/api/v1/auth/set-password')
        .set('Authorization', `Bearer ${customToken}`)
        .send({ password: 'Another!StrongPass123' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/auth/change-password', () => {
    it('validates current password, updates it, and invalidates other sessions', async () => {
      const email = 'change@talvix.test';
      const registerData = await registerUser(email, 'Original!Pass123');
      const user = await User.findOne({ email });

      const customToken = generateAccessToken(user._id, ['candidate'], 1);

      // Mock an active refresh session
      await RefreshSession.create({
        userId: user._id,
        tokenHash: 'dummy_session_hash',
        expiresAt: new Date(Date.now() + 100000),
        isActive: true,
      });

      const response = await request(app)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${customToken}`)
        .send({
          currentPassword: 'Original!Pass123',
          newPassword: 'Changed!Pass123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify hash updated
      const updatedUser = await User.findById(user._id).select('+password');
      expect(await verifyPassword('Changed!Pass123', updatedUser.password)).toBe(true);

      // Verify refresh sessions revoked
      const activeSessionsCount = await RefreshSession.countDocuments({ userId: user._id, isActive: true });
      expect(activeSessionsCount).toBe(0);
    });
  });
});
