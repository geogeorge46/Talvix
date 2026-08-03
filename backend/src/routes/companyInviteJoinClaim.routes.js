import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import {
  inviteRecruiterController,
  getInvitationDetailsController,
  acceptInvitationController,
  createJoinRequestController,
  listJoinRequestsController,
  reviewJoinRequestController,
  submitOwnershipClaimController,
  respondToOwnershipClaimController,
  listCompanyInvitationsController,
  resendInvitationController,
  cancelInvitationController,
} from '../controllers/companyInviteJoinClaim.controller.js';
import {
  inviteRecruiterSchema,
  claimCompanySchema,
  reviewJoinRequestSchema,
  companyIdParamsSchema,
} from '../validators/company.validator.js';
import { validateBody, validateParams } from '../validators/validate.js';

export const companyInviteJoinClaimRouter = Router();

// Invitation routes (Public and Authenticated)
companyInviteJoinClaimRouter.get(
  '/invitations/:token',
  getInvitationDetailsController
);

companyInviteJoinClaimRouter.post(
  '/invitations/:token/accept',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  acceptInvitationController
);

// Invitation Creation (Company Admins)
companyInviteJoinClaimRouter.post(
  '/me/invitations',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  validateBody(inviteRecruiterSchema),
  inviteRecruiterController
);

// Join requests and claims (Authenticated Recruiters)
companyInviteJoinClaimRouter.post(
  '/:companyId/join-request',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  validateParams(companyIdParamsSchema),
  createJoinRequestController
);

companyInviteJoinClaimRouter.post(
  '/:companyId/claims',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  validateParams(companyIdParamsSchema),
  validateBody(claimCompanySchema),
  submitOwnershipClaimController
);

companyInviteJoinClaimRouter.post(
  '/claims/:claimId/respond',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  respondToOwnershipClaimController
);

// Team Join requests management
companyInviteJoinClaimRouter.get(
  '/me/join-requests',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  listJoinRequestsController
);

companyInviteJoinClaimRouter.patch(
  '/me/join-requests/:requestId',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  validateBody(reviewJoinRequestSchema),
  reviewJoinRequestController
);

companyInviteJoinClaimRouter.get(
  '/me/invitations',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  listCompanyInvitationsController
);

companyInviteJoinClaimRouter.post(
  '/me/invitations/:invitationId/resend',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  resendInvitationController
);

companyInviteJoinClaimRouter.delete(
  '/me/invitations/:invitationId',
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions('team.manage'),
  requireCompanyAccess,
  cancelInvitationController
);
