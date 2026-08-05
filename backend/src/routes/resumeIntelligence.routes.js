import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as controller from '../controllers/resumeIntelligence.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { acceptSingleFile } from '../middleware/fileUpload.js';

export const resumeRouter = Router();

resumeRouter.use(authenticate);

const candidate = authorizeRoles(USER_ROLES.CANDIDATE);
const recruiterOrAdmin = authorizeRoles(USER_ROLES.RECRUITER, USER_ROLES.ADMIN);

// Candidate Actions
resumeRouter.post('/upload', candidate, acceptSingleFile, controller.uploadAndParse);
resumeRouter.get('/profile', candidate, controller.getResumeProfile);
resumeRouter.post('/reparse', candidate, controller.reparseResume);
resumeRouter.get('/versions', candidate, controller.listVersions);
resumeRouter.post('/versions/:version/restore', candidate, controller.restoreVersion);
resumeRouter.get('/compare', candidate, controller.compareVersions);
resumeRouter.get('/download/original', candidate, controller.downloadOriginal);
resumeRouter.get('/download/json', candidate, controller.downloadParsedJson);
resumeRouter.delete('/delete', candidate, controller.deleteResume);

// Recruiter / Admin Actions
resumeRouter.get('/search', recruiterOrAdmin, controller.search);
