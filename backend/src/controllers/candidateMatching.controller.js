import {
  calculateAndPersistMatch,
  getManagedApplicantMatchesService,
  getManagedApplicationMatchDetailsService,
  getCandidateJobFitAnalysisService
} from '../services/candidateMatching.service.js';

export const getManagedApplicantMatchesHandler = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const result = await getManagedApplicantMatchesService(companyId, jobId, request.query);

    return response.json({
      success: true,
      message: 'Applicant matches retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedApplicationMatchDetailsHandler = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { applicationId } = request.params;
    const result = await getManagedApplicationMatchDetailsService(companyId, applicationId);

    return response.json({
      success: true,
      message: 'Application match details retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const calculateManagedCandidateMatchHandler = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId, candidateId } = request.params;
    const result = await calculateAndPersistMatch(companyId, jobId, candidateId, {
      userId: request.user.id
    });

    return response.json({
      success: true,
      message: 'Candidate match calculated successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const getCandidateJobFitAnalysisHandler = async (request, response, next) => {
  try {
    const candidateUserId = request.user.id;
    const { jobId } = request.params;
    const result = await getCandidateJobFitAnalysisService(candidateUserId, jobId);

    return response.json({
      success: true,
      message: 'Job fit and skill gap analysis retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};
