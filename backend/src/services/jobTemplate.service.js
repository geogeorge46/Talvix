import { JobTemplate } from '../models/JobTemplate.js';
import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { AuditLog } from '../models/AuditLog.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';

const ownedTemplate = async (companyId, templateId) => {
  const template = await JobTemplate.findOne({ _id: templateId, company: companyId, isActive: true });
  if (!template) throw new AppError('Job template not found', 404);
  return template;
};

export const createTemplate = async (companyId, userId, input) => {
  const template = await JobTemplate.create({
    ...input,
    company: companyId,
    createdBy: userId,
    isActive: true
  });

  await AuditLog.create({
    action: 'template.create',
    actor: userId,
    company: companyId,
    newValue: { name: template.name, title: template.title }
  });

  return template;
};

export const listTemplates = async (companyId, query = {}) => {
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 10;
  const filter = { company: companyId, isActive: true };

  if (query.search) {
    const regex = createSafeRegex(query.search);
    filter.$or = [{ name: regex }, { title: regex }];
  }

  const [templates, total] = await Promise.all([
    JobTemplate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    JobTemplate.countDocuments(filter)
  ]);

  return {
    templates,
    pagination: buildPagination(page, limit, total)
  };
};

export const getTemplate = async (companyId, templateId) => {
  return ownedTemplate(companyId, templateId);
};

export const updateTemplate = async (companyId, templateId, input, userId) => {
  const template = await ownedTemplate(companyId, templateId);
  const oldValue = { name: template.name, title: template.title };

  Object.entries(input).forEach(([key, value]) => template.set(key, value));
  await template.save();

  await AuditLog.create({
    action: 'template.update',
    actor: userId,
    company: companyId,
    oldValue,
    newValue: { name: template.name, title: template.title }
  });

  return template;
};

export const deleteTemplate = async (companyId, templateId, userId) => {
  const template = await ownedTemplate(companyId, templateId);
  template.isActive = false;
  await template.save();

  await AuditLog.create({
    action: 'template.delete',
    actor: userId,
    company: companyId,
    oldValue: { name: template.name }
  });

  return template;
};

export const createTemplateFromJob = async (companyId, userId, jobId, templateName) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) throw new AppError('Job not found', 404);

  const jobObj = job.toObject();
  
  // Strip unique fields
  delete jobObj._id;
  delete jobObj.createdAt;
  delete jobObj.updatedAt;
  delete jobObj.slug;
  delete jobObj.status;
  delete jobObj.viewsCount;
  delete jobObj.applicationsCount;
  delete jobObj.reviewedBy;
  delete jobObj.reviewedAt;
  delete jobObj.publishedAt;
  delete jobObj.closedAt;
  delete jobObj.rejectionReason;
  delete jobObj.isFeatured;

  // Rename fields
  if (jobObj.description) {
    jobObj.jobDescription = jobObj.description;
    delete jobObj.description;
  }

  const template = await JobTemplate.create({
    ...jobObj,
    name: templateName,
    company: companyId,
    createdBy: userId,
    isActive: true
  });

  await AuditLog.create({
    action: 'template.create',
    actor: userId,
    company: companyId,
    newValue: { name: template.name, title: template.title, createdFromJob: jobId }
  });

  return template;
};
