import { env } from '../config/env.js';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  updateUserProfile,
  authenticateGoogleUser,
  completeGoogleOnboarding,
  linkGoogleAccount,
  unlinkGoogleAccount,
} from '../services/auth.service.js';
import {
  requestPasswordReset,
  validateResetToken,
  resetPassword,
  setPassword,
  changePassword,
} from '../services/password.service.js';
import {
  authenticateGithubUser,
  completeGithubOnboarding,
  linkGithubAccount,
  unlinkGithubAccount,
} from '../services/githubAuth.service.js';
import { getRefreshTokenMaxAge } from '../utils/jwt.js';

const REFRESH_COOKIE_NAME = 'talvix_refresh_token';

const refreshCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/v1/auth',
});

const setRefreshCookie = (response, refreshToken) => {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...refreshCookieOptions,
    maxAge: getRefreshTokenMaxAge(refreshToken),
  });
};

const getDeviceInfo = (request) => {
  const userAgent = request.headers['user-agent'] || 'Unknown';
  let os = 'Unknown';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad/i.test(userAgent)) os = 'iOS';

  let browser = 'Unknown';
  if (/chrome|crios/i.test(userAgent) && !/edge|edg/i.test(userAgent)) browser = 'Chrome';
  else if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) browser = 'Safari';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/edge|edg/i.test(userAgent)) browser = 'Edge';

  return {
    os,
    browser,
    ipAddress: request.ip || 'Unknown',
  };
};

/** Registers a user and returns an access token. */
export const register = async (request, response, next) => {
  try {
    const { user, accessToken, refreshToken } = await registerUser(request.body, getDeviceInfo(request));
    setRefreshCookie(response, refreshToken);
    return response.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user, accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

/** Authenticates a user and returns an access token. */
export const login = async (request, response, next) => {
  try {
    const { user, accessToken, refreshToken } = await loginUser(request.body, getDeviceInfo(request));
    setRefreshCookie(response, refreshToken);
    return response.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

/** Clears the refresh session and its browser cookie. */
export const logout = async (request, response, next) => {
  try {
    await logoutUser(request.cookies[REFRESH_COOKIE_NAME]);
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
    return response.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    return next(error);
  }
};

/** Rotates a refresh token and returns a new access token. */
export const refresh = async (request, response, next) => {
  try {
    const { accessToken, refreshToken } = await refreshSession(
      request.cookies[REFRESH_COOKIE_NAME],
      getDeviceInfo(request)
    );
    setRefreshCookie(response, refreshToken);
    return response.status(200).json({
      success: true,
      message: 'Session refreshed',
      data: { accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

/** Returns the authenticated user's public profile. */
export const me = async (request, response, next) => {
  try {
    const user = await getCurrentUser(request.user.id);
    return response.status(200).json({
      success: true,
      message: 'Current user retrieved',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

/** Applies the validated, user-editable profile fields. */
export const updateProfile = async (request, response, next) => {
  try {
    const user = await updateUserProfile(request.user.id, request.body);
    return response.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

export const googleLogin = async (request, response, next) => {
  try {
    const result = await authenticateGoogleUser(request.body, getDeviceInfo(request));
    if (result.onboardingRequired) {
      return response.status(200).json({
        success: true,
        message: 'Onboarding is required for this Google user',
        data: result,
      });
    }
    setRefreshCookie(response, result.refreshToken);
    return response.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

export const googleComplete = async (request, response, next) => {
  try {
    const result = await completeGoogleOnboarding(request.body, getDeviceInfo(request));
    setRefreshCookie(response, result.refreshToken);
    return response.status(201).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

export const googleLink = async (request, response, next) => {
  try {
    const user = await linkGoogleAccount(request.user.id, request.body.idToken);
    return response.status(200).json({
      success: true,
      message: 'Google account linked successfully',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

export const googleUnlink = async (request, response, next) => {
  try {
    const user = await unlinkGoogleAccount(request.user.id);
    return response.status(200).json({
      success: true,
      message: 'Google account unlinked successfully',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

/** Initiates password reset request. Always returns HTTP 200 generic message. */
export const forgotPassword = async (request, response, next) => {
  try {
    const { email } = request.body;
    await requestPasswordReset(email);
    return response.status(200).json({
      success: true,
      message: 'If an account is associated with this email, password reset instructions have been sent.',
    });
  } catch (error) {
    return next(error);
  }
};

/** Validates recovery token status. */
export const validateReset = async (request, response, next) => {
  try {
    const { token } = request.query;
    await validateResetToken(token);
    return response.status(200).json({
      success: true,
      message: 'Token is valid',
    });
  } catch (error) {
    return next(error);
  }
};

/** Resets a user's password and revokes other sessions. */
export const reset = async (request, response, next) => {
  try {
    const { token, newPassword } = request.body;
    await resetPassword(token, newPassword);
    return response.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/** Sets password for Google SSO-only accounts. */
export const setUserPassword = async (request, response, next) => {
  try {
    const { password } = request.body;
    await setPassword(request.user.id, password);
    return response.status(200).json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    return next(error);
  }
};

/** Updates authenticated user's current password. */
export const updatePassword = async (request, response, next) => {
  try {
    const { currentPassword, newPassword } = request.body;
    await changePassword(request.user.id, currentPassword, newPassword);
    return response.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    return next(error);
  }
};

export const githubLogin = async (request, response, next) => {
  try {
    const result = await authenticateGithubUser(request.body, getDeviceInfo(request));
    if (result.onboardingRequired) {
      return response.status(200).json({
        success: true,
        message: 'Onboarding is required for this GitHub user',
        data: result,
      });
    }
    setRefreshCookie(response, result.refreshToken);
    return response.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

export const githubComplete = async (request, response, next) => {
  try {
    const result = await completeGithubOnboarding(request.body, getDeviceInfo(request));
    setRefreshCookie(response, result.refreshToken);
    return response.status(201).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: { user: result.user, accessToken: result.accessToken },
    });
  } catch (error) {
    return next(error);
  }
};

export const githubLink = async (request, response, next) => {
  try {
    const user = await linkGithubAccount(request.user.id, request.body.code);
    return response.status(200).json({
      success: true,
      message: 'GitHub account linked successfully',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};

export const githubUnlink = async (request, response, next) => {
  try {
    const user = await unlinkGithubAccount(request.user.id);
    return response.status(200).json({
      success: true,
      message: 'GitHub account unlinked successfully',
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
};
