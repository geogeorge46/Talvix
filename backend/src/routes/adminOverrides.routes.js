import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  transferCompanyOwnershipController,
  adminRemoveMemberController,
  adminApproveMemberController,
  restoreCompanyController,
  listAllClaimsController,
  resolveOwnershipClaimController,
} from '../controllers/adminOverrides.controller.js';
import {
  companyIdParamsSchema,
  reviewClaimSchema,
} from '../validators/company.validator.js';
import { validateBody, validateParams } from '../validators/validate.js';

export const adminOverridesRouter = Router();

// Protect all routes with Platform Admin authorization
adminOverridesRouter.use(authenticate, authorizeRoles(USER_ROLES.ADMIN));

// Claims overview & resolution
adminOverridesRouter.get(
  '/claims',
  listAllClaimsController
);

adminOverridesRouter.patch(
  '/claims/:claimId',
  validateBody(reviewClaimSchema),
  resolveOwnershipClaimController
);

// Specific company overrides
adminOverridesRouter.patch(
  '/companies/:companyId/transfer-ownership',
  validateParams(companyIdParamsSchema),
  transferCompanyOwnershipController
);

adminOverridesRouter.delete(
  '/companies/:companyId/members/:memberId',
  validateParams(companyIdParamsSchema),
  adminRemoveMemberController
);

adminOverridesRouter.patch(
  '/companies/:companyId/members/:memberId/approve',
  validateParams(companyIdParamsSchema),
  adminApproveMemberController
);

adminOverridesRouter.patch(
  '/companies/:companyId/restore',
  validateParams(companyIdParamsSchema),
  restoreCompanyController
);
