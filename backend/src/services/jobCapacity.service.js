import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

/**
 * Calculates current hired count and remaining openings for a job.
 */
export const getJobCapacity = async (jobId, session = null) => {
  const job = await Job.findById(jobId).session(session ?? null);
  if (!job) throw new AppError('Job not found', 404);

  const hiredCount = await Application.countDocuments({
    job: jobId,
    status: 'hired',
    isArchived: false,
  }).session(session ?? null);

  const remainingOpenings = Math.max(0, job.openings - hiredCount);

  return {
    job,
    openings: job.openings,
    hiredCount,
    remainingOpenings,
    isCapacityReached: hiredCount >= job.openings,
  };
};

/**
 * Asserts that a job has remaining hiring capacity before proceeding.
 */
export const assertHiringCapacity = async (jobId, session = null) => {
  const capacity = await getJobCapacity(jobId, session);
  if (capacity.isCapacityReached) {
    throw new AppError(
      `Job hiring capacity of ${capacity.openings} opening(s) has been reached. No further hires allowed.`,
      409
    );
  }
  return capacity;
};

/**
 * Atomically reserves a hiring slot on the shared Job document using a conditional $inc update.
 * Guarantees race-condition prevention under high concurrency across MongoDB transactions.
 */
export const reserveHiringCapacity = async (jobId, session = null) => {
  const job = await Job.findById(jobId).session(session ?? null);
  if (!job) throw new AppError('Job not found', 404);

  // Sync actual DB hired count with Job document counter
  const actualHiredCount = await Application.countDocuments({
    job: jobId,
    status: 'hired',
    isArchived: false,
  }).session(session ?? null);

  if (actualHiredCount >= job.openings) {
    throw new AppError(
      `Job hiring capacity of ${job.openings} opening(s) has been reached. No further hires allowed.`,
      409
    );
  }

  // Atomic conditional increment on the shared Job document
  const result = await Job.updateOne(
    {
      _id: jobId,
      $expr: { $lt: ['$hiredCount', '$openings'] },
    },
    {
      $inc: { hiredCount: 1 },
    },
    { session: session ?? null }
  );

  if (result.modifiedCount !== 1) {
    throw new AppError(
      `Job hiring capacity of ${job.openings} opening(s) has been reached. No further hires allowed.`,
      409
    );
  }

  return {
    jobId,
    openings: job.openings,
    hiredCount: actualHiredCount + 1,
    remainingOpenings: Math.max(0, job.openings - (actualHiredCount + 1)),
  };
};

/**
 * Atomically releases a hiring slot on the shared Job document when a hire is cancelled.
 */
export const releaseHiringCapacity = async (jobId, session = null) => {
  await Job.updateOne(
    { _id: jobId, hiredCount: { $gt: 0 } },
    { $inc: { hiredCount: -1 } },
    { session: session ?? null }
  );
};

/**
 * Evaluates job hiring capacity and automatically transitions job status (auto-close or auto-reopen)
 * after a candidate is hired or a hire is cancelled.
 */
export const syncJobCapacityAndStatus = async (jobId, actorId, session = null) => {
  const { job, openings, hiredCount, remainingOpenings } = await getJobCapacity(jobId, session);

  // Ensure Job document counter matches authoritative Application count
  if (job.hiredCount !== hiredCount) {
    job.hiredCount = hiredCount;
    await job.save({ session: session ?? null });
  }

  // 1. Auto-close if capacity reached and job is published or paused
  if (hiredCount >= openings && ['published', 'paused'].includes(job.status)) {
    const oldStatus = job.status;
    job.status = 'closed';
    job.closedAt = new Date();
    job.closedReason = 'capacity_reached';
    await job.save({ session: session ?? null });

    const auditData = {
      action: 'job.auto_close',
      actor: actorId,
      company: job.company,
      oldValue: { status: oldStatus },
      newValue: {
        jobId: job._id,
        status: 'closed',
        closedReason: 'capacity_reached',
        hiredCount,
        openings,
        remainingOpenings: 0,
        trigger: 'hiring_capacity_reached',
      },
    };

    if (session) {
      await AuditLog.create([auditData], { session });
    } else {
      await AuditLog.create(auditData);
    }

    await publishOptionalDomainEvent(
      {
        type: DOMAIN_EVENTS.JOB_CLOSED,
        company: String(job.company),
        recipientIds: [String(job.createdBy)],
        payload: {
          companyId: String(job.company),
          jobId: String(job.id),
          jobTitle: job.title,
          reason: 'Hiring capacity reached',
        },
        deduplicationKey: `job.auto-closed:${job.id}:${job.closedAt.toISOString()}`,
      },
      session ? { session } : undefined
    );

    return { job, capacityAction: 'auto_closed' };
  }

  // 2. Auto-reopen if a hire was cancelled, capacity freed up, and job was closed due to capacity_reached
  // (NOTE: Does NOT reopen if recruiter manually closed the job with closedReason === 'manual')
  if (
    hiredCount < openings &&
    job.status === 'closed' &&
    job.closedReason === 'capacity_reached' &&
    job.applicationDeadline &&
    new Date(job.applicationDeadline) > new Date()
  ) {
    const oldStatus = job.status;
    job.status = 'published';
    job.closedAt = null;
    job.closedReason = '';
    await job.save({ session: session ?? null });

    const auditData = {
      action: 'job.reopen',
      actor: actorId,
      company: job.company,
      oldValue: { status: oldStatus },
      newValue: {
        jobId: job._id,
        status: 'published',
        closedReason: '',
        hiredCount,
        openings,
        remainingOpenings,
        trigger: 'hiring_capacity_freed',
      },
    };

    if (session) {
      await AuditLog.create([auditData], { session });
    } else {
      await AuditLog.create(auditData);
    }

    return { job, capacityAction: 'auto_reopened' };
  }

  return { job, capacityAction: 'none' };
};

/**
 * Scans published jobs whose deadlines have elapsed and auto-closes them with audit logging.
 */
export const closeExpiredJobs = async () => {
  const expiredJobs = await Job.find({
    status: { $in: ['published', 'paused'] },
    applicationDeadline: { $lte: new Date() },
  });

  for (const job of expiredJobs) {
    const oldValue = { status: job.status };
    job.status = 'closed';
    job.closedAt = new Date();
    job.closedReason = 'deadline_expired';
    await job.save();

    await AuditLog.create({
      action: 'job.close',
      actor: job.createdBy,
      company: job.company,
      oldValue,
      newValue: {
        jobId: job.id,
        status: 'closed',
        closedReason: 'deadline_expired',
        reason: 'System Expiry (Deadline Passed)',
        systemExpired: true,
        trigger: 'deadline_passed',
      },
    });

    await AuditLog.create({
      action: 'job.auto_close',
      actor: job.createdBy,
      company: job.company,
      oldValue,
      newValue: {
        jobId: job.id,
        status: 'closed',
        closedReason: 'deadline_expired',
        trigger: 'deadline_passed',
      },
    });

    await publishOptionalDomainEvent({
      type: DOMAIN_EVENTS.JOB_CLOSED,
      company: String(job.company),
      recipientIds: [String(job.createdBy)],
      payload: {
        companyId: String(job.company),
        jobId: String(job.id),
        jobTitle: job.title,
        reason: 'Application deadline has passed',
      },
      deduplicationKey: `job.expired:${job.id}:${job.updatedAt.toISOString()}`,
    });
  }

  return expiredJobs.length;
};
