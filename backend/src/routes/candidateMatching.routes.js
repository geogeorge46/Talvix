import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import {
  getManagedApplicantMatchesHandler,
  getManagedApplicationMatchDetailsHandler,
  calculateManagedCandidateMatchHandler,
  getCandidateJobFitAnalysisHandler
} from '../controllers/candidateMatching.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { applicantMatchesQuerySchema, candidateMatchParamsSchema, jobMatchParamsSchema } from '../validators/candidateMatch.validator.js';
import { applicationIdParamsSchema } from '../validators/application.validator.js';
import { validateParams, validateQuery } from '../validators/validate.js';

export const matchingRouter = Router();

matchingRouter.use(authenticate);

const recruiterAccess = (permission) => [authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions(permission), requireCompanyAccess];

matchingRouter.get('/jobs/:jobId/matches', ...recruiterAccess('applications.view'), validateParams(jobMatchParamsSchema), validateQuery(applicantMatchesQuerySchema), getManagedApplicantMatchesHandler);
matchingRouter.get('/applications/:applicationId/match-details', ...recruiterAccess('applications.view'), validateParams(applicationIdParamsSchema), getManagedApplicationMatchDetailsHandler);
matchingRouter.post('/jobs/:jobId/candidates/:candidateId/match', ...recruiterAccess('applications.view'), validateParams(candidateMatchParamsSchema), calculateManagedCandidateMatchHandler);
matchingRouter.get('/me/jobs/:jobId/fit-analysis', authorizeRoles(USER_ROLES.CANDIDATE), validateParams(jobMatchParamsSchema), getCandidateJobFitAnalysisHandler);
