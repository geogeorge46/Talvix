import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/communication.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const communicationRouter = Router();

communicationRouter.use(authenticate);

// Secure routes scoped to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);
communicationRouter.use(recruiterOrAdmin);
communicationRouter.use(requireCompanyAccess);

communicationRouter.post('/chat/conversations', controller.createConversation);
communicationRouter.post('/chat/messages', controller.createMessage);
communicationRouter.get('/chat/conversations', controller.listConversations);
communicationRouter.get('/chat/messages/:conversationId', controller.listMessages);

communicationRouter.post('/interviews/notes', controller.postNote);
communicationRouter.post('/interviews/action-items', controller.postActionItem);
communicationRouter.post('/interviews/summary', controller.aiSummary);

communicationRouter.post('/video/rooms', controller.createRoom);
