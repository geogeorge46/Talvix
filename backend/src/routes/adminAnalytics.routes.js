import { Router } from 'express';
import * as controller from '../controllers/adminAnalytics.controller.js';
import { USER_ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { analyticsQuery, exportQuery } from '../validators/adminAnalytics.validator.js';
import { validateQuery } from '../validators/validate.js';

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));
for (const name of ['overview', 'users', 'candidates', 'recruiters', 'companies', 'jobs', 'applications', 'assessments', 'interviews', 'offers', 'documents', 'notifications', 'health']) adminAnalyticsRouter.get(`/${name}`, validateQuery(analyticsQuery), controller[name]);
adminAnalyticsRouter.get('/export', validateQuery(exportQuery), controller.exportReport);
