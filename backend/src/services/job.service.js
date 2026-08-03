import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { transitionJob } from '../utils/jobStatus.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { generateUniqueSlug } from '../utils/slug.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { platformAdmins } from '../utils/notificationRecipients.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const ensureCompanyOperational = (company) => {
  if (!company.isActive || company.verificationStatus !== 'verified') throw new AppError('A verified active company is required', 403);
};
const ensurePublishable = (job) => {
  if (!job.title || !job.description || job.openings < 1 || !job.skills.some((skill) => skill.required)) throw new AppError('Job is incomplete and cannot be submitted or published', 400);
  if (!job.applicationDeadline || job.applicationDeadline <= new Date()) throw new AppError('Application deadline must be in the future', 400);
  if (job.salary?.maximum !== undefined && job.salary?.minimum !== undefined && job.salary.maximum < job.salary.minimum) throw new AppError('Invalid salary range', 400);
  if (job.maximumExperience !== undefined && job.maximumExperience < job.minimumExperience) throw new AppError('Invalid experience range', 400);
};
const ensureValidRanges = (job) => {
  if (job.salary?.maximum !== undefined && job.salary?.minimum !== undefined && job.salary.maximum < job.salary.minimum) throw new AppError('Invalid salary range', 400);
  if (job.maximumExperience !== undefined && job.maximumExperience < job.minimumExperience) throw new AppError('Invalid experience range', 400);
};
const ownedJob = async (companyId, jobId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) throw new AppError('Job not found', 404);
  return job;
};

export const createJob = async (company, userId, input) => {
  const slug = await generateUniqueSlug(input.title, (candidate) => Job.exists({ company: company.id, slug: candidate }));
  const job = await Job.create({ ...input, slug, company: company.id, createdBy: userId, status: 'draft' });
  await AuditLog.create({
    action: 'job.create',
    actor: userId,
    company: company.id,
    newValue: { title: job.title, status: job.status }
  });
  return job;
};
export const listManagedJobs = async (companyId, query) => {
  const filter = { company: companyId };
  if (query.search) filter.$or = [{ title: createSafeRegex(query.search) }, { description: createSafeRegex(query.search) }];
  const [jobs, total] = await Promise.all([Job.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), Job.countDocuments(filter)]);
  return { jobs, pagination: buildPagination(query.page, query.limit, total) };
};
export const getManagedJob = ownedJob;
export const updateJob = async (companyId, jobId, input, userId) => {
  const job = await ownedJob(companyId, jobId);
  const oldValue = { title: job.title, status: job.status };
  if (!['draft', 'rejected'].includes(job.status)) throw new AppError('Only draft or rejected jobs can be edited', 409);
  if (job.status === 'rejected') transitionJob(job, 'draft');
  if (input.title && input.title !== job.title) job.slug = await generateUniqueSlug(input.title, (slug) => Job.exists({ company: companyId, slug, _id: { $ne: job.id } }));
  Object.entries(input).forEach(([key, value]) => job.set(key, value)); ensureValidRanges(job); await job.save();
  await AuditLog.create({
    action: 'job.update',
    actor: userId,
    company: companyId,
    oldValue,
    newValue: { title: job.title, status: job.status }
  });
  return job;
};
export const archiveJob = async (companyId, jobId, userId) => {
  const job = await ownedJob(companyId, jobId);
  const oldValue = { status: job.status };
  if (job.status === 'closed') transitionJob(job, 'archived');
  else if (job.status === 'draft') job.status = 'archived';
  else throw new AppError('Only draft or closed jobs can be archived', 409);
  await job.save();
  await AuditLog.create({
    action: 'job.archive',
    actor: userId,
    company: companyId,
    oldValue,
    newValue: { status: job.status }
  });
  return job;
};
export const submitJob = async (company, jobId, userId) => {
  ensureCompanyOperational(company); const job = await ownedJob(company.id, jobId); ensurePublishable(job);
  const oldValue = { status: job.status };
  if (company.autoApproveJobs) {
    transitionJob(job, 'published'); job.publishedAt = new Date(); await job.save();
    await AuditLog.create({
      action: 'job.approve',
      actor: userId,
      company: company.id,
      oldValue,
      newValue: { status: job.status, autoApproved: true }
    });
    await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_APPROVED, actor: String(userId), company: String(company.id), recipientIds: [String(job.createdBy)], payload: { companyId: String(company.id), companyName: company.name, jobId: String(job.id), jobTitle: job.title, autoApproved: true }, deduplicationKey: `job.approved:${job.id}:${job.publishedAt.toISOString()}` }); return job;
  } else {
    transitionJob(job, 'pending-review'); await job.save();
    await AuditLog.create({
      action: 'job.submit',
      actor: userId,
      company: company.id,
      oldValue,
      newValue: { status: job.status }
    });
    const recipients = await platformAdmins(); if (recipients.length) await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_SUBMITTED, company: String(company.id), recipientIds: recipients.map(String), payload: { companyId: String(company.id), companyName: company.name, jobId: String(job.id), jobTitle: job.title, actionUrl: `/admin/jobs/${job.id}` }, deduplicationKey: `job.submitted:${job.id}:${job.updatedAt.toISOString()}` }); return job;
  }
};
export const recruiterPublishJob = async () => { throw new AppError('Jobs are published only through admin approval', 403); };
export const pauseJob = async (companyId, jobId, userId) => {
  const job = await ownedJob(companyId, jobId);
  const oldValue = { status: job.status };
  transitionJob(job, 'paused'); await job.save();
  await AuditLog.create({
    action: 'job.pause',
    actor: userId,
    company: companyId,
    oldValue,
    newValue: { status: job.status }
  });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_PAUSED, company: String(companyId), recipientIds: [String(job.createdBy)], payload: { companyId: String(companyId), jobId: String(job.id), jobTitle: job.title }, deduplicationKey: `job.paused:${job.id}:${job.updatedAt.toISOString()}` }); return job;
};
export const resumeJob = async (company, jobId, userId) => {
  ensureCompanyOperational(company); const job = await ownedJob(company.id, jobId); ensurePublishable(job);
  const oldValue = { status: job.status };
  transitionJob(job, 'published'); await job.save();
  await AuditLog.create({
    action: 'job.resume',
    actor: userId,
    company: company.id,
    oldValue,
    newValue: { status: job.status }
  });
  return job;
};
export const closeJob = async (companyId, jobId, userId) => {
  const job = await ownedJob(companyId, jobId);
  const oldValue = { status: job.status };
  transitionJob(job, 'closed'); await job.save();
  await AuditLog.create({
    action: 'job.close',
    actor: userId,
    company: companyId,
    oldValue,
    newValue: { status: job.status }
  });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_CLOSED, company: String(companyId), recipientIds: [String(job.createdBy)], payload: { companyId: String(companyId), jobId: String(job.id), jobTitle: job.title }, deduplicationKey: `job.closed:${job.id}:${job.updatedAt.toISOString()}` }); return job;
};

const publicPipeline = (query, id) => {
  const match = { status: 'published', applicationDeadline: { $gt: new Date() } };
  if (id) match._id = new mongoose.Types.ObjectId(id);
  if (query?.skills?.length) match['skills.name'] = { $all: query.skills.map(createSafeRegex) };
  if (query?.company) match.company = new mongoose.Types.ObjectId(query.company);
  if (query?.employmentType) match.employmentType = query.employmentType;
  if (query?.workMode) match.workMode = query.workMode;
  if (query?.minimumSalary !== undefined) match['salary.maximum'] = { $gte: query.minimumSalary };
  if (query?.maximumExperience !== undefined) match.minimumExperience = { $lte: query.maximumExperience };
  if (query?.postedWithin) match.publishedAt = { $gte: new Date(Date.now() - query.postedWithin * 86_400_000) };
  if (query?.location) { const regex = createSafeRegex(query.location); match.$or = [{ 'location.city': regex }, { 'location.state': regex }, { 'location.country': regex }]; }
  const pipeline = [{ $match: match }, { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'company' } }, { $unwind: '$company' }, { $match: { 'company.verificationStatus': 'verified', 'company.isActive': true } }];
  if (query?.search) { const regex = createSafeRegex(query.search); pipeline.push({ $match: { $or: [{ title: regex }, { description: regex }, { 'skills.name': regex }, { 'company.name': regex }, { 'location.city': regex }, { 'location.country': regex }] } }); }
  pipeline.push({ $project: { createdBy: 0, reviewedBy: 0, reviewedAt: 0, 'company.owner': 0, 'company.teamMembers': 0, 'company.verificationNotes': 0, 'company.verifiedBy': 0 } }, { $set: { salary: { $cond: ['$salary.isVisible', '$salary', { isVisible: false }] } } });
  return pipeline;
};
export const searchPublicJobs = async (query) => {
  const sorts = { newest: { publishedAt: -1 }, oldest: { publishedAt: 1 }, 'salary-high': { 'salary.maximum': -1 }, 'salary-low': { 'salary.minimum': 1 }, relevance: { isFeatured: -1, publishedAt: -1 }, deadline: { applicationDeadline: 1 } };
  const pipeline = publicPipeline(query);
  pipeline.push({ $facet: { jobs: [{ $sort: sorts[query.sort] }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }], metadata: [{ $count: 'total' }] } });
  const [result] = await Job.aggregate(pipeline); const total = result.metadata[0]?.total ?? 0;
  return { jobs: result.jobs, pagination: buildPagination(query.page, query.limit, total) };
};
export const getPublicJob = async (jobId) => {
  const [job] = await Job.aggregate(publicPipeline(null, jobId));
  if (!job) throw new AppError('Job not found', 404);
  await Job.updateOne({ _id: jobId }, { $inc: { viewsCount: 1 } }); return job;
};

export const cloneJob = async (companyId, jobId, userId) => {
  const job = await ownedJob(companyId, jobId);
  const jobObj = job.toObject();

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

  const clonedTitle = `Clone of ${job.title}`.slice(0, 150);
  const slug = await generateUniqueSlug(clonedTitle, (candidate) => Job.exists({ company: companyId, slug: candidate }));

  const clonedJob = await Job.create({
    ...jobObj,
    title: clonedTitle,
    slug,
    createdBy: userId,
    status: 'draft'
  });

  await AuditLog.create({
    action: 'job.create',
    actor: userId,
    company: companyId,
    newValue: { title: clonedJob.title, status: clonedJob.status, clonedFrom: jobId }
  });

  return clonedJob;
};

export const assertRecruiterApproved = async (userId) => {
  const profile = await RecruiterProfile.findOne({ user: userId });
  if (!profile?.isApproved) throw new AppError('Recruiter approval is required', 403);
  return profile;
};
export { ensureCompanyOperational, ensurePublishable };
