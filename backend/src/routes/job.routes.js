import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import { approvePendingJob, featureJob, pendingJobs, rejectPendingJob } from '../controllers/adminJob.controller.js';
import { closeManagedJob, cloneManagedJob, createCompanyJob, deleteManagedJob, managedJob, managedJobs, pauseManagedJob, publicJob, publicJobs, publishManagedJob, resumeManagedJob, submitManagedJob, updateManagedJob, aiGenerateJobDescription, aiSuggestJobSkills, aiJobSafetyCheck, candidateComparison, getManagedJobIntelligence, extractManagedJobIntelligence, aiExtractJobIntelligencePreview, getManagedJobQuality, analyzeManagedJobQuality, aiAnalyzeJobQualityPreview, getManagedJobBlueprint, generateManagedJobBlueprint, regenerateManagedJobBlueprintSection, updateManagedJobBlueprint, approveManagedJobBlueprint, convertManagedJobBlueprintToAssessment, aiGenerateJobBlueprintPreview } from '../controllers/job.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import { jobCreateSchema, jobIdParamsSchema, jobSearchSchema, jobUpdateSchema, rejectJobSchema, aiGenerateDescriptionSchema, aiSuggestSkillsSchema, aiSafetyCheckSchema, aiExtractIntelligencePreviewSchema, extractJobIntelligenceBodySchema, aiAnalyzeQualityPreviewSchema, analyzeJobQualityBodySchema, aiGenerateBlueprintPreviewSchema, generateJobBlueprintBodySchema, regenerateBlueprintSectionSchema, updateJobBlueprintBodySchema } from '../validators/job.validator.js';
import { pendingRecruiterQuerySchema } from '../validators/recruiter.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';

export const jobRouter = Router();
const admin = [authenticate, authorizeRoles(USER_ROLES.ADMIN)];
jobRouter.get('/admin/pending', ...admin, validateQuery(pendingRecruiterQuerySchema), pendingJobs);
jobRouter.patch('/admin/:jobId/approve', ...admin, validateParams(jobIdParamsSchema), approvePendingJob);
jobRouter.patch('/admin/:jobId/reject', ...admin, validateParams(jobIdParamsSchema), validateBody(rejectJobSchema), rejectPendingJob);
jobRouter.patch('/admin/:jobId/feature', ...admin, validateParams(jobIdParamsSchema), featureJob(true));
jobRouter.patch('/admin/:jobId/unfeature', ...admin, validateParams(jobIdParamsSchema), featureJob(false));

const recruiterAccess = (permission) => [authenticate, authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions(permission), requireCompanyAccess];
jobRouter.post('/', ...recruiterAccess('jobs.create'), validateBody(jobCreateSchema), createCompanyJob);
jobRouter.post('/ai/generate-description', ...recruiterAccess('jobs.create'), validateBody(aiGenerateDescriptionSchema), aiGenerateJobDescription);
jobRouter.post('/ai/suggest-skills', ...recruiterAccess('jobs.create'), validateBody(aiSuggestSkillsSchema), aiSuggestJobSkills);
jobRouter.post('/ai/safety-check', ...recruiterAccess('jobs.create'), validateBody(aiSafetyCheckSchema), aiJobSafetyCheck);
jobRouter.post('/ai/extract-intelligence', ...recruiterAccess('jobs.create'), validateBody(aiExtractIntelligencePreviewSchema), aiExtractJobIntelligencePreview);
jobRouter.post('/ai/analyze-quality', ...recruiterAccess('jobs.create'), validateBody(aiAnalyzeQualityPreviewSchema), aiAnalyzeJobQualityPreview);
jobRouter.post('/ai/generate-blueprint', ...recruiterAccess('jobs.create'), validateBody(aiGenerateBlueprintPreviewSchema), aiGenerateJobBlueprintPreview);
jobRouter.get('/manage', ...recruiterAccess('jobs.update'), validateQuery(jobSearchSchema), managedJobs);
jobRouter.get('/manage/:jobId', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), managedJob);
jobRouter.get('/manage/:jobId/intelligence', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), getManagedJobIntelligence);
jobRouter.post('/manage/:jobId/intelligence/extract', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(extractJobIntelligenceBodySchema), extractManagedJobIntelligence);
jobRouter.get('/manage/:jobId/quality', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), getManagedJobQuality);
jobRouter.post('/manage/:jobId/quality/analyze', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(analyzeJobQualityBodySchema), analyzeManagedJobQuality);
jobRouter.get('/manage/:jobId/blueprint', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), getManagedJobBlueprint);
jobRouter.post('/manage/:jobId/blueprint/generate', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(generateJobBlueprintBodySchema), generateManagedJobBlueprint);
jobRouter.post('/manage/:jobId/blueprint/regenerate-section', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(regenerateBlueprintSectionSchema), regenerateManagedJobBlueprintSection);
jobRouter.patch('/manage/:jobId/blueprint', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(updateJobBlueprintBodySchema), updateManagedJobBlueprint);
jobRouter.post('/manage/:jobId/blueprint/approve', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), approveManagedJobBlueprint);
jobRouter.post('/manage/:jobId/blueprint/convert', ...recruiterAccess('assessments.manage'), validateParams(jobIdParamsSchema), convertManagedJobBlueprintToAssessment);
jobRouter.get('/manage/:jobId/candidate-comparison', ...recruiterAccess('applications.view'), validateParams(jobIdParamsSchema), candidateComparison);
jobRouter.patch('/manage/:jobId', ...recruiterAccess('jobs.update'), validateParams(jobIdParamsSchema), validateBody(jobUpdateSchema), updateManagedJob);
jobRouter.delete('/manage/:jobId', ...recruiterAccess('jobs.delete'), validateParams(jobIdParamsSchema), deleteManagedJob);
jobRouter.post('/manage/:jobId/clone', ...recruiterAccess('jobs.create'), validateParams(jobIdParamsSchema), cloneManagedJob);
for (const [action, permission, controller] of [['submit', 'jobs.publish', submitManagedJob], ['publish', 'jobs.publish', publishManagedJob], ['pause', 'jobs.publish', pauseManagedJob], ['resume', 'jobs.publish', resumeManagedJob], ['close', 'jobs.publish', closeManagedJob]]) {
  jobRouter.patch(`/manage/:jobId/${action}`, ...recruiterAccess(permission), validateParams(jobIdParamsSchema), controller);
}
jobRouter.get('/', validateQuery(jobSearchSchema), publicJobs);
jobRouter.get('/:jobId', validateParams(jobIdParamsSchema), publicJob);
