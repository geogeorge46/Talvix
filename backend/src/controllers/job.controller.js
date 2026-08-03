import { archiveJob, closeJob, cloneJob, createJob, getManagedJob, getPublicJob, listManagedJobs, pauseJob, recruiterPublishJob, resumeJob, searchPublicJobs, submitJob, updateJob } from '../services/job.service.js';
import { generateJobDescription, suggestSkills, performScamCheck } from '../services/ai.service.js';
export const createCompanyJob = async (request, response, next) => { try { const job = await createJob(request.company, request.user.id, request.body); return response.status(201).json({ success: true, message: 'Job created successfully', data: { job } }); } catch (error) { return next(error); } };
export const managedJobs = async (request, response, next) => { try { const data = await listManagedJobs(request.company.id, request.validatedQuery); return response.json({ success: true, message: 'Managed jobs retrieved successfully', data }); } catch (error) { return next(error); } };
export const managedJob = async (request, response, next) => { try { const job = await getManagedJob(request.company.id, request.params.jobId); return response.json({ success: true, message: 'Job retrieved successfully', data: { job } }); } catch (error) { return next(error); } };
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
    const { title, keyRequirements } = request.body;
    const description = await generateJobDescription(title, keyRequirements);
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
    const skills = await suggestSkills(title, description);
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
    const check = await performScamCheck(title, description);
    return response.json({
      success: true,
      message: 'Safety check completed successfully',
      data: { check }
    });
  } catch (error) {
    return next(error);
  }
};

