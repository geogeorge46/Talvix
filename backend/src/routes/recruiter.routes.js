import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { approveRecruiterAccount, pendingRecruiters, rejectRecruiterAccount, suspendRecruiterAccount } from '../controllers/adminRecruiter.controller.js';
import { getMyRecruiterProfile, updateMyRecruiterProfile } from '../controllers/recruiter.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { adminRecruiterActionSchema, pendingRecruiterQuerySchema, recruiterIdParamsSchema, recruiterUpdateSchema } from '../validators/recruiter.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

export const recruiterRouter = Router(); recruiterRouter.use(authenticate);
recruiterRouter.get('/admin/pending', authorizeRoles(USER_ROLES.ADMIN), validateQuery(pendingRecruiterQuerySchema), pendingRecruiters);
for (const [path, controller] of [['approve', approveRecruiterAccount], ['reject', rejectRecruiterAccount], ['suspend', suspendRecruiterAccount]]) {
  recruiterRouter.patch(`/admin/:recruiterId/${path}`, authorizeRoles(USER_ROLES.ADMIN), validateParams(recruiterIdParamsSchema), validateBody(adminRecruiterActionSchema), controller);
}
recruiterRouter.get('/me', authorizeRoles(USER_ROLES.RECRUITER), getMyRecruiterProfile);
recruiterRouter.patch('/me', authorizeRoles(USER_ROLES.RECRUITER), validateBody(recruiterUpdateSchema), updateMyRecruiterProfile);
