import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/workflow.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const workflowRouter = Router();

workflowRouter.use(authenticate);

// Secure routes scoped to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);
workflowRouter.use(recruiterOrAdmin);
workflowRouter.use(requireCompanyAccess);

workflowRouter.post('/', controller.createWorkflow);
workflowRouter.get('/', controller.listWorkflows);
workflowRouter.post('/:id/publish', controller.publishWorkflow);
workflowRouter.post('/:id/run', controller.runWorkflow);
workflowRouter.get('/executions', controller.listExecutions);
