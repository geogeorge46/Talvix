import { Router } from 'express';

import { USER_ROLES } from '../constants/roles.js';
import {
  addCandidateCollectionEntries,
  deleteCandidateCollectionEntry,
  getCandidateProfile,
  getMyCandidateProfile,
  searchCandidates,
  updateCandidateCollectionEntry,
  updateMyCandidateProfile,
  getProfileAccessLogs,
} from '../controllers/candidate.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import {
  candidateIdParamsSchema,
  candidateProfileUpdateSchema,
  certificationCreateSchema,
  certificationUpdateSchema,
  educationCreateSchema,
  educationUpdateSchema,
  experienceCreateSchema,
  experienceUpdateSchema,
  nestedIdParamsSchema,
  projectCreateSchema,
  projectUpdateSchema,
  skillUpdateSchema,
  skillsCreateSchema,
  validateCandidateBody,
  validateCandidateParams,
  validateCandidateQuery,
} from '../validators/candidate.validator.js';

export const candidateRouter = Router();

candidateRouter.use(authenticate);

const candidateOnly = authorizeRoles(USER_ROLES.CANDIDATE);
const reviewerOnly = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

candidateRouter.get('/me', candidateOnly, getMyCandidateProfile);
candidateRouter.get('/me/profile-access', candidateOnly, getProfileAccessLogs);
candidateRouter.patch(
  '/me',
  candidateOnly,
  validateCandidateBody(candidateProfileUpdateSchema),
  updateMyCandidateProfile,
);

const nestedRoutes = [
  ['education', 'educationId', educationCreateSchema, educationUpdateSchema],
  ['skills', 'skillId', skillsCreateSchema, skillUpdateSchema],
  ['experience', 'experienceId', experienceCreateSchema, experienceUpdateSchema],
  ['projects', 'projectId', projectCreateSchema, projectUpdateSchema],
  ['certifications', 'certificationId', certificationCreateSchema, certificationUpdateSchema],
];

for (const [collectionName, parameterName, createSchema, updateSchema] of nestedRoutes) {
  const collectionPath = `/me/${collectionName}`;
  const entryPath = `${collectionPath}/:${parameterName}`;
  const paramsValidator = validateCandidateParams(nestedIdParamsSchema(parameterName));

  candidateRouter.post(
    collectionPath,
    candidateOnly,
    validateCandidateBody(createSchema),
    addCandidateCollectionEntries(collectionName),
  );
  candidateRouter.patch(
    entryPath,
    candidateOnly,
    paramsValidator,
    validateCandidateBody(updateSchema),
    updateCandidateCollectionEntry(collectionName, parameterName),
  );
  candidateRouter.delete(
    entryPath,
    candidateOnly,
    paramsValidator,
    deleteCandidateCollectionEntry(collectionName, parameterName),
  );
}

candidateRouter.get('/', reviewerOnly, validateCandidateQuery, searchCandidates);
candidateRouter.get(
  '/:candidateId',
  reviewerOnly,
  validateCandidateParams(candidateIdParamsSchema),
  getCandidateProfile,
);
