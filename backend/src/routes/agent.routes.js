import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/agent.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const agentRouter = Router();

agentRouter.use(authenticate);

// Secure routes scoped to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);
agentRouter.use(recruiterOrAdmin);
agentRouter.use(requireCompanyAccess);

agentRouter.post('/:agentType', controller.runAgentTask);
