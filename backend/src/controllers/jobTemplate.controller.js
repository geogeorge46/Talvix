import { createTemplate, createTemplateFromJob, deleteTemplate, getTemplate, listTemplates, updateTemplate } from '../services/jobTemplate.service.js';

export const createJobTemplate = async (request, response, next) => {
  try {
    const template = await createTemplate(request.company.id, request.user.id, request.body);
    return response.status(201).json({
      success: true,
      message: 'Job template created successfully',
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
};

export const listJobTemplates = async (request, response, next) => {
  try {
    const data = await listTemplates(request.company.id, request.validatedQuery);
    return response.json({
      success: true,
      message: 'Job templates retrieved successfully',
      data
    });
  } catch (error) {
    return next(error);
  }
};

export const getJobTemplate = async (request, response, next) => {
  try {
    const template = await getTemplate(request.company.id, request.params.templateId);
    return response.json({
      success: true,
      message: 'Job template retrieved successfully',
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
};

export const updateJobTemplate = async (request, response, next) => {
  try {
    const template = await updateTemplate(request.company.id, request.params.templateId, request.body, request.user.id);
    return response.json({
      success: true,
      message: 'Job template updated successfully',
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteJobTemplate = async (request, response, next) => {
  try {
    const template = await deleteTemplate(request.company.id, request.params.templateId, request.user.id);
    return response.json({
      success: true,
      message: 'Job template deleted successfully',
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
};

export const createTemplateFromExistingJob = async (request, response, next) => {
  try {
    const template = await createTemplateFromJob(request.company.id, request.user.id, request.params.jobId, request.body.templateName);
    return response.status(201).json({
      success: true,
      message: 'Job template created from job successfully',
      data: { template }
    });
  } catch (error) {
    return next(error);
  }
};
