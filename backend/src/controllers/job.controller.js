import { archiveJob, closeJob, cloneJob, createJob, getManagedJob, getPublicJob, listManagedJobs, pauseJob, recruiterPublishJob, resumeJob, searchPublicJobs, submitJob, updateJob, getCandidateComparison } from '../services/job.service.js';
import { generateJobDescription, suggestSkills, performScamCheck } from '../services/ai.service.js';
import { getJobIntelligenceService, extractAndPersistJobIntelligence, previewJobIntelligence } from '../services/jobIntelligence.service.js';
import { getJobQualityService, analyzeAndPersistJobQuality, previewJobQuality } from '../services/jobQuality.service.js';
import { getJobBlueprintService, generateAndPersistBlueprint, regenerateSectionService, updateJobBlueprintService, approveJobBlueprintService, convertBlueprintToAssessmentService, previewAssessmentBlueprint } from '../services/assessmentBlueprint.service.js';
import { Company } from '../models/Company.js';
export const createCompanyJob = async (request, response, next) => { try { const job = await createJob(request.company, request.user.id, request.body); return response.status(201).json({ success: true, message: 'Job created successfully', data: { job } }); } catch (error) { return next(error); } };
export const managedJobs = async (request, response, next) => { try { const data = await listManagedJobs(request.company.id, request.validatedQuery); return response.json({ success: true, message: 'Managed jobs retrieved successfully', data }); } catch (error) { return next(error); } };
export const managedJob = async (request, response, next) => { try { const job = await getManagedJob(request.company.id, request.params.jobId); return response.json({ success: true, message: 'Job retrieved successfully', data: { job } }); } catch (error) { return next(error); } };
export const candidateComparison = async (request, response, next) => { try { const data = await getCandidateComparison(request.company.id, request.params.jobId); return response.json({ success: true, message: 'Candidate comparison retrieved successfully', data }); } catch (error) { return next(error); } };
export const updateManagedJob = async (request, response, next) => { try { const job = await updateJob(request.company.id, request.params.jobId, request.body, request.user.id); return response.json({ success: true, message: 'Job updated successfully', data: { job } }); } catch (error) { return next(error); } };
const jobAction = (service, message) => async (request, response, next) => { try { const job = await service(request.company, request.params.jobId, request.user.id); return response.json({ success: true, message, data: { job } }); } catch (error) { return next(error); } };
export const deleteManagedJob = async (request, response, next) => { try { const job = await archiveJob(request.company.id, request.params.jobId, request.user.id); return response.json({ success: true, message: 'Job archived successfully', data: { job } }); } catch (error) { return next(error); } };
export const submitManagedJob = jobAction(submitJob, 'Job submitted for review successfully');
export const publishManagedJob = jobAction(recruiterPublishJob, 'Job published successfully');
export const pauseManagedJob = async (request, response, next) => { try { const job = await pauseJob(request.company.id, request.params.jobId, request.user.id); return response.json({ success: true, message: 'Job paused successfully', data: { job } }); } catch (error) { return next(error); } };
export const resumeManagedJob = jobAction(resumeJob, 'Job resumed successfully');
export const closeManagedJob = async (request, response, next) => { try { const job = await closeJob(request.company.id, request.params.jobId, request.user.id); return response.json({ success: true, message: 'Job closed successfully', data: { job } }); } catch (error) { return next(error); } };
export const cloneManagedJob = async (request, response, next) => { try { const job = await cloneJob(request.company.id, request.params.jobId, request.user.id); return response.status(201).json({ success: true, message: 'Job cloned successfully', data: { job } }); } catch (error) { return next(error); } };
export const publicJobs = async (request, response, next) => { try { const data = await searchPublicJobs(request.validatedQuery); return response.json({ success: true, message: 'Jobs retrieved successfully', data }); } catch (error) { return next(error); } };
export const publicJob = async (request, response, next) => { try { const job = await getPublicJob(request.params.jobId); return response.json({ success: true, message: 'Job retrieved successfully', data: { job } }); } catch (error) { return next(error); } };

export const aiGenerateJobDescription = async (request, response, next) => {
  try {
    const companyId = request.company?.id || request.tenantCompanyId;
    let company = null;
    if (companyId) {
      company = await Company.findById(companyId)
        .select('name description industry headquarters benefits technologies companySize website')
        .lean();
    }
    const description = await generateJobDescription(request.body, {
      company,
      companyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });
    return response.json({
      success: true,
      message: 'Job description generated successfully',
      data: { description }
    });
  } catch (error) {
    return next(error);
  }
};


export const aiSuggestJobSkills = async (request, response, next) => {
  try {
    const { title, description } = request.body;
    const skills = await suggestSkills(title, description, {
      companyId: request.company?.id || request.tenantCompanyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });
    return response.json({
      success: true,
      message: 'Skills suggested successfully',
      data: { skills }
    });
  } catch (error) {
    return next(error);
  }
};

export const aiJobSafetyCheck = async (request, response, next) => {
  try {
    const { title, description } = request.body;
    const check = await performScamCheck(title, description, {
      companyId: request.company?.id || request.tenantCompanyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });
    return response.json({
      success: true,
      message: 'Safety check completed successfully',
      data: { check }
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedJobIntelligence = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const result = await getJobIntelligenceService(companyId, jobId);
    return response.json({
      success: true,
      message: 'Job intelligence retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const extractManagedJobIntelligence = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const forceRefresh = Boolean(request.body?.forceRefresh || request.query?.refresh === 'true');
    
    const result = await extractAndPersistJobIntelligence(companyId, jobId, {
      forceRefresh,
      userId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: result.cached ? 'Job intelligence retrieved from cache' : 'Job intelligence extracted successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const aiExtractJobIntelligencePreview = async (request, response, next) => {
  try {
    const { title, description } = request.body;
    const intelligence = await previewJobIntelligence(title, description, {
      companyId: request.company?.id || request.tenantCompanyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: 'Job intelligence preview generated successfully',
      data: { intelligence }
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedJobQuality = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const result = await getJobQualityService(companyId, jobId);
    return response.json({
      success: true,
      message: 'Job quality analysis retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const analyzeManagedJobQuality = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const forceRefresh = Boolean(request.body?.forceRefresh || request.query?.refresh === 'true');

    const result = await analyzeAndPersistJobQuality(companyId, jobId, {
      forceRefresh,
      userId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: result.cached ? 'Job quality analysis retrieved from cache' : 'Job quality analysis completed successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const aiAnalyzeJobQualityPreview = async (request, response, next) => {
  try {
    const { title, description } = request.body;
    const quality = await previewJobQuality(title, description, {
      companyId: request.company?.id || request.tenantCompanyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: 'Job quality analysis preview generated successfully',
      data: { quality }
    });
  } catch (error) {
    return next(error);
  }
};

export const getManagedJobBlueprint = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const result = await getJobBlueprintService(companyId, jobId);
    return response.json({
      success: true,
      message: 'Job blueprint retrieved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const generateManagedJobBlueprint = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const forceRefresh = Boolean(request.body?.forceRefresh || request.query?.refresh === 'true');

    const result = await generateAndPersistBlueprint(companyId, jobId, {
      forceRefresh,
      userId: request.user.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: result.cached ? 'Job blueprint retrieved from cache' : 'Job blueprint generated successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const regenerateManagedJobBlueprintSection = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const { sectionId, feedback, customInstructions } = request.body;

    const result = await regenerateSectionService(companyId, jobId, sectionId, feedback || customInstructions || '', {
      userId: request.user.id
    });

    return response.json({
      success: true,
      message: 'Blueprint section regenerated successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const updateManagedJobBlueprint = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;
    const updateData = request.body.data || request.body;

    const result = await updateJobBlueprintService(companyId, jobId, updateData);

    return response.json({
      success: true,
      message: 'Job blueprint updated successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const approveManagedJobBlueprint = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;

    const result = await approveJobBlueprintService(companyId, jobId);

    return response.json({
      success: true,
      message: 'Job blueprint approved successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const convertManagedJobBlueprintToAssessment = async (request, response, next) => {
  try {
    const companyId = request.company.id;
    const { jobId } = request.params;

    const result = await convertBlueprintToAssessmentService(companyId, jobId, request.user.id);

    return response.json({
      success: true,
      message: 'Job blueprint converted into assessment successfully',
      data: result
    });
  } catch (error) {
    return next(error);
  }
};

export const aiGenerateJobBlueprintPreview = async (request, response, next) => {
  try {
    const { title, description } = request.body;
    const blueprintData = await previewAssessmentBlueprint(title, description, {
      companyId: request.company?.id || request.tenantCompanyId,
      userId: request.user?.id,
      ipAddress: request.ip,
      userAgent: request.get('User-Agent')
    });

    return response.json({
      success: true,
      message: 'Job blueprint preview generated successfully',
      data: { blueprint: blueprintData }
    });
  } catch (error) {
    return next(error);
  }
};




