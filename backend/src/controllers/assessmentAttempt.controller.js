import * as service from '../services/assessmentWorkflow.service.js';
const handle = (action) => async (request, response, next) => { try { return await action(request, response); } catch (error) { return next(error); } };
const meta = (request) => ({ startIp: request.ip, lastIp: request.ip, userAgent: request.get('user-agent') ?? '' });
export const startMyAttempt = handle(async (r, s) => s.status(201).json({ success: true, message: 'Assessment attempt started successfully', data: { attempt: await service.startAttempt(r.user.id, r.params.assignmentId, meta(r)) } }));
export const myAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment attempt retrieved successfully', data: { attempt: await service.getAttempt(r.user.id, r.params.attemptId) } }));
export const saveMyAnswer = handle(async (r, s) => s.json({ success: true, message: 'Answer saved successfully', data: { savedAt: await service.saveAnswer(r.user.id, r.params.attemptId, r.body, meta(r)) } }));
export const submitMyAttempt = handle(async (r, s) => s.json({ success: true, message: 'Assessment submitted successfully', data: { attempt: await service.submitAttempt(r.user.id, r.params.attemptId) } }));
export const myResult = handle(async (r, s) => s.json({ success: true, message: 'Assessment result retrieved successfully', data: { result: await service.getMyResult(r.user.id, r.params.attemptId) } }));
