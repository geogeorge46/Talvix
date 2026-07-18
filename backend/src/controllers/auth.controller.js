import { env } from '../config/env.js';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  updateUserProfile,
} from '../services/auth.service.js';
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

/** Registers a user and returns an access token. */
export const register = async (request, response, next) => {
  try {
    const { user, accessToken, refreshToken } = await registerUser(request.body);
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
    const { user, accessToken, refreshToken } = await loginUser(request.body);
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

/** Updates the authenticated user's editable profile fields. */
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
