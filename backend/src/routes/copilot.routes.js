import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/copilot.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const copilotRouter = Router();

copilotRouter.use(authenticate);

const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

copilotRouter.use(recruiterOrAdmin);
copilotRouter.use(requireCompanyAccess);

copilotRouter.post('/chat', controller.chat);
copilotRouter.post('/search', controller.search);
copilotRouter.post('/compare', controller.compare);
copilotRouter.post('/recommend', controller.recommend);
copilotRouter.post('/summary', controller.summary);
copilotRouter.post('/interview', controller.createInterview);
copilotRouter.post('/report', controller.generateReport);

copilotRouter.get('/history', controller.getHistory);
copilotRouter.get('/conversations', controller.getConversationsList);
copilotRouter.get('/prompts', controller.getSuggestedPrompts);
copilotRouter.get('/analytics', controller.getAnalytics);

copilotRouter.delete('/conversations/:id', controller.deleteConversation);
