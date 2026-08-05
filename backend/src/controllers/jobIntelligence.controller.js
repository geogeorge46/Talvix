import * as service from '../services/jobIntelligence.service.js';
import { JobIntelligence } from '../models/JobIntelligence.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const createIntelligence = handle(async (request, response) => {
  const { jobId } = request.params;
  const company = companyId(request);

  const job = await service.queueJobParsing(jobId, company, request.user.id, {
    userId: request.user.id,
    companyId: company,
    ipAddress: request.ip || 'Unknown',
    userAgent: request.headers['user-agent'] || 'Unknown'
  });

  return ok(response, 'Job intelligence generation queued', { jobId: job._id }, 201);
});

export const getIntelligence = handle(async (request, response) => {
  const { jobId } = request.params;
  const company = companyId(request);

  const intelligence = await JobIntelligence.findOne({ job: jobId, company });
  if (!intelligence) throw new AppError('Job intelligence not found', 404);

  return ok(response, 'Job intelligence retrieved successfully', { intelligence });
});

export const reparseJob = handle(async (request, response) => {
  const { jobId } = request.params;
  const company = companyId(request);

  const job = await service.queueJobParsing(jobId, company, request.user.id, {
    userId: request.user.id,
    companyId: company,
    ipAddress: request.ip || 'Unknown',
    userAgent: request.headers['user-agent'] || 'Unknown'
  });

  return ok(response, 'Job intelligence reparse queued successfully', { jobId: job._id });
});

export const listVersions = handle(async (request, response) => {
  const { jobId } = request.params;
  const company = companyId(request);

  const intel = await JobIntelligence.findOne({ job: jobId, company });
  if (!intel) throw new AppError('Job intelligence not found', 404);

  const versions = await JobIntelligence.db.model('JobVersion')
    .find({ job: jobId })
    .select('version createdAt')
    .sort({ version: -1 });

  return ok(response, 'Job intelligence versions listed successfully', { versions });
});

export const restoreVersion = handle(async (request, response) => {
  const { jobId, version } = request.params;
  const company = companyId(request);

  const intelligence = await service.restoreJobVersion(jobId, company, Number(version));
  return ok(response, `Job intelligence restored to version ${version}`, { intelligence });
});

export const compareVersions = handle(async (request, response) => {
  const { jobId } = request.params;
  const { v1, v2 } = request.query;
  const company = companyId(request);

  if (!v1 || !v2) throw new AppError('v1 and v2 query parameters are required', 400);

  const comparison = await service.compareJobVersions(jobId, company, Number(v1), Number(v2));
  return ok(response, 'Job intelligence comparison generated', comparison);
});

export const downloadParsedJson = handle(async (request, response) => {
  const { jobId } = request.params;
  const company = companyId(request);

  const intelligence = await JobIntelligence.findOne({ job: jobId, company });
  if (!intelligence) throw new AppError('Job intelligence not found', 404);

  return response.json(intelligence);
});
