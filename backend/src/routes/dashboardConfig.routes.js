import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { getWidgetsConfig, updateWidgetsConfig } from '../controllers/dashboardConfig.controller.js';

export const dashboardConfigRouter = Router();

dashboardConfigRouter.use(authenticate, requireCompanyAccess);

dashboardConfigRouter.get('/widgets', getWidgetsConfig);
dashboardConfigRouter.patch('/widgets', updateWidgetsConfig);
