import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/adminAI.controller.js';

export const adminAIRouter = Router();

// Protect all routes under admin AI with authenticate and admin role check
adminAIRouter.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));

adminAIRouter.get('/config', controller.getConfig);
adminAIRouter.put('/config', controller.updateConfig);

adminAIRouter.get('/providers', controller.getProviders);
adminAIRouter.post('/providers', controller.createProvider);
adminAIRouter.put('/providers/:id', controller.updateProvider);
adminAIRouter.delete('/providers/:id', controller.deleteProvider);

adminAIRouter.get('/prompts', controller.getPrompts);
adminAIRouter.post('/prompts', controller.createPrompt);
adminAIRouter.put('/prompts/:key/active/:version', controller.setActivePrompt);

adminAIRouter.get('/usage', controller.getUsageStats);
adminAIRouter.get('/costs', controller.getUsageCosts);
adminAIRouter.get('/health', controller.getSystemHealth);
adminAIRouter.get('/logs', controller.getAuditLogs);
adminAIRouter.get('/security', controller.getSecurityMetrics);
