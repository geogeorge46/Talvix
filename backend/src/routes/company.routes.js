import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { companyVerificationAction, pendingCompanies } from '../controllers/adminCompany.controller.js';
import { addCompanyTeamMember, createRecruiterCompany, getCompany, getMyCompany, listCompanies, removeCompanyTeamMember, updateCompanyTeamMember, updateMyCompany } from '../controllers/company.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { addTeamMemberSchema, companyAdminActionSchema, companyCreateSchema, companyIdParamsSchema, companySearchSchema, companyUpdateSchema, teamMemberParamsSchema, updateTeamMemberSchema } from '../validators/company.validator.js';
import { pendingRecruiterQuerySchema } from '../validators/recruiter.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

import {
  confirmDomainChallengeController,
  createDomainChallengeController,
  getDomainStatusController,
} from '../controllers/domainVerification.controller.js';

export const companyRouter = Router();
companyRouter.get('/admin/pending', authenticate, authorizeRoles(USER_ROLES.ADMIN), validateQuery(pendingRecruiterQuerySchema), pendingCompanies);
for (const status of ['verified', 'rejected', 'suspended']) companyRouter.patch(`/admin/:companyId/${status === 'verified' ? 'verify' : status === 'rejected' ? 'reject' : 'suspend'}`, authenticate, authorizeRoles(USER_ROLES.ADMIN), validateParams(companyIdParamsSchema), validateBody(companyAdminActionSchema), companyVerificationAction(status));
companyRouter.post('/', authenticate, authorizeRoles(USER_ROLES.RECRUITER), validateBody(companyCreateSchema), createRecruiterCompany);
companyRouter.get('/me', authenticate, authorizeRoles(USER_ROLES.RECRUITER), getMyCompany);
companyRouter.patch('/me', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('company.manage'), requireCompanyAccess, validateBody(companyUpdateSchema), updateMyCompany);

// Corporate Domain Verification Endpoints
companyRouter.post('/me/domain-verification/challenge', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('company.manage'), requireCompanyAccess, createDomainChallengeController);
companyRouter.get('/me/domain-verification/status', authenticate, authorizeRoles(USER_ROLES.RECRUITER), requireCompanyAccess, getDomainStatusController);
companyRouter.post('/me/domain-verification/confirm', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('company.manage'), requireCompanyAccess, confirmDomainChallengeController);

// Phase 4 Registry Verification & Verification Summary Endpoints
import {
  getCompanyRegistryChecksController,
  getCompanyVerificationSummaryController,
  getMyCompanyRegistryChecksController,
  overrideRegistryCheckController,
  runMyCompanyRegistryCheckController,
  runRegistryCheckController
} from '../controllers/registryCheck.controller.js';
import { checkIdParamsSchema, overrideRegistryCheckSchema, runRegistryCheckSchema } from '../validators/registryCheck.validator.js';

companyRouter.get('/me/verification-summary', authenticate, authorizeRoles(USER_ROLES.RECRUITER), requireCompanyAccess, getCompanyVerificationSummaryController);
companyRouter.get('/me/registry-checks', authenticate, authorizeRoles(USER_ROLES.RECRUITER), requireCompanyAccess, getMyCompanyRegistryChecksController);
companyRouter.post('/me/registry-checks/run', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('company.manage'), requireCompanyAccess, validateBody(runRegistryCheckSchema), runMyCompanyRegistryCheckController);

companyRouter.post('/admin/:companyId/registry-checks/run', authenticate, authorizeRoles(USER_ROLES.ADMIN), validateParams(companyIdParamsSchema), validateBody(runRegistryCheckSchema), runRegistryCheckController);
companyRouter.get('/admin/:companyId/registry-checks', authenticate, authorizeRoles(USER_ROLES.ADMIN), validateParams(companyIdParamsSchema), getCompanyRegistryChecksController);
companyRouter.post('/admin/:companyId/registry-checks/:checkId/override', authenticate, authorizeRoles(USER_ROLES.ADMIN), validateParams(checkIdParamsSchema), validateBody(overrideRegistryCheckSchema), overrideRegistryCheckController);

companyRouter.post('/me/team', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('team.manage'), requireCompanyAccess, validateBody(addTeamMemberSchema), addCompanyTeamMember);
companyRouter.patch('/me/team/:memberId', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('team.manage'), requireCompanyAccess, validateParams(teamMemberParamsSchema), validateBody(updateTeamMemberSchema), updateCompanyTeamMember);
companyRouter.delete('/me/team/:memberId', authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions('team.manage'), requireCompanyAccess, validateParams(teamMemberParamsSchema), removeCompanyTeamMember);
companyRouter.get('/', validateQuery(companySearchSchema), listCompanies);
companyRouter.get('/:companyId', validateParams(companyIdParamsSchema), getCompany);


