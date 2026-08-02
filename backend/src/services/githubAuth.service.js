import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { OnboardingSession } from '../models/OnboardingSession.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { FederatedIdentity } from '../models/FederatedIdentity.js';
import { createSession } from './auth.service.js';
import { createRecruiterProfileForUser } from './recruiter.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { generateUniqueSlug } from '../utils/slug.js';
import { OWNER_PERMISSIONS } from '../constants/permissions.js';

const getGithubTokenAndProfile = async (code) => {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    throw new AppError('GitHub OAuth configuration is missing on this server', 500);
  }

  // 1. Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new AppError(tokenData.error_description || 'GitHub OAuth token exchange failed', 400);
  }
  const accessToken = tokenData.access_token;

  // 2. Fetch profile info
  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Talvix-API',
    },
  });
  const profile = await profileResponse.json();
  if (!profile.id) {
    throw new AppError('Failed to fetch GitHub profile', 400);
  }

  // 3. Fetch user emails
  const emailsResponse = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Talvix-API',
    },
  });
  const emails = await emailsResponse.json();
  let email = null;
  if (Array.isArray(emails)) {
    const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.primary) || emails[0];
    if (primary) {
      email = primary.email;
    }
  }

  if (!email) {
    throw new AppError('A verified primary email address is required from your GitHub account', 400);
  }

  return {
    githubId: String(profile.id),
    email: email.toLowerCase(),
    name: profile.name || profile.login,
    avatar: profile.avatar_url || null,
  };
};

export const authenticateGithubUser = async ({ code }, deviceInfo) => {
  const payload = await getGithubTokenAndProfile(code);

  // 1. Check if user with githubId exists
  let user = await User.findOne({ githubId: payload.githubId }).select('+isActive +tokenVersion +blocked');
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
    // Link GitHub identity
    user.githubId = payload.githubId;
    if (!user.providers.includes('GITHUB')) {
      user.providers.push('GITHUB');
    }
    user.emailVerified = true;
    user.lastLogin = new Date();
    await user.save({ validateModifiedOnly: true });

    // Create FederatedIdentity
    const federatedExists = await FederatedIdentity.exists({
      userId: user._id,
      provider: 'GITHUB',
    });
    if (!federatedExists) {
      await FederatedIdentity.create({
        userId: user._id,
        provider: 'GITHUB',
        providerId: payload.githubId,
        email: payload.email,
      });
    }

    const tokens = await createSession(user, deviceInfo);
    return { user: user.toJSON(), ...tokens };
  }

  // 3. New user - return onboarding session token
  const session = await OnboardingSession.create({
    email: payload.email,
    githubId: payload.githubId,
    name: payload.name,
    avatar: payload.avatar,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
  });

  return { onboardingRequired: true, onboardingSessionId: session._id.toString() };
};

const databaseSupportsTransactions = () =>
  ['ReplicaSetWithPrimary', 'Sharded'].includes(
    mongoose.connection.client?.topology?.description?.type,
  );

export const completeGithubOnboarding = async ({ onboardingSessionId, role, onboardingData }, deviceInfo) => {
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
        user = await saveGithubUserAndProfile(sessionData, role, onboardingData, session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    user = await saveGithubUserAndProfile(sessionData, role, onboardingData);
  }

  await OnboardingSession.deleteOne({ _id: onboardingSessionId });
  const tokens = await createSession(user, deviceInfo);
  return { user: user.toJSON(), ...tokens };
};

const saveGithubUserAndProfile = async (sessionData, role, onboardingData, dbSession) => {
  const opt = dbSession ? { session: dbSession } : {};

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
    providers: ['GITHUB'],
    githubId: sessionData.githubId,
    avatar: sessionData.avatar,
    emailVerified: true,
    recruiterVerificationStatus: role === 'recruiter' ? 'pending' : 'none',
  }], opt);

  // Create GitHub FederatedIdentity
  await FederatedIdentity.create([{
    userId: user._id,
    provider: 'GITHUB',
    providerId: sessionData.githubId,
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

export const linkGithubAccount = async (userId, code) => {
  const payload = await getGithubTokenAndProfile(code);

  const existing = await User.findOne({ githubId: payload.githubId });
  if (existing) {
    if (existing.id === userId) {
      return existing.toJSON();
    }
    throw new AppError('This GitHub account is already linked to another profile', 409);
  }

  const user = await User.findById(userId).select('+providers');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.githubId = payload.githubId;
  if (!user.providers.includes('GITHUB')) {
    user.providers.push('GITHUB');
  }
  await user.save();

  const federatedExists = await FederatedIdentity.exists({
    userId: user._id,
    provider: 'GITHUB',
  });
  if (!federatedExists) {
    await FederatedIdentity.create({
      userId: user._id,
      provider: 'GITHUB',
      providerId: payload.githubId,
      email: payload.email,
    });
  }

  return user.toJSON();
};

export const unlinkGithubAccount = async (userId) => {
  const user = await User.findById(userId).select('+password +providers');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const hasAlternativeIdentity = await FederatedIdentity.exists({
    userId: user._id,
    provider: { $ne: 'GITHUB' },
  });
  const canUnlink = hasAlternativeIdentity || user.password;
  if (!canUnlink) {
    throw new AppError('Cannot unlink GitHub: please set a password or link another account first to avoid lockout', 400);
  }

  user.githubId = null;
  user.providers = user.providers.filter(p => p !== 'GITHUB');
  await user.save();

  await FederatedIdentity.deleteOne({
    userId: user._id,
    provider: 'GITHUB',
  });

  return user.toJSON();
};
