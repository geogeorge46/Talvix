import * as service from '../services/question.service.js';
const handle = (action) => async (request, response, next) => { try { return await action(request, response); } catch (error) { return next(error); } };
export const createManagedQuestion = handle(async (req, res) => res.status(201).json({ success: true, message: 'Question created successfully', data: { question: await service.createQuestion(req.company.id, req.user.id, req.body) } }));
export const managedQuestions = handle(async (req, res) => res.json({ success: true, message: 'Questions retrieved successfully', data: await service.listQuestions(req.company.id, req.validatedQuery) }));
export const managedQuestion = handle(async (req, res) => res.json({ success: true, message: 'Question retrieved successfully', data: { question: await service.getQuestion(req.company.id, req.params.questionId) } }));
export const updateManagedQuestion = handle(async (req, res) => res.json({ success: true, message: 'Question updated successfully', data: { question: await service.updateQuestion(req.company.id, req.params.questionId, req.body) } }));
export const deleteManagedQuestion = handle(async (req, res) => res.json({ success: true, message: 'Question deactivated successfully', data: { question: await service.deactivateQuestion(req.company.id, req.params.questionId) } }));
export const cloneManagedQuestion = handle(async (req, res) => res.status(201).json({ success: true, message: 'Question cloned successfully', data: { question: await service.cloneQuestion(req.company.id, req.params.questionId, req.user.id) } }));
