import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as generic from '../controllers/document.controller.js';
import * as adminController from '../controllers/adminDocument.controller.js';
import * as integration from '../controllers/documentIntegration.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { acceptSingleFile } from '../middleware/fileUpload.js';
import * as documentValidation from '../validators/document.validator.js';
import * as integrationValidation from '../validators/documentIntegration.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

export const documentRouter = Router();
documentRouter.use(authenticate);
const candidate = authorizeRoles(USER_ROLES.CANDIDATE);
const recruiter = authorizeRoles(USER_ROLES.RECRUITER);
const admin = authorizeRoles(USER_ROLES.ADMIN);
const upload = (schema = integrationValidation.upload) => [acceptSingleFile, validateBody(schema)];
const params = validateParams(integrationValidation.entityParams);

documentRouter.get('/admin', admin, validateQuery(documentValidation.listQuery), adminController.list);
documentRouter.get('/admin/:documentId', admin, validateParams(documentValidation.documentId), adminController.get);
documentRouter.patch('/admin/:documentId/scan-status', admin, validateParams(documentValidation.documentId), validateBody(documentValidation.scanBody), adminController.scan);
documentRouter.patch('/admin/:documentId/quarantine', admin, validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), adminController.quarantine);
documentRouter.patch('/admin/:documentId/release', admin, validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), adminController.release);
documentRouter.patch('/admin/:documentId/archive', admin, validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), adminController.archive);

for (const [path, kind, role] of [['resume', 'resume', candidate], ['profile-photo', 'candidatePhoto', candidate], ['recruiter-profile-photo', 'recruiterPhoto', recruiter]]) {
  documentRouter.post(`/me/${path}`, role, ...upload(), integration.profileUpload(kind));
  documentRouter.get(`/me/${path}`, role, integration.profileGet(kind));
  documentRouter.post(`/me/${path}/replace`, role, ...upload(), integration.profileUpload(kind, true));
  documentRouter.delete(`/me/${path}`, role, integration.profileDelete(kind));
}

documentRouter.post('/company/logo', recruiter, authorizePermissions('documents.manage'), ...upload(), integration.companyLogoUpload());
documentRouter.get('/company/logo', recruiter, authorizePermissions('documents.manage'), integration.companyLogoGet);
documentRouter.post('/company/logo/replace', recruiter, authorizePermissions('documents.manage'), ...upload(), integration.companyLogoUpload(true));
documentRouter.delete('/company/logo', recruiter, authorizePermissions('documents.manage'), integration.companyLogoDelete);

documentRouter.post('/applications/:applicationId', candidate, params, ...upload(integrationValidation.applicationUpload), integration.applicationUpload);
documentRouter.get('/applications/:applicationId', candidate, params, integration.applicationList);
documentRouter.post('/applications/:applicationId/:documentId/replace', candidate, params, ...upload(integrationValidation.applicationUpload), integration.applicationReplace);
documentRouter.get('/manage/applications/:applicationId', recruiter, authorizePermissions('documents.view'), params, integration.managedApplicationList);
documentRouter.get('/manage/applications/:applicationId/:documentId', recruiter, authorizePermissions('documents.view'), params, integration.managedApplicationGet);
documentRouter.get('/manage/applications/:applicationId/:documentId/download', recruiter, authorizePermissions('documents.view'), params, integration.managedApplicationDownload);

documentRouter.post('/assessments/attempts/:attemptId', candidate, params, ...upload(), integration.attemptUpload);
documentRouter.get('/assessments/attempts/:attemptId', candidate, params, integration.attemptList);
documentRouter.get('/manage/assessments/attempts/:attemptId', recruiter, authorizePermissions('documents.view', 'assessments.view'), params, integration.managedAttemptList);
documentRouter.get('/manage/assessments/attempts/:attemptId/:documentId/download', recruiter, authorizePermissions('documents.view', 'assessments.view'), params, integration.managedAttemptDownload);

documentRouter.post('/manage/interviews/:processId', recruiter, authorizePermissions('documents.manage', 'interviews.manage'), params, ...upload(integrationValidation.sharedUpload), integration.interviewUpload);
documentRouter.post('/manage/interviews/:processId/:documentId/replace', recruiter, authorizePermissions('documents.manage', 'interviews.manage'), params, ...upload(integrationValidation.sharedReplacement), integration.interviewReplace);
documentRouter.get('/manage/interviews/:processId', recruiter, authorizePermissions('documents.view', 'interviews.view'), params, integration.interviewList(true));
documentRouter.get('/manage/interviews/:processId/:documentId/download', recruiter, authorizePermissions('documents.view', 'interviews.view'), params, integration.interviewDownload(true));
documentRouter.patch('/manage/interviews/:processId/:documentId/access', recruiter, authorizePermissions('documents.manage', 'interviews.manage'), params, validateBody(integrationValidation.access), integration.interviewAccess);
documentRouter.get('/interviews/:processId', candidate, params, integration.interviewList());
documentRouter.get('/interviews/:processId/:documentId/download', candidate, params, integration.interviewDownload());

documentRouter.post('/manage/offers/:offerId', recruiter, authorizePermissions('documents.manage', 'offers.manage'), params, ...upload(integrationValidation.sharedUpload), integration.offerUpload);
documentRouter.get('/manage/offers/:offerId', recruiter, authorizePermissions('documents.view', 'offers.view'), params, integration.offerList(true));
documentRouter.get('/manage/offers/:offerId/:documentId/download', recruiter, authorizePermissions('documents.view', 'offers.view'), params, integration.offerDownload(true));
documentRouter.post('/manage/offers/:offerId/:documentId/replace', recruiter, authorizePermissions('documents.manage', 'offers.manage'), params, ...upload(integrationValidation.sharedUpload), integration.offerReplace);
documentRouter.get('/offers/:offerId', candidate, params, integration.offerList());
documentRouter.get('/offers/:offerId/:documentId/download', candidate, params, integration.offerDownload());

documentRouter.get('/manage/verification', recruiter, authorizePermissions('documents.verify'), validateQuery(integrationValidation.verificationQuery), integration.verificationList);
documentRouter.get('/manage/verification/:documentId', recruiter, authorizePermissions('documents.verify'), params, integration.verificationGet);
documentRouter.patch('/manage/verification/:documentId/approve', recruiter, authorizePermissions('documents.verify'), params, validateBody(integrationValidation.approve), integration.verificationApprove);
documentRouter.patch('/manage/verification/:documentId/reject', recruiter, authorizePermissions('documents.verify'), params, validateBody(integrationValidation.reject), integration.verificationReject);

documentRouter.post('/upload-session', validateBody(documentValidation.sessionBody), generic.session);
documentRouter.post('/upload', acceptSingleFile, validateBody(documentValidation.uploadFields), generic.upload);
documentRouter.get('/', validateQuery(documentValidation.listQuery), generic.list);
documentRouter.get('/:documentId/download', validateParams(documentValidation.documentId), generic.download);
documentRouter.get('/:documentId', validateParams(documentValidation.documentId), generic.get);
documentRouter.patch('/:documentId', validateParams(documentValidation.documentId), validateBody(documentValidation.updateBody), generic.update);
documentRouter.post('/:documentId/replace', validateParams(documentValidation.documentId), acceptSingleFile, validateBody(documentValidation.uploadFields), generic.replace);
documentRouter.patch('/:documentId/archive', validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), generic.archive);
documentRouter.patch('/:documentId/restore', validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), generic.restore);
documentRouter.delete('/:documentId', validateParams(documentValidation.documentId), validateBody(documentValidation.reasonBody), generic.remove);
