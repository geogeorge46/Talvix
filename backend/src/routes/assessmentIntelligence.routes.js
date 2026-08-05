import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/assessmentIntelligence.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const assessmentIntelRouter = Router();

assessmentIntelRouter.use(authenticate);

const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

assessmentIntelRouter.use(recruiterOrAdmin);
assessmentIntelRouter.use(requireCompanyAccess);

assessmentIntelRouter.post('/generate', controller.generateAssessment);
assessmentIntelRouter.post('/interview-kit', controller.generateKit);
assessmentIntelRouter.post('/attempts/:attemptId/evaluate', controller.evaluateAssessmentAttempt);
