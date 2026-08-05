import * as service from '../services/candidateIntelligence.service.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const review = handle(async (request, response) => {
  const { resumeContent, candidateId } = request.body;
  if (!resumeContent || !candidateId) throw new AppError('resumeContent and candidateId parameters are required', 400);

  const report = await service.reviewResume(
    resumeContent,
    companyId(request),
    candidateId,
    request.user.id,
    { userId: request.user.id, companyId: companyId(request) }
  );

  return ok(response, 'Resume review report completed successfully', { report }, 201);
});

export const fraudCheck = handle(async (request, response) => {
  const { resumeContent, candidateId } = request.body;
  if (!resumeContent || !candidateId) throw new AppError('resumeContent and candidateId are required', 400);

  const report = await service.detectFraud(
    resumeContent,
    companyId(request),
    candidateId,
    request.user.id,
    { userId: request.user.id, companyId: companyId(request) }
  );

  return ok(response, 'Resume fraud check completed successfully', { report }, 201);
});

export const candidateIntelligence = handle(async (request, response) => {
  const { candidateId } = request.params;
  if (!candidateId) throw new AppError('candidateId is required', 400);

  const report = await service.getCandidateIntelligence(candidateId);
  return ok(response, 'Candidate intelligence metrics retrieved successfully', { report });
});

export const resumeReviewDetails = handle(async (request, response) => {
  const { id } = request.params;
  if (!id) throw new AppError('id parameter is required', 400);

  const report = await service.getResumeReview(id);
  return ok(response, 'Resume review details retrieved successfully', { report });
});
