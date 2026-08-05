import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/candidateIntelligence.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';

export const candidateIntelRouter = Router();

candidateIntelRouter.use(authenticate);

const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

candidateIntelRouter.use(recruiterOrAdmin);
candidateIntelRouter.use(requireCompanyAccess);

candidateIntelRouter.post('/review', controller.review);
candidateIntelRouter.post('/fraud-check', controller.fraudCheck);
candidateIntelRouter.get('/intelligence/:candidateId', controller.candidateIntelligence);
candidateIntelRouter.get('/review/:id', controller.resumeReviewDetails);
