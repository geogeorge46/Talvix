import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/integration.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const integrationRouter = Router();

integrationRouter.use(authenticate);

// Secure routes scoped to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);
integrationRouter.use(recruiterOrAdmin);
integrationRouter.use(requireCompanyAccess);

integrationRouter.post('/hris', controller.connectHRIS);
integrationRouter.post('/hris/:provider/sync', controller.syncHRIS);
integrationRouter.post('/keys', controller.createAPIKey);
integrationRouter.post('/webhooks', controller.registerWebhook);
