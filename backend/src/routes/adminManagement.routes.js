import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import * as controller from '../controllers/adminManagement.controller.js';

export const adminManagementRouter = Router();

// Secure all endpoints to platform admins only
adminManagementRouter.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));

// Users
adminManagementRouter.get('/users', controller.getUsers);
adminManagementRouter.get('/users/export', controller.exportUsers);
adminManagementRouter.get('/users/:userId', controller.getUser);
adminManagementRouter.patch('/users/:userId/status', controller.updateUser);
adminManagementRouter.patch('/users/:userId/role', controller.changeRole);
adminManagementRouter.post('/users/:userId/reset-password', controller.resetPassword);
adminManagementRouter.delete('/users/:userId', controller.deleteUser);
adminManagementRouter.post('/users/bulk', controller.bulkUsers);

// Recruiters
adminManagementRouter.get('/recruiters', controller.getRecruiters);
adminManagementRouter.get('/recruiters/:recruiterId', controller.getRecruiter);
adminManagementRouter.delete('/recruiters/:recruiterId/company', controller.removeRecruiter);

// Companies
adminManagementRouter.get('/companies', controller.getCompanies);
adminManagementRouter.get('/companies/:companyId', controller.getCompany);
adminManagementRouter.post('/companies/merge', controller.merge);

// Jobs
adminManagementRouter.get('/jobs', controller.getJobs);
adminManagementRouter.get('/jobs/:jobId', controller.getJob);
adminManagementRouter.patch('/jobs/:jobId/status', controller.updateJob);
adminManagementRouter.post('/jobs/:jobId/clone', controller.clone);

// Questions
adminManagementRouter.get('/questions', controller.getQuestions);
adminManagementRouter.get('/questions/:questionId', controller.getQuestion);
adminManagementRouter.post('/questions/import', controller.importQuestions);

// Documents
adminManagementRouter.get('/documents', controller.getDocuments);
adminManagementRouter.patch('/documents/:documentId/status', controller.updateDocument);

// Notifications
adminManagementRouter.post('/notifications/broadcast', controller.broadcast);
adminManagementRouter.get('/notifications/email-logs', controller.getEmailLogs);
adminManagementRouter.post('/notifications/email-logs/:logId/retry', controller.retryEmail);

// Audits
adminManagementRouter.get('/audits', controller.getAuditLogs);

// Candidate Applications Stage
adminManagementRouter.patch('/applications/:applicationId/stage', controller.changeApplicationStage);

// Assessments Management
adminManagementRouter.get('/assessments', controller.getAssessments);
adminManagementRouter.post('/assessments/:assessmentId/clone', controller.cloneAssessment);
adminManagementRouter.post('/attempts/:attemptId/force-submit', controller.forceSubmit);

