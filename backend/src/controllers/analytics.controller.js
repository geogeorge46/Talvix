import * as service from '../services/analytics.service.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const getDashboard = handle(async (request, response) => {
  const snapshot = await service.getDashboardAnalytics(companyId(request));
  return ok(response, 'Dashboard snapshot loaded successfully', { snapshot });
});

export const refreshDashboard = handle(async (request, response) => {
  const snapshot = await service.generateAnalyticsSnapshot(companyId(request));
  return ok(response, 'Dashboard metrics refreshed successfully', { snapshot });
});

export const generateReport = handle(async (request, response) => {
  const { reportType } = request.body;
  
  const report = await service.generateExecutiveReport(
    companyId(request),
    request.user.id,
    reportType || 'monthly',
    { userId: request.user.id, companyId: companyId(request) }
  );

  return ok(response, 'Executive report generated successfully', { report }, 201);
});

export const listReports = handle(async (request, response) => {
  const reports = await service.listExecutiveReports(companyId(request));
  return ok(response, 'Executive reports list loaded successfully', { reports });
});
