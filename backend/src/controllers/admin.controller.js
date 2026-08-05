import * as service from '../services/admin.service.js';
import { AuditLog } from '../models/AuditLog.js';
import { SecurityIncident } from '../models/SecurityIncident.js';
import { TenantQuota } from '../models/TenantQuota.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const createOrganization = handle(async (request, response) => {
  const { name, branding, settings } = request.body;
  if (!name) throw new AppError('name parameter is required', 400);

  const org = await service.createOrganization(companyId(request), name, branding, settings);
  await service.logAuditEvent(request.user.id, companyId(request), 'create_org', 'Organization', { name });
  return ok(response, 'Organization created successfully', { org }, 201);
});

export const rotateSecret = handle(async (request, response) => {
  const { key, rotationPolicy } = request.body;
  if (!key) throw new AppError('key parameter is required', 400);

  const secret = await service.rotateSecret(companyId(request), key, rotationPolicy);
  await service.logAuditEvent(request.user.id, companyId(request), 'rotate_secret', 'Secret', { key });
  return ok(response, 'Secret rotated successfully', { secret }, 200);
});

export const getAuditLogs = handle(async (request, response) => {
  const logs = await AuditLog.find({ company: companyId(request) }).sort({ timestamp: -1 }).limit(100);
  return ok(response, 'Audit logs retrieved successfully', { logs });
});

export const updateQuotas = handle(async (request, response) => {
  const { aiTokens, apiRequests, storage, users } = request.body;

  let quota = await TenantQuota.findOne({ company: companyId(request) });
  if (quota) {
    if (aiTokens !== undefined) quota.aiTokens = aiTokens;
    if (apiRequests !== undefined) quota.apiRequests = apiRequests;
    if (storage !== undefined) quota.storage = storage;
    if (users !== undefined) quota.users = users;
    await quota.save();
  } else {
    quota = await TenantQuota.create({
      company: companyId(request),
      aiTokens: aiTokens ?? 1000000,
      apiRequests: apiRequests ?? 50000,
      storage: storage ?? 53687091200,
      users: users ?? 50
    });
  }

  await service.logAuditEvent(request.user.id, companyId(request), 'update_quotas', 'TenantQuota', { quota });
  return ok(response, 'Tenant quotas updated successfully', { quota });
});

export const getSecurityDashboard = handle(async (request, response) => {
  const incidents = await SecurityIncident.find({ company: companyId(request) }).sort({ createdAt: -1 });
  const metrics = {
    totalIncidents: incidents.length,
    criticalIncidents: incidents.filter(i => i.severity === 'critical').length,
    openIncidents: incidents.filter(i => i.status === 'open').length
  };
  return ok(response, 'Security score details retrieved', { metrics, incidents });
});
