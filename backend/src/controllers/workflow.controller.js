import * as service from '../services/workflow.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const createWorkflow = handle(async (request, response) => {
  const { name, trigger, nodes, edges } = request.body;
  if (!name || !trigger) throw new AppError('name and trigger parameters are required', 400);

  const workflow = await service.createWorkflow(name, trigger, nodes || [], edges || [], companyId(request), request.user.id);
  return ok(response, 'Workflow created successfully', { workflow }, 201);
});

export const listWorkflows = handle(async (request, response) => {
  const workflows = await service.listWorkflows(companyId(request));
  return ok(response, 'Workflows loaded successfully', { workflows });
});

export const publishWorkflow = handle(async (request, response) => {
  const { id } = request.params;
  const workflow = await service.publishWorkflow(id, companyId(request), request.user.id);
  return ok(response, 'Workflow published successfully', { workflow });
});

export const runWorkflow = handle(async (request, response) => {
  const { id } = request.params;
  const { payload } = request.body;

  const execution = await service.executeWorkflow(id, 'Manual Trigger', payload || {}, companyId(request), request.user.id);
  return ok(response, 'Workflow execution triggered successfully', { execution });
});

export const listExecutions = handle(async (request, response) => {
  const { workflowId } = request.query;
  if (!workflowId) throw new AppError('workflowId parameter is required', 400);

  const executions = await service.getWorkflowExecutions(workflowId);
  return ok(response, 'Executions list loaded successfully', { executions });
});
