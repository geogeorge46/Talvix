import * as service from '../services/adminAssessment.service.js';
const handle = (action) => async (request, response, next) => { try { return await action(request, response); } catch (error) { return next(error); } };
export const adminAssignments = handle(async (r, s) => s.json({ success: true, message: 'Assessment assignments retrieved successfully', data: await service.listAdminAssignments(r.validatedQuery) }));
export const adminAssignment = handle(async (r, s) => s.json({ success: true, message: 'Assessment assignment retrieved successfully', data: { assignment: await service.getAdminAssignment(r.params.assignmentId) } }));
export const adminAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment attempt retrieved successfully', data: { attempt: await service.getAdminAttempt(r.params.attemptId) } }));
export const cancelAdminAssignment = handle(async (r, s) => s.json({ success: true, message: 'Assessment assignment cancelled successfully', data: { assignment: await service.adminCancelAssignment(r.params.assignmentId, r.user.id, r.body.reason) } }));
export const reopenAdminAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment review reopened successfully', data: { attempt: await service.reopenAdminReview(r.params.attemptId, r.user.id, r.body.reason) } }));
export const expireAdminAssignment = handle(async (r, s) => s.json({ success: true, message: 'Assessment assignment expired successfully', data: { assignment: await service.expireAdminAssignment(r.params.assignmentId, r.user.id, r.body.reason) } }));
