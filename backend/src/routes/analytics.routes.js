import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/analytics.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

// Secure routes scoped to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);
analyticsRouter.use(recruiterOrAdmin);
analyticsRouter.use(requireCompanyAccess);

analyticsRouter.get('/dashboard', controller.getDashboard);
analyticsRouter.post('/dashboard/refresh', controller.refreshDashboard);
analyticsRouter.get('/reports', controller.listReports);
analyticsRouter.post('/reports/generate', controller.generateReport);
