import { Job } from '../models/Job.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AppError } from '../shared/errors/AppError.js';
import { transitionJob } from '../utils/jobStatus.js';
import { buildPagination } from '../utils/pagination.js';
import { ensureCompanyOperational, ensurePublishable } from './job.service.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const findJob = async (id) => { const job = await Job.findById(id).populate('company'); if (!job) throw new AppError('Job not found', 404); return job; };
export const listPendingJobs = async ({ page, limit }) => {
  const filter = { status: 'pending-review' }; const [jobs, total] = await Promise.all([Job.find(filter).populate('company', 'name slug verificationStatus isActive').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit), Job.countDocuments(filter)]);
  return { jobs, pagination: buildPagination(page, limit, total) };
};
export const approveJob = async (id, adminId) => {
  const job = await findJob(id); ensureCompanyOperational(job.company); ensurePublishable(job);
  const profile = await RecruiterProfile.findOne({ user: job.createdBy }); if (!profile?.isApproved) throw new AppError('Creating recruiter is not approved', 403);
  transitionJob(job, 'published'); job.rejectionReason = ''; job.reviewedBy = adminId; job.reviewedAt = new Date(); await job.save(); await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_APPROVED, actor: String(adminId), company: String(job.company.id), recipientIds: [String(job.createdBy)], payload: { companyId: String(job.company.id), companyName: job.company.name, jobId: String(job.id), jobTitle: job.title }, deduplicationKey: `job.approved:${job.id}:${job.reviewedAt.toISOString()}` }); return job;
};
export const rejectJob = async (id, reason, adminId) => { const job = await findJob(id); transitionJob(job, 'rejected'); job.rejectionReason = reason; job.reviewedBy = adminId; job.reviewedAt = new Date(); await job.save(); await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.JOB_REJECTED, actor: String(adminId), company: String(job.company.id), recipientIds: [String(job.createdBy)], payload: { companyId: String(job.company.id), companyName: job.company.name, jobId: String(job.id), jobTitle: job.title, reason: String(reason).slice(0,300) }, deduplicationKey: `job.rejected:${job.id}:${job.reviewedAt.toISOString()}` }); return job; };
export const setJobFeatured = async (id, featured) => { const job = await Job.findById(id); if (!job) throw new AppError('Job not found', 404); if (featured && job.status !== 'published') throw new AppError('Only published jobs can be featured', 409); job.isFeatured = featured; await job.save(); return job; };
