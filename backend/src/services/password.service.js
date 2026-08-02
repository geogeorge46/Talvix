import crypto from 'crypto';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/PasswordResetToken.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { FederatedIdentity } from '../models/FederatedIdentity.js';
import { sendEmail } from './emailProvider.service.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { AppError } from '../shared/errors/AppError.js';

/**
 * Initiates the forgot password lifecycle.
 * Prevents account enumeration by always returning successfully.
 */
export const requestPasswordReset = async (email) => {
  if (!email) {
    throw new AppError('Email address is required', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+isActive');

  if (!user || !user.isActive) {
    // Silent fail to prevent email enumeration
    return;
  }

  // Check if user has a LOCAL identity provider
  const localIdentity = await FederatedIdentity.findOne({
    userId: user._id,
    provider: 'LOCAL',
  });

  const idempotencyKey = `forgot-password:${user._id.toString()}:${Date.now()}`;

  if (!localIdentity) {
    // Google-only (or other SSO) account. Send a generic support warning email.
    await sendEmail({
      to: normalizedEmail,
      subject: 'Account Assistance',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>Talvix Account Assistance</h2>
          <p>Hello ${user.name || 'there'},</p>
          <p>We received a request to reset the password for your account.</p>
          <p>However, your account is configured to sign in securely using <strong>Google Sign-In</strong>.</p>
          <p>Please log in using Google on the login page.</p>
          <p>If you did not make this request, you can safely ignore this email.</p>
          <br />
          <p>The Talvix Team</p>
        </div>
      `,
      text: `Hello, we received a request to reset the password for your account. However, your account is configured to sign in securely using Google Sign-In. Please log in using Google.`,
      idempotencyKey,
    });
    return;
  }

  // Generate cryptographic token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Save hashed token (valid for 15 minutes)
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });

  // Send email containing plaintext token
  const resetUrl = `http://localhost:5173/reset-password?token=${token}`;

  await sendEmail({
    to: normalizedEmail,
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333;">
        <h2>Talvix Password Reset</h2>
        <p>Hello ${user.name || 'there'},</p>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>Or copy this link into your browser: <br />${resetUrl}</p>
        <p>This reset link will expire in 15 minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
        <br />
        <p>The Talvix Team</p>
      </div>
    `,
    text: `Hello, you requested to reset your password. Click this link to set a new password: ${resetUrl}. This link will expire in 15 minutes.`,
    idempotencyKey,
  });
};

/**
 * Validates a recovery token.
 */
export const validateResetToken = async (token) => {
  if (!token) {
    throw new AppError('Reset token is required', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!resetToken) {
    throw new AppError('This reset link has expired, has already been used, or is invalid', 400);
  }

  return true;
};

/**
 * Completes the reset flow and invalidates current active sessions.
 */
export const resetPassword = async (token, newPassword) => {
  if (!token) {
    throw new AppError('Reset token is required', 400);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!resetToken) {
    throw new AppError('This reset link has expired, has already been used, or is invalid', 400);
  }

  const user = await User.findById(resetToken.userId).select('+isActive');
  if (!user || !user.isActive) {
    throw new AppError('Account is inactive or does not exist', 400);
  }

  // Update password and tokenVersion using direct update to bypass hook double-hashing
  const hashedPassword = await hashPassword(newPassword);
  const newVersion = (user.tokenVersion || 1) + 1;
  
  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword, tokenVersion: newVersion } }
  );

  // Mark token as consumed
  resetToken.usedAt = new Date();
  await resetToken.save();

  // Invalidate all active refresh sessions
  await RefreshSession.updateMany(
    { userId: user._id },
    { $set: { isActive: false } }
  );
};

/**
 * Sets a local password for Google SSO-only accounts.
 */
export const setPassword = async (userId, password) => {
  const user = await User.findById(userId).select('+password +isActive');
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  // Validate that user is Google/SSO only (no password hash)
  if (user.password) {
    throw new AppError('A password is already set for this account', 400);
  }

  // Set password hash using direct update to bypass hook double-hashing
  const hashedPassword = await hashPassword(password);
  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword } }
  );

  // Check/create LOCAL FederatedIdentity record
  const localIdentityExists = await FederatedIdentity.exists({
    userId: user._id,
    provider: 'LOCAL',
  });

  if (!localIdentityExists) {
    await FederatedIdentity.create({
      userId: user._id,
      provider: 'LOCAL',
      providerId: user.email,
      email: user.email,
    });
  }
};

/**
 * Changes password inside logged-in settings.
 */
export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password +isActive');
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }

  // Must have a password set to change it
  if (!user.password) {
    throw new AppError('No password set. Please use the set password feature instead.', 400);
  }

  // Validate old password
  const matches = await verifyPassword(currentPassword, user.password);
  if (!matches) {
    throw new AppError('Incorrect current password', 400);
  }

  // Update password hash and tokenVersion using direct update to bypass hook double-hashing
  const hashedPassword = await hashPassword(newPassword);
  const newVersion = (user.tokenVersion || 1) + 1;

  await User.updateOne(
    { _id: user._id },
    { $set: { password: hashedPassword, tokenVersion: newVersion } }
  );

  // Invalidate all active refresh sessions
  await RefreshSession.updateMany(
    { userId: user._id },
    { $set: { isActive: false } }
  );
};
