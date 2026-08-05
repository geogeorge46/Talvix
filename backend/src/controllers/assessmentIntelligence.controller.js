import * as service from '../services/assessmentIntelligence.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const generateAssessment = handle(async (request, response) => {
  const { jobDescription } = request.body;
  if (!jobDescription) throw new AppError('jobDescription parameter is required', 400);

  const assessment = await service.generateAIAssessment(
    jobDescription,
    companyId(request),
    request.user.id,
    {
      userId: request.user.id,
      companyId: companyId(request),
      ipAddress: request.ip || 'Unknown',
      userAgent: request.headers['user-agent'] || 'Unknown'
    }
  );

  return ok(response, 'Assessment generated successfully', { assessment }, 201);
});

export const generateKit = handle(async (request, response) => {
  const { jobDetails, candidateDetails } = request.body;
  if (!jobDetails || !candidateDetails) throw new AppError('jobDetails and candidateDetails are required', 400);

  const kit = await service.generateInterviewKit(
    jobDetails,
    candidateDetails,
    companyId(request),
    request.user.id,
    {
      userId: request.user.id,
      companyId: companyId(request)
    }
  );

  return ok(response, 'Interview kit compiled successfully', { kit });
});

export const evaluateAssessmentAttempt = handle(async (request, response) => {
  const { attemptId } = request.params;
  if (!attemptId) throw new AppError('attemptId parameter is required', 400);

  const attempt = await service.evaluateAttempt(attemptId, {
    userId: request.user.id,
    companyId: companyId(request)
  });

  return ok(response, 'Attempt evaluated successfully', { attempt });
});
