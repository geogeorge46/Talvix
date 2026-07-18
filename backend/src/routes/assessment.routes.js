import { Router } from 'express';
import { USER_ROLES } from '../constants/roles.js';
import * as adminController from '../controllers/adminAssessment.controller.js';
import * as assessmentController from '../controllers/assessment.controller.js';
import * as assignmentController from '../controllers/assessmentAssignment.controller.js';
import * as attemptController from '../controllers/assessmentAttempt.controller.js';
import * as questionController from '../controllers/question.controller.js';
import * as reviewController from '../controllers/assessmentReview.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorizePermissions } from '../middleware/authorizePermissions.js';
import { authorizeRoles } from '../middleware/authorizeRoles.js';
import { requireCompanyAccess } from '../middleware/companyAccess.js';
import * as schemas from '../validators/assessment.validator.js';
import { validateBody, validateParams, validateQuery } from '../validators/validate.js';
export const assessmentRouter = Router(); assessmentRouter.use(authenticate);
const recruiter = (permission) => [authorizeRoles(USER_ROLES.RECRUITER), authorizePermissions(permission), requireCompanyAccess]; const candidate = authorizeRoles(USER_ROLES.CANDIDATE); const admin = authorizeRoles(USER_ROLES.ADMIN);

assessmentRouter.get('/admin/assignments', admin, validateQuery(schemas.adminQuerySchema), adminController.adminAssignments);
assessmentRouter.get('/admin/assignments/:assignmentId', admin, validateParams(schemas.assignmentIdSchema), adminController.adminAssignment);
assessmentRouter.patch('/admin/assignments/:assignmentId/cancel', admin, validateParams(schemas.assignmentIdSchema), validateBody(schemas.reasonSchema), adminController.cancelAdminAssignment);
assessmentRouter.patch('/admin/assignments/:assignmentId/expire', admin, validateParams(schemas.assignmentIdSchema), validateBody(schemas.reasonSchema), adminController.expireAdminAssignment);
assessmentRouter.get('/admin/attempts/:attemptId', admin, validateParams(schemas.attemptIdSchema), adminController.adminAttempt);
assessmentRouter.patch('/admin/attempts/:attemptId/reopen-review', admin, validateParams(schemas.attemptIdSchema), validateBody(schemas.reasonSchema), adminController.reopenAdminAttempt);

assessmentRouter.post('/questions', ...recruiter('assessments.manage'), validateBody(schemas.questionBodySchema), questionController.createManagedQuestion);
assessmentRouter.get('/questions', ...recruiter('assessments.view'), validateQuery(schemas.questionQuerySchema), questionController.managedQuestions);
assessmentRouter.get('/questions/:questionId', ...recruiter('assessments.view'), validateParams(schemas.questionIdSchema), questionController.managedQuestion);
assessmentRouter.patch('/questions/:questionId', ...recruiter('assessments.manage'), validateParams(schemas.questionIdSchema), validateBody(schemas.questionUpdateSchema), questionController.updateManagedQuestion);
assessmentRouter.delete('/questions/:questionId', ...recruiter('assessments.manage'), validateParams(schemas.questionIdSchema), questionController.deleteManagedQuestion);
assessmentRouter.post('/questions/:questionId/clone', ...recruiter('assessments.manage'), validateParams(schemas.questionIdSchema), questionController.cloneManagedQuestion);

assessmentRouter.get('/assignments/manage/pipeline', ...recruiter('assessments.view'), reviewController.assignmentPipeline);
assessmentRouter.get('/assignments/manage', ...recruiter('assessments.view'), validateQuery(schemas.assignmentQuerySchema), assignmentController.managedAssignments);
assessmentRouter.get('/assignments/manage/:assignmentId', ...recruiter('assessments.view'), validateParams(schemas.assignmentIdSchema), assignmentController.managedAssignment);
assessmentRouter.patch('/assignments/manage/:assignmentId/cancel', ...recruiter('assessments.assign'), validateParams(schemas.assignmentIdSchema), validateBody(schemas.reasonSchema), assignmentController.cancelManagedAssignment);
assessmentRouter.patch('/assignments/manage/:assignmentId/extend', ...recruiter('assessments.assign'), validateParams(schemas.assignmentIdSchema), validateBody(schemas.extendSchema), assignmentController.extendManagedAssignment);
assessmentRouter.patch('/assignments/manage/:assignmentId/release-result', ...recruiter('assessments.review'), validateParams(schemas.assignmentIdSchema), reviewController.releaseAssignmentResult);
assessmentRouter.post('/assignments', ...recruiter('assessments.assign'), validateBody(schemas.assignmentBodySchema), assignmentController.createAssignment);
assessmentRouter.get('/assignments/me', candidate, validateQuery(schemas.candidateAssignmentQuerySchema), assignmentController.myAssignments);
assessmentRouter.get('/assignments/me/:assignmentId', candidate, validateParams(schemas.assignmentIdSchema), assignmentController.myAssignment);
assessmentRouter.post('/assignments/me/:assignmentId/start', candidate, validateParams(schemas.assignmentIdSchema), attemptController.startMyAttempt);

assessmentRouter.get('/attempts/me/:attemptId/result', candidate, validateParams(schemas.attemptIdSchema), attemptController.myResult);
assessmentRouter.get('/attempts/me/:attemptId', candidate, validateParams(schemas.attemptIdSchema), attemptController.myAttempt);
assessmentRouter.patch('/attempts/me/:attemptId/answers', candidate, validateParams(schemas.attemptIdSchema), validateBody(schemas.saveAnswerSchema), attemptController.saveMyAnswer);
assessmentRouter.post('/attempts/me/:attemptId/submit', candidate, validateParams(schemas.attemptIdSchema), attemptController.submitMyAttempt);

assessmentRouter.get('/reviews', ...recruiter('assessments.review'), reviewController.pendingReviews);
assessmentRouter.get('/reviews/:attemptId', ...recruiter('assessments.review'), validateParams(schemas.attemptIdSchema), reviewController.reviewAttempt);
assessmentRouter.patch('/reviews/:attemptId/questions/:questionId', ...recruiter('assessments.review'), validateParams(schemas.attemptQuestionParamsSchema), validateBody(schemas.reviewSchema), reviewController.scoreReviewQuestion);
assessmentRouter.patch('/reviews/:attemptId/complete', ...recruiter('assessments.review'), validateParams(schemas.attemptIdSchema), validateBody(schemas.reviewCompleteSchema), reviewController.completeAttemptReview);

assessmentRouter.get('/manage/:assessmentId/statistics', ...recruiter('assessments.view'), validateParams(schemas.assessmentIdSchema), reviewController.assessmentStatistics);
assessmentRouter.get('/manage', ...recruiter('assessments.view'), validateQuery(schemas.assessmentQuerySchema), assessmentController.managedAssessments);
assessmentRouter.get('/manage/:assessmentId', ...recruiter('assessments.view'), validateParams(schemas.assessmentIdSchema), assessmentController.managedAssessment);
assessmentRouter.patch('/manage/:assessmentId', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), validateBody(schemas.assessmentUpdateSchema), assessmentController.updateManagedAssessment);
assessmentRouter.delete('/manage/:assessmentId', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), assessmentController.deleteManagedAssessment);
assessmentRouter.post('/manage/:assessmentId/questions', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), validateBody(schemas.assessmentQuestionSchema), assessmentController.addManagedAssessmentQuestion);
assessmentRouter.delete('/manage/:assessmentId/questions/:questionId', ...recruiter('assessments.manage'), validateParams(schemas.assessmentQuestionParamsSchema), assessmentController.removeManagedAssessmentQuestion);
assessmentRouter.patch('/manage/:assessmentId/questions/reorder', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), validateBody(schemas.reorderSchema), assessmentController.reorderManagedAssessmentQuestions);
assessmentRouter.patch('/manage/:assessmentId/publish', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), assessmentController.publishManagedAssessment);
assessmentRouter.patch('/manage/:assessmentId/archive', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), assessmentController.archiveManagedAssessment);
assessmentRouter.post('/manage/:assessmentId/clone', ...recruiter('assessments.manage'), validateParams(schemas.assessmentIdSchema), assessmentController.cloneManagedAssessment);
assessmentRouter.post('/', ...recruiter('assessments.manage'), validateBody(schemas.assessmentBodySchema), assessmentController.createManagedAssessment);
