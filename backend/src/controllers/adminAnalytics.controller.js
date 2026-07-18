import * as analytics from '../services/adminAnalytics.service.js';
import { reportToCsv } from '../utils/analyticsSerializer.js';

const handle = (service) => async (request, response, next) => { try { return response.json({ success: true, data: await service(request.validatedQuery) }); } catch (error) { return next(error); } };
export const overview = handle(analytics.overview);
export const users = handle(analytics.users);
export const candidates = handle(analytics.candidates);
export const recruiters = handle(analytics.recruiters);
export const companies = handle(analytics.companies);
export const jobs = handle(analytics.jobs);
export const applications = handle(analytics.applications);
export const assessments = handle(analytics.assessments);
export const interviews = handle(analytics.interviews);
export const offers = handle(analytics.offers);
export const documents = handle(analytics.documents);
export const notifications = handle(analytics.notifications);
export const health = handle(analytics.health);
export const exportReport = async (request, response, next) => { try { const report = await analytics.reports[request.validatedQuery.report](request.validatedQuery); const filename = `talvix-${request.validatedQuery.report}-${new Date().toISOString().slice(0, 10)}`; if (request.validatedQuery.format === 'csv') { response.set('Content-Type', 'text/csv; charset=utf-8'); response.set('Content-Disposition', `attachment; filename="${filename}.csv"`); return response.send(reportToCsv(report)); } response.set('Content-Disposition', `attachment; filename="${filename}.json"`); return response.json({ success: true, data: report }); } catch (error) { return next(error); } };
