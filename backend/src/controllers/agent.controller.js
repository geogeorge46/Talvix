import * as service from '../services/agent.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const runAgentTask = handle(async (request, response) => {
  const { agentType } = request.params;
  const { instruction } = request.body;
  if (!instruction) throw new AppError('instruction text parameter is required', 400);

  const allowedTypes = ['recruiter', 'interview', 'analytics', 'compliance', 'communication'];
  if (!allowedTypes.includes(agentType)) throw new AppError(`Invalid agent type. Allowed types: ${allowedTypes.join(', ')}`, 400);

  const result = await service.executeAgentTask(
    agentType,
    instruction,
    companyId(request),
    request.user.id,
    { userId: request.user.id, companyId: companyId(request) }
  );

  return ok(response, 'Agent task processed successfully', { result });
});
