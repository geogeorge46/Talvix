import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { createJobTemplate, createTemplateFromExistingJob, deleteJobTemplate, getJobTemplate, listJobTemplates, updateJobTemplate } from '../controllers/jobTemplate.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { createTemplateSchema, createTemplateFromJobSchema, templateIdParamsSchema, templateQuerySchema, updateTemplateSchema } from '../validators/jobTemplate.validator.js';
import { jobIdParamsSchema } from '../validators/job.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

export const jobTemplateRouter = Router();

const recruiterAccess = (permission) => [
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions(permission),
  requireCompanyAccess
];

jobTemplateRouter.post(
  '/',
  ...recruiterAccess('jobs.create'),
  validateBody(createTemplateSchema),
  createJobTemplate
);

jobTemplateRouter.get(
  '/',
  ...recruiterAccess('jobs.update'),
  validateQuery(templateQuerySchema),
  listJobTemplates
);

jobTemplateRouter.get(
  '/:templateId',
  ...recruiterAccess('jobs.update'),
  validateParams(templateIdParamsSchema),
  getJobTemplate
);

jobTemplateRouter.patch(
  '/:templateId',
  ...recruiterAccess('jobs.update'),
  validateParams(templateIdParamsSchema),
  validateBody(updateTemplateSchema),
  updateJobTemplate
);

jobTemplateRouter.delete(
  '/:templateId',
  ...recruiterAccess('jobs.create'),
  validateParams(templateIdParamsSchema),
  deleteJobTemplate
);

jobTemplateRouter.post(
  '/from-job/:jobId',
  ...recruiterAccess('jobs.create'),
  validateParams(jobIdParamsSchema),
  validateBody(createTemplateFromJobSchema),
  createTemplateFromExistingJob
);
