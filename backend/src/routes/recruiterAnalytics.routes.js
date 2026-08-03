import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import {
  getRecruiterDashboard,
  getCompanyDashboard,
  getRecruiterAnalytics,
  getRecruiterActivityTimeline,
  triggerExport
} from '../controllers/recruiterAnalytics.controller.js';

export const recruiterAnalyticsRouter = Router();

recruiterAnalyticsRouter.use(authenticate, authorizeRoles(USER_ROLES.RECRUITER), requireCompanyAccess);

recruiterAnalyticsRouter.get('/recruiter/dashboard', getRecruiterDashboard);
recruiterAnalyticsRouter.get('/company/dashboard', getCompanyDashboard);
recruiterAnalyticsRouter.get('/recruiter/analytics', getRecruiterAnalytics);
recruiterAnalyticsRouter.get('/recruiter/activity-timeline', getRecruiterActivityTimeline);
recruiterAnalyticsRouter.post('/recruiter/export', triggerExport);
