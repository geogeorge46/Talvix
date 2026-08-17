import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { getTalentPool, addToTalentPool, updateMemberTagsOrStatus, addNoteToMember, removeFromTalentPool, getCompanyTags, createCompanyTag } from '../controllers/talentPool.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { talentPoolQuerySchema, addTalentPoolMemberSchema, updateTalentPoolMemberSchema, talentPoolNoteSchema, talentPoolIdParamsSchema, createCompanyTagSchema } from '../validators/talentPool.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

export const talentPoolRouter = Router();

const recruiterAccess = (permission) => [
  authenticate,
  authorizeRoles(USER_ROLES.RECRUITER),
  authorizePermissions(permission),
  requireCompanyAccess
];

talentPoolRouter.get(
  '/',
  ...recruiterAccess('jobs.update'),
  validateQuery(talentPoolQuerySchema),
  getTalentPool
);

talentPoolRouter.post(
  '/',
  ...recruiterAccess('jobs.update'),
  validateBody(addTalentPoolMemberSchema),
  addToTalentPool
);

talentPoolRouter.get(
  '/tags',
  ...recruiterAccess('jobs.update'),
  getCompanyTags
);

talentPoolRouter.post(
  '/tags',
  ...recruiterAccess('jobs.update'),
  validateBody(createCompanyTagSchema),
  createCompanyTag
);

talentPoolRouter.patch(
  '/:id',
  ...recruiterAccess('jobs.update'),
  validateParams(talentPoolIdParamsSchema),
  validateBody(updateTalentPoolMemberSchema),
  updateMemberTagsOrStatus
);

talentPoolRouter.post(
  '/:id/notes',
  ...recruiterAccess('jobs.update'),
  validateParams(talentPoolIdParamsSchema),
  validateBody(talentPoolNoteSchema),
  addNoteToMember
);

talentPoolRouter.delete(
  '/:id',
  ...recruiterAccess('jobs.update'),
  validateParams(talentPoolIdParamsSchema),
  removeFromTalentPool
);
