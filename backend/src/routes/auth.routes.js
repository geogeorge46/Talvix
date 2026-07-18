import { Router } from 'express';

import {
  login,
  logout,
  me,
  refresh,
  register,
  updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
  loginSchema,
  profileSchema,
  registerSchema,
  validateBody,
} from '../validators/auth.validator.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/logout', logout);
authRouter.post('/refresh', refresh);
authRouter.get('/me', authenticate, me);
authRouter.patch('/profile', authenticate, validateBody(profileSchema), updateProfile);
