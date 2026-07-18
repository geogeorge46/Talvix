import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

import jwt from 'jsonwebtoken';

import { env } from '../config/env.js';

const TOKEN_ISSUER = 'talvix-api';
const TOKEN_AUDIENCE = 'talvix-client';

const signToken = (userId, tokenType, secret, expiresIn) =>
  jwt.sign({ type: tokenType }, secret, {
    subject: userId.toString(),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn,
    jwtid: randomUUID(),
  });

const verifyToken = (token, expectedType, secret) => {
  const payload = jwt.verify(token, secret, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });

  if (typeof payload === 'string' || payload.type !== expectedType || !payload.sub) {
    throw new jwt.JsonWebTokenError('Invalid token payload');
  }

  return payload;
};

/** Creates an access token for authenticated API requests. */
export const generateAccessToken = (userId) =>
  signToken(userId, 'access', env.JWT_ACCESS_SECRET, env.JWT_ACCESS_EXPIRES_IN);

/** Creates a refresh token used to rotate an authenticated session. */
export const generateRefreshToken = (userId) =>
  signToken(userId, 'refresh', env.JWT_REFRESH_SECRET, env.JWT_REFRESH_EXPIRES_IN);

/** Validates an access token and returns its verified claims. */
export const verifyAccessToken = (token) =>
  verifyToken(token, 'access', env.JWT_ACCESS_SECRET);

/** Validates a refresh token and returns its verified claims. */
export const verifyRefreshToken = (token) =>
  verifyToken(token, 'refresh', env.JWT_REFRESH_SECRET);

/** Creates a deterministic digest so raw refresh tokens are never persisted. */
export const hashRefreshToken = (token) => createHash('sha256').update(token).digest('hex');

/** Compares refresh-token digests without leaking timing information. */
export const refreshTokenHashesMatch = (leftHash, rightHash) => {
  if (!leftHash || !rightHash || leftHash.length !== rightHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(leftHash), Buffer.from(rightHash));
};

/** Derives cookie lifetime from the signed refresh token's expiry claim. */
export const getRefreshTokenMaxAge = (token) => {
  const payload = jwt.decode(token);

  if (!payload || typeof payload === 'string' || !payload.exp) {
    throw new Error('Refresh token has no expiry');
  }

  return Math.max(payload.exp * 1000 - Date.now(), 0);
};
