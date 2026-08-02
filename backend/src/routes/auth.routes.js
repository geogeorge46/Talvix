import { Router } from 'express';

import {
  login,
  logout,
  me,
  refresh,
  register,
  updateProfile,
  googleLogin,
  googleComplete,
  googleLink,
  googleUnlink,
  githubLogin,
  githubComplete,
  githubLink,
  githubUnlink,
  forgotPassword,
  validateReset,
  reset,
  setUserPassword,
  updatePassword,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
  loginSchema,
  profileSchema,
  registerSchema,
  validateBody,
  forgotPasswordSchema,
  resetPasswordSchema,
  setPasswordSchema,
  changePasswordSchema,
  githubAuthSchema,
} from '../validators/auth.validator.js';
import {
  googleAuthSchema,
  googleOnboardingSchema,
} from '../validators/googleAuth.validator.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.post('/refresh', refresh);
authRouter.get('/me', authenticate, me);
authRouter.patch('/profile', authenticate, validateBody(profileSchema), updateProfile);

authRouter.post('/google', validateBody(googleAuthSchema), googleLogin);
authRouter.post('/google/complete', validateBody(googleOnboardingSchema), googleComplete);
authRouter.post('/link-google', authenticate, validateBody(googleAuthSchema), googleLink);
authRouter.delete('/unlink-google', authenticate, googleUnlink);

authRouter.post('/github', validateBody(githubAuthSchema), githubLogin);
authRouter.post('/github/complete', validateBody(googleOnboardingSchema), githubComplete);
authRouter.post('/link-github', authenticate, validateBody(githubAuthSchema), githubLink);
authRouter.delete('/unlink-github', authenticate, githubUnlink);

// Password recovery and credential management endpoints
authRouter.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
authRouter.get('/reset-password/validate', validateReset);
authRouter.post('/reset-password', validateBody(resetPasswordSchema), reset);
authRouter.post('/set-password', authenticate, validateBody(setPasswordSchema), setUserPassword);
authRouter.patch('/change-password', authenticate, validateBody(changePasswordSchema), updatePassword);
