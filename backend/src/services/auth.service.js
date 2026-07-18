import mongoose from 'mongoose';

import { USER_ROLES } from '../constants/roles.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { User } from '../models/User.js';
import { createCandidateProfileForUser } from './candidate.service.js';
import { createRecruiterProfileForUser } from './recruiter.service.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { AppError } from '../shared/errors/AppError.js';
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenHashesMatch,
  verifyRefreshToken,
} from '../utils/jwt.js';
import { verifyPassword } from '../utils/password.js';

const createSession = async (user) => {
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  user.refreshTokenHash = hashRefreshToken(refreshToken);
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
        await createRoleProfile(user, session);
      });
      return user;
    } finally {
      await session.endSession();
    }
  }

  const user = await User.create(input);
  try {
    await createRoleProfile(user);
    return user;
  } catch (error) {
    await User.deleteOne({ _id: user.id });
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
export const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password +isActive +refreshTokenHash');

  if (!user || !(await verifyPassword(password, user.password))) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is inactive', 403);
  }

  user.lastLogin = new Date();
  const tokens = await createSession(user);
  return { user: user.toJSON(), ...tokens };
};

/** Rotates a valid, currently active refresh token. */
export const refreshSession = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(payload.sub).select('+isActive +refreshTokenHash');
  const suppliedHash = hashRefreshToken(refreshToken);

  if (
    !user ||
    !user.isActive ||
    !refreshTokenHashesMatch(suppliedHash, user.refreshTokenHash)
  ) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  return createSession(user);
};

/** Invalidates a matching refresh session if one exists. */
export const logoutUser = async (refreshToken) => {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const user = await User.findById(payload.sub).select('+refreshTokenHash');

    if (
      user &&
      refreshTokenHashesMatch(hashRefreshToken(refreshToken), user.refreshTokenHash)
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
