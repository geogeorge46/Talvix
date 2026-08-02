import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';

import { USER_ROLES } from '../constants/roles.js';
import { OWNER_PERMISSIONS } from '../constants/permissions.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { User } from '../models/User.js';
import { OnboardingSession } from '../models/OnboardingSession.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { FederatedIdentity } from '../models/FederatedIdentity.js';
import { createCandidateProfileForUser } from './candidate.service.js';
import { createRecruiterProfileForUser } from './recruiter.service.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { env } from '../config/env.js';
import { generateUniqueSlug } from '../utils/slug.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenHashesMatch,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { verifyPassword } from '../utils/password.js';

export const createSession = async (user, deviceInfo) => {
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshSession.create({
    userId: user._id,
    tokenHash,
    deviceInfo: deviceInfo || { os: 'Unknown', browser: 'Unknown', ipAddress: 'Unknown' },
    expiresAt,
    isActive: true,
  });

  user.refreshTokenHash = tokenHash;
  await user.save({ validateModifiedOnly: true });

  return { accessToken, refreshToken };
};

const databaseSupportsTransactions = () =>
  ['ReplicaSetWithPrimary', 'Sharded'].includes(
    mongoose.connection.client?.topology?.description?.type,
  );

const createRoleProfile = async (user, session) => {
  if (user.role === USER_ROLES.CANDIDATE) await createCandidateProfileForUser(user.id, session);
  if (user.role === USER_ROLES.RECRUITER) await createRecruiterProfileForUser(user.id, session);
};

const createUserAndRoleProfile = async (input) => {
  if (databaseSupportsTransactions()) {
    const session = await mongoose.startSession();
    let user;
    try {
      await session.withTransaction(async () => {
        [user] = await User.create([input], { session });
        await FederatedIdentity.create([{
          userId: user._id,
          provider: 'LOCAL',
          providerId: user.email,
          email: user.email,
        }], { session });
        await createRoleProfile(user, session);
      });
      return user;
    } finally {
      await session.endSession();
    }
  }

  const user = await User.create(input);
  try {
    await FederatedIdentity.create({
      userId: user._id,
      provider: 'LOCAL',
      providerId: user.email,
      email: user.email,
    });
    await createRoleProfile(user);
    return user;
  } catch (error) {
    await User.deleteOne({ _id: user.id });
    await FederatedIdentity.deleteOne({ userId: user.id, provider: 'LOCAL' });
    throw error;
  }
};

/** Registers a public candidate or recruiter and starts a session. */
export const registerUser = async (input) => {
  const existingUser = await User.exists({ email: input.email });

  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  try {
    const user = await createUserAndRoleProfile(input);
    const tokens = await createSession(user);
    try {
      await publishOptionalDomainEvent({
        type: DOMAIN_EVENTS.ACCOUNT_REGISTERED,
        recipientIds: [user.id],
        deduplicationKey: `account.registered:${user.id}`,
        payload: {
          userId: user.id,
          actionUrl: user.role === USER_ROLES.CANDIDATE ? '/candidate/profile' : '/recruiter/profile',
          actionLabel: 'Complete profile',
        },
      });
    } catch {
      // Registration remains successful when optional notification infrastructure is unavailable.
    }
    return { user: user.toJSON(), ...tokens };
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError('An account with this email already exists', 409);
    }
    throw error;
  }
};

/** Authenticates credentials and rotates the user's refresh token. */
export const loginUser = async ({ email, password }, deviceInfo) => {
  const user = await User.findOne({ email }).select('+password +isActive +refreshTokenHash');

  if (!user || !(await verifyPassword(password, user.password))) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive', 403);
  }

  user.lastLogin = new Date();
  const tokens = await createSession(user, deviceInfo);
  return { user: user.toJSON(), ...tokens };
};

/** Rotates a valid, currently active refresh token. */
export const refreshSession = async (refreshToken, deviceInfo) => {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const suppliedHash = hashRefreshToken(refreshToken);
  const activeSession = await RefreshSession.findOne({
    userId: payload.sub,
    tokenHash: suppliedHash,
    isActive: true,
  });

  const user = await User.findById(payload.sub).select('+isActive');

  if (!user || !user.isActive || !activeSession) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Invalidate old session
  activeSession.isActive = false;
  await activeSession.save();

  return createSession(user, deviceInfo);
};

/** Invalidates a matching refresh session if one exists. */
export const logoutUser = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const suppliedHash = hashRefreshToken(refreshToken);

    await RefreshSession.updateOne(
      { userId: payload.sub, tokenHash: suppliedHash },
      { $set: { isActive: false } }
    );

    const user = await User.findById(payload.sub).select('+refreshTokenHash');

    if (
      user &&
      refreshTokenHashesMatch(suppliedHash, user.refreshTokenHash)
    ) {
      user.refreshTokenHash = null;
      await user.save({ validateModifiedOnly: true });
    }
  } catch {
    // Logout remains idempotent when the client presents an expired or malformed cookie.
  }
};

/** Returns the current public user document. */
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user.toJSON();
};

/** Applies the validated, user-editable profile fields. */
export const updateUserProfile = async (userId, input) => {
  const user = await User.findById(userId).select('+isActive');

  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  Object.assign(user, input);
  await user.save();
  return user.toJSON();
};

let googleClient;
const getGoogleClient = () => {
  if (!googleClient) {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError('Google client configuration is missing on this server', 500);
    }
    googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
};

export const verifyGoogleIdToken = async (idToken) => {
  try {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Token verification returned no payload');
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      emailVerified: payload.email_verified || false,
    };
  } catch (error) {
    throw new AppError(error.message || 'Google token verification failed', 400);
  }
};

export const authenticateGoogleUser = async ({ idToken }, deviceInfo) => {
  const payload = await verifyGoogleIdToken(idToken);

  // 1. Check if user with googleId exists
  let user = await User.findOne({ googleId: payload.googleId }).select('+isActive +tokenVersion +blocked');
  if (user) {
    if (user.blocked) {
      throw new AppError('Account is inactive', 403);
    }
    user.lastLogin = new Date();
    const tokens = await createSession(user, deviceInfo);
    return { user: user.toJSON(), ...tokens };
  }

  // 2. Check if user with same email exists
  user = await User.findOne({ email: payload.email }).select('+isActive +tokenVersion +blocked +providers');
  if (user) {
    if (user.blocked) {
      throw new AppError('Account is inactive', 403);
    }
    // Link Google identity
    user.googleId = payload.googleId;
    if (!user.providers.includes('GOOGLE')) {
      user.providers.push('GOOGLE');
    }
    if (payload.emailVerified) {
      user.emailVerified = true;
    }
    user.lastLogin = new Date();
    await user.save({ validateModifiedOnly: true });

    // Create FederatedIdentity
    const federatedExists = await FederatedIdentity.exists({
      userId: user._id,
      provider: 'GOOGLE',
    });
    if (!federatedExists) {
      await FederatedIdentity.create({
        userId: user._id,
        provider: 'GOOGLE',
        providerId: payload.googleId,
        email: payload.email,
      });
    }

    const tokens = await createSession(user, deviceInfo);
    return { user: user.toJSON(), ...tokens };
  }

  // 3. New user - return onboarding session token
  const session = await OnboardingSession.create({
    email: payload.email,
    googleId: payload.googleId,
    name: payload.name,
    avatar: payload.avatar,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
  });

  return { onboardingRequired: true, onboardingSessionId: session._id.toString() };
};

export const completeGoogleOnboarding = async ({ onboardingSessionId, role, onboardingData }, deviceInfo) => {
  const sessionData = await OnboardingSession.findById(onboardingSessionId);
  if (!sessionData) {
    throw new AppError('Onboarding session has expired or is invalid', 400);
  }

  if (!['candidate', 'recruiter'].includes(role)) {
    throw new AppError('Invalid onboarding role', 400);
  }

  let user;
  if (databaseSupportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        user = await saveGoogleUserAndProfile(sessionData, role, onboardingData, session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    user = await saveGoogleUserAndProfile(sessionData, role, onboardingData);
  }

  await OnboardingSession.deleteOne({ _id: onboardingSessionId });
  const tokens = await createSession(user, deviceInfo);
  return { user: user.toJSON(), ...tokens };
};

const saveGoogleUserAndProfile = async (sessionData, role, onboardingData, dbSession) => {
  const opt = dbSession ? { session: dbSession } : {};

  // Check unique email before creation
  const emailTaken = await User.exists({ email: sessionData.email }).session(dbSession ?? null);
  if (emailTaken) {
    throw new AppError('An account with this email already exists', 409);
  }

  const [user] = await User.create([{
    fullName: sessionData.name,
    name: sessionData.name,
    email: sessionData.email,
    password: null,
    role: role,
    roles: [role],
    providers: ['GOOGLE'],
    googleId: sessionData.googleId,
    avatar: sessionData.avatar,
    emailVerified: true,
    recruiterVerificationStatus: role === 'recruiter' ? 'pending' : 'none',
  }], opt);

  // Create Google FederatedIdentity
  await FederatedIdentity.create([{
    userId: user._id,
    provider: 'GOOGLE',
    providerId: sessionData.googleId,
    email: sessionData.email,
  }], opt);

  if (role === 'candidate') {
    await CandidateProfile.create([{
      user: user._id,
      education: [{
        institution: onboardingData.college,
        degree: onboardingData.degree,
        startYear: new Date().getFullYear() - 4,
        currentlyStudying: false,
      }],
      skills: (onboardingData.skills || []).map(name => ({
        name,
        proficiency: 'intermediate',
        yearsOfExperience: 1,
      })),
    }], opt);
  } else if (role === 'recruiter') {
    const slug = await generateUniqueSlug(onboardingData.companyName, (candidate) => Company.exists({ slug: candidate }).session(dbSession ?? null));
    const [company] = await Company.create([{
      name: onboardingData.companyName,
      slug,
      website: onboardingData.companyWebsite,
      email: onboardingData.companyEmail,
      owner: user._id,
      verificationStatus: 'pending',
      isActive: true,
    }], opt);

    await createRecruiterProfileForUser(user._id, dbSession);
    await Company.updateOne({ _id: company._id }, { $addToSet: { members: user._id } }).session(dbSession ?? null);
    await mongoose.model('CompanyMembership').create([{
      companyId: company._id,
      userId: user._id,
      role: 'owner',
      status: 'active',
      permissions: OWNER_PERMISSIONS,
    }], opt);
  }

  return user;
};

export const linkGoogleAccount = async (userId, idToken) => {
  const payload = await verifyGoogleIdToken(idToken);

  const existing = await User.findOne({ googleId: payload.googleId });
  if (existing) {
    if (existing.id === userId) {
      return existing.toJSON();
    }
    throw new AppError('This Google account is already linked to another profile', 409);
  }

  const user = await User.findById(userId).select('+providers');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.googleId = payload.googleId;
  if (!user.providers.includes('GOOGLE')) {
    user.providers.push('GOOGLE');
  }
  if (payload.emailVerified) {
    user.emailVerified = true;
  }
  await user.save();

  const federatedExists = await FederatedIdentity.exists({
    userId: user._id,
    provider: 'GOOGLE',
  });
  if (!federatedExists) {
    await FederatedIdentity.create({
      userId: user._id,
      provider: 'GOOGLE',
      providerId: payload.googleId,
      email: payload.email,
    });
  }

  return user.toJSON();
};

export const unlinkGoogleAccount = async (userId) => {
  const user = await User.findById(userId).select('+password +providers');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Check if password exists or local federated identity exists to avoid lockout
  const localIdentityExists = await FederatedIdentity.exists({
    userId: user._id,
    provider: 'LOCAL',
  });
  const canUnlink = localIdentityExists || user.password;
  if (!canUnlink) {
    throw new AppError('Cannot unlink Google: please set a password first to avoid locking your account', 400);
  }

  user.googleId = null;
  user.providers = user.providers.filter(p => p !== 'GOOGLE');
  await user.save();

  await FederatedIdentity.deleteOne({
    userId: user._id,
    provider: 'GOOGLE',
  });

  return user.toJSON();
};
