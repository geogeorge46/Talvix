import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/candidateMatching.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const matchingRouter = Router();

matchingRouter.use(authenticate);

const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

matchingRouter.use(recruiterOrAdmin);
matchingRouter.use(requireCompanyAccess);

matchingRouter.get('/fit', controller.matchCandidateProfile);
matchingRouter.get('/rankings/:jobId', controller.rankApplicantsList);
matchingRouter.get('/search', controller.searchAI);
matchingRouter.get('/similar/:resumeId', controller.findSimilar);
matchingRouter.get('/analytics', controller.getMatchingAnalytics);
