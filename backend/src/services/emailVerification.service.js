import crypto from 'crypto';
import { User } from '../models/User.js';
import { EmailVerificationToken } from '../models/EmailVerificationToken.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { env } from '../config/env.js';
import { sendEmail } from './emailProvider.service.js';

const TOKEN_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Issues a new email verification token and sends a verification email.
 */
export const sendVerificationEmail = async (userId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.emailVerified) {
    return { status: 'already_verified', message: 'Email is already verified' };
  }

  // Rate-limit check: Ensure at least RESEND_COOLDOWN_SECONDS have passed since last token creation
  const recentToken = await EmailVerificationToken.findOne({ userId: user._id }).sort({ _id: -1 });

  if (recentToken) {
    const tokenTime = recentToken.createdAt
      ? new Date(recentToken.createdAt).getTime()
      : recentToken._id.getTimestamp().getTime();
    const elapsedSeconds = (Date.now() - tokenTime) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      throw new AppError(`Please wait ${waitTime} seconds before requesting another verification email`, 429);
    }
  }

  // Invalidate previous pending tokens for this user
  await EmailVerificationToken.deleteMany({ userId: user._id, usedAt: null });

  // Generate cryptographically secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await EmailVerificationToken.create({
    userId: user._id,
    email: user.email,
    tokenHash,
    expiresAt,
  });

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
  const verificationLink = `${frontendUrl}/auth/verify-email?token=${rawToken}`;

  // Send email via existing email provider service
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your Talvix account email',
      text: `Hello ${user.fullName || 'User'},\n\nPlease verify your email address by clicking the following link:\n${verificationLink}\n\nThis link will expire in ${TOKEN_EXPIRY_MINUTES} minutes.`,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2>Verify your Talvix account email</h2>
        <p>Hello ${user.fullName || 'User'},</p>
        <p>Please click the button below to verify your email address and activate full recruiter features:</p>
        <p><a href="${verificationLink}" style="background: #2563eb; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Verify Email Address</a></p>
        <p>Or copy and paste this link in your browser:<br/><a href="${verificationLink}">${verificationLink}</a></p>
        <p>This link will expire in ${TOKEN_EXPIRY_MINUTES} minutes.</p>
      </div>`,
    });
  } catch (err) {
    // Log email failure but do not throw if email infrastructure is unavailable
  }

  await AuditLog.create({
    action: 'user.email_verification_sent',
    actor: user._id,
    targetUser: user._id,
    newValue: { email: user.email, expiresAt },
    ipAddress,
    userAgent,
  });

  return { status: 'sent', expiresAt };
};

/**
 * Validates token and confirms email verification.
 */
export const confirmEmailVerification = async (token, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  if (!token || typeof token !== 'string') {
    throw new AppError('Verification token is required', 400);
  }

  const tokenHash = hashToken(token.trim());
  const tokenDoc = await EmailVerificationToken.findOne({ tokenHash });

  if (!tokenDoc) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  // Idempotent success handling if token was already used
  if (tokenDoc.usedAt) {
    const existingUser = await User.findById(tokenDoc.userId);
    if (existingUser?.emailVerified) {
      return { status: 'success', message: 'Email address has already been verified' };
    }
    throw new AppError('Verification token has already been used', 400);
  }

  if (tokenDoc.expiresAt < new Date()) {
    throw new AppError('Verification token has expired', 400);
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    throw new AppError('User account associated with this token no longer exists', 404);
  }

  // Verify email has not changed since token was issued
  if (user.email.toLowerCase() !== tokenDoc.email.toLowerCase()) {
    throw new AppError('Email address has changed since this token was issued', 400);
  }

  // Update user verification status
  user.emailVerified = true;
  user.isVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  // Invalidate token
  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  await AuditLog.create({
    action: 'user.email_verified',
    actor: user._id,
    targetUser: user._id,
    newValue: { email: user.email, verifiedAt: user.emailVerifiedAt },
    ipAddress,
    userAgent,
  });

  return { status: 'success', message: 'Email address verified successfully', emailVerified: true };
};

/**
 * Returns current user email verification status.
 */
export const getEmailVerificationStatus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    email: user.email,
    emailVerified: Boolean(user.emailVerified || user.isVerified),
    emailVerifiedAt: user.emailVerifiedAt || null,
  };
};

/**
 * Resends verification email with account enumeration safety.
 */
export const resendVerificationEmailSafe = async (emailOrUserId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  let user;
  if (typeof emailOrUserId === 'string' && emailOrUserId.includes('@')) {
    user = await User.findOne({ email: emailOrUserId.toLowerCase().trim() });
  } else {
    user = await User.findById(emailOrUserId);
  }

  // Generic success message to prevent account enumeration
  const genericMessage = 'If an account exists with that email, a verification link has been sent.';

  if (!user) {
    return { status: 'sent', message: genericMessage };
  }

  if (user.emailVerified || user.isVerified) {
    return { status: 'already_verified', message: 'Email is already verified.' };
  }

  try {
    await sendVerificationEmail(user._id, ipAddress, userAgent);
  } catch (error) {
    if (error.statusCode === 429 || error.status === 429) {
      throw error;
    }
    // Suppress other errors for account enumeration safety
  }

  return { status: 'sent', message: genericMessage };
};

/**
 * Handles email address change by setting unverified state and issuing new token.
 */
export const handleUserEmailChange = async (userId, newEmail, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const normalizedNewEmail = newEmail.toLowerCase().trim();
  if (user.email === normalizedNewEmail) {
    return user;
  }

  const existing = await User.findOne({ email: normalizedNewEmail, _id: { $ne: user._id } });
  if (existing) {
    throw new AppError('Email address is already in use by another account', 409);
  }

  const oldEmail = user.email;
  user.email = normalizedNewEmail;
  user.emailVerified = false;
  user.isVerified = false;
  user.emailVerifiedAt = null;
  await user.save();

  // Invalidate previous tokens
  await EmailVerificationToken.deleteMany({ userId: user._id });

  await AuditLog.create({
    action: 'user.email_changed',
    actor: user._id,
    targetUser: user._id,
    oldValue: { email: oldEmail },
    newValue: { email: normalizedNewEmail },
    ipAddress,
    userAgent,
  });

  // Issue new verification email
  await sendVerificationEmail(user._id, ipAddress, userAgent);

  return user;
};
