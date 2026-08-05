import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/jobIntelligence.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const jobIntelligenceRouter = Router();

jobIntelligenceRouter.use(authenticate);

// Restricted to Recruiters and Admins
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

jobIntelligenceRouter.use(recruiterOrAdmin);
jobIntelligenceRouter.use(requireCompanyAccess);

jobIntelligenceRouter.post('/:jobId/parse', controller.createIntelligence);
jobIntelligenceRouter.get('/:jobId', controller.getIntelligence);
jobIntelligenceRouter.post('/:jobId/reparse', controller.reparseJob);
jobIntelligenceRouter.get('/:jobId/versions', controller.listVersions);
jobIntelligenceRouter.post('/:jobId/versions/:version/restore', controller.restoreVersion);
jobIntelligenceRouter.get('/:jobId/compare', controller.compareVersions);
jobIntelligenceRouter.get('/:jobId/download/json', controller.downloadParsedJson);
