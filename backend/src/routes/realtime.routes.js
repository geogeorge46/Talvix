import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { stream } from '../controllers/realtime.controller.js';

export const realtimeRouter = Router();

realtimeRouter.get('/stream', authenticate, requireCompanyAccess, stream);
