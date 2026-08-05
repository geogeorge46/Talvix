import * as service from '../services/integration.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const connectHRIS = handle(async (request, response) => {
  const { provider, credentials } = request.body;
  if (!provider || !credentials) throw new AppError('provider and credentials parameters are required', 400);

  const connection = await service.connectHRIS(companyId(request), provider, credentials, request.user.id);
  return ok(response, 'HRIS connected successfully', { connection }, 201);
});

export const syncHRIS = handle(async (request, response) => {
  const { provider } = request.params;
  const result = await service.syncHRISData(companyId(request), provider);
  return ok(response, 'HRIS data synchronization triggered successfully', { result });
});

export const createAPIKey = handle(async (request, response) => {
  const { name } = request.body;
  if (!name) throw new AppError('name parameter is required', 400);

  const apiKey = await service.createAPIKey(companyId(request), name, request.user.id);
  return ok(response, 'API Key generated successfully', { apiKey }, 201);
});

export const registerWebhook = handle(async (request, response) => {
  const { targetUrl, events } = request.body;
  if (!targetUrl || !events || !Array.isArray(events)) throw new AppError('targetUrl and events parameters are required', 400);

  const subscription = await service.registerWebhook(companyId(request), targetUrl, events, request.user.id);
  return ok(response, 'Webhook registered successfully', { subscription }, 201);
});
