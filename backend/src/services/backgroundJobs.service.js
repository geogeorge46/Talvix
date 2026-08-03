import { BackgroundJob } from '../models/BackgroundJob.js';
import { AuditLog } from '../models/AuditLog.js';
import { Invitation } from '../models/Invitation.js';
import { JoinRequest } from '../models/JoinRequest.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Job } from '../models/Job.js';
import { User } from '../models/User.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';
import { Notification } from '../models/Notification.js';
import { transitionJob } from '../utils/jobStatus.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import mongoose from 'mongoose';

const handleGenerateAuditReport = async (payload) => {
  const { companyId, userId, reportType, format } = payload;
  
  // Simulate heavy CSV/PDF report generation delay
  await new Promise(resolve => setTimeout(resolve, 500));

  await Notification.create({
    recipient: userId,
    recipientRole: 'recruiter',
    company: companyId,
    type: 'system-announcement',
    category: 'system',
    priority: 'high',
    title: 'Report Export Completed',
    message: `Your requested ${reportType || 'Recruitment'} report export is completed in ${format.toUpperCase()} format.`,
    data: {
      reportType,
      format,
      downloadUrl: `/api/v1/analytics/export/download`
    },
    source: 'admin'
  });
};

let intervalId = null;
const instanceId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Queue a background job to be executed asynchronously.
 */
export const queueJob = async ({ type, priority = 'MEDIUM', payload = {}, maxAttempts = 3, runAt = new Date() }) => {
  const weights = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  const priorityWeight = weights[priority] || 2;

  const job = await BackgroundJob.create({
    type,
    priority,
    priorityWeight,
    payload,
    maxAttempts,
    runAt,
  });

  return job;
};

/**
 * Atomically acquire the next ready job based on priority and run time.
 */
export const acquireNextJob = async () => {
  const now = new Date();
  const job = await BackgroundJob.findOneAndUpdate(
    {
      status: 'pending',
      runAt: { $lte: now },
      $or: [
        { lockedAt: null },
        { lockedAt: { $lt: new Date(Date.now() - 300000) } } // Stale lock timeout recovery (5 mins)
      ]
    },
    {
      $set: {
        status: 'processing',
        lockedAt: now,
        lockedBy: instanceId
      },
      $inc: { attempts: 1 }
    },
    {
      sort: { priorityWeight: -1, runAt: 1 },
      new: true
    }
  );
  return job;
};

const handleRetentionCleanup = async () => {
  const auditDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '2555', 10);
  const inviteDays = parseInt(process.env.INVITATION_RETENTION_DAYS || '90', 10);
  const joinDays = parseInt(process.env.JOIN_REQUEST_RETENTION_DAYS || '180', 10);
  const sessionDays = parseInt(process.env.SESSION_RETENTION_DAYS || '90', 10);
  const softDeleteDays = parseInt(process.env.SOFT_DELETE_RETENTION_DAYS || '180', 10);

  const now = Date.now();

  // 1. Audit Logs
  const auditCutoff = new Date(now - auditDays * 24 * 3600 * 1000);
  await AuditLog.deleteMany({ timestamp: { $lt: auditCutoff } });

  // 2. Invitations
  const inviteCutoff = new Date(now - inviteDays * 24 * 3600 * 1000);
  await Invitation.deleteMany({
    status: { $in: ['accepted', 'rejected', 'expired'] },
    updatedAt: { $lt: inviteCutoff }
  });

  // 3. Join Requests
  const joinCutoff = new Date(now - joinDays * 24 * 3600 * 1000);
  await JoinRequest.deleteMany({
    status: { $in: ['approved', 'rejected', 'expired'] },
    updatedAt: { $lt: joinCutoff }
  });

  // 4. Expired Refresh Sessions
  const sessionCutoff = new Date(now - sessionDays * 24 * 3600 * 1000);
  await RefreshSession.deleteMany({
    $or: [
      { isActive: false },
      { expiresAt: { $lt: new Date() } }
    ],
    updatedAt: { $lt: sessionCutoff }
  });

  // 5. Soft Deleted Inactive Companies
  const companyCutoff = new Date(now - softDeleteDays * 24 * 3600 * 1000);
  const inactiveCompanies = await Company.find({ isActive: false, updatedAt: { $lt: companyCutoff } });
  const inactiveIds = inactiveCompanies.map(c => c._id);
  if (inactiveIds.length > 0) {
    await Company.deleteMany({ _id: { $in: inactiveIds } });
    await CompanyMember.deleteMany({ company: { $in: inactiveIds } });
  }

  // 6. Soft Deleted / Closed / Archived Jobs
  const jobCutoff = new Date(now - softDeleteDays * 24 * 3600 * 1000);
  await Job.deleteMany({
    status: { $in: ['closed', 'rejected', 'archived'] },
    updatedAt: { $lt: jobCutoff }
  });
};

const handleExpireInvitation = async () => {
  await Invitation.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
};

const handleExpireJoinRequest = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  await JoinRequest.updateMany(
    { status: 'pending', createdAt: { $lt: thirtyDaysAgo } },
    { $set: { status: 'rejected', notes: 'Expired automatically' } }
  );
};

const handleRevokeSession = async (payload) => {
  if (payload.userId) {
    await revokeUserSessions(payload.userId);
  }
};

const handleExpireJobs = async () => {
  const now = new Date();
  const expiredJobs = await Job.find({
    status: { $in: ['published', 'paused'] },
    applicationDeadline: { $lte: now }
  });

  for (const job of expiredJobs) {
    const oldValue = { status: job.status };
    transitionJob(job, 'closed');
    await job.save();

    await AuditLog.create({
      action: 'job.close',
      actor: job.createdBy,
      company: job.company,
      oldValue,
      newValue: { status: 'closed', reason: 'System Expiry (Deadline Passed)', systemExpired: true }
    });

    await publishOptionalDomainEvent({
      type: DOMAIN_EVENTS.JOB_CLOSED,
      company: String(job.company),
      recipientIds: [String(job.createdBy)],
      payload: {
        companyId: String(job.company),
        jobId: String(job.id),
        jobTitle: job.title,
        reason: 'Application deadline has passed'
      },
      deduplicationKey: `job.expired:${job.id}:${job.updatedAt.toISOString()}`
    });
  }
};

const handlePublishJobs = async () => {
  const now = new Date();
  const pendingJobs = await Job.find({
    status: 'draft',
    scheduledPublishAt: { $exists: true, $ne: null, $lte: now }
  }).populate('company');

  for (const job of pendingJobs) {
    const company = job.company;
    const oldValue = { status: job.status };

    if (company && company.autoApproveJobs) {
      transitionJob(job, 'published');
      job.scheduledPublishAt = null;
      await job.save();

      await AuditLog.create({
        action: 'job.approve',
        actor: job.createdBy,
        company: company._id,
        oldValue,
        newValue: { status: job.status, autoApproved: true, scheduledPublish: true }
      });

      await publishOptionalDomainEvent({
        type: DOMAIN_EVENTS.JOB_APPROVED,
        actor: String(job.createdBy),
        company: String(company._id),
        recipientIds: [String(job.createdBy)],
        payload: {
          companyId: String(company._id),
          companyName: company.name,
          jobId: String(job.id),
          jobTitle: job.title,
          autoApproved: true,
          scheduledPublish: true
        },
        deduplicationKey: `job.approved:${job.id}:${job.publishedAt.toISOString()}`
      });
    } else {
      transitionJob(job, 'pending-review');
      job.scheduledPublishAt = null;
      await job.save();

      await AuditLog.create({
        action: 'job.submit',
        actor: job.createdBy,
        company: company._id,
        oldValue,
        newValue: { status: job.status, scheduledPublish: true }
      });

      const admins = await User.find({ role: 'admin' });
      const adminIds = admins.map(u => String(u._id));
      if (adminIds.length) {
        await publishOptionalDomainEvent({
          type: DOMAIN_EVENTS.JOB_SUBMITTED,
          company: String(company._id),
          recipientIds: adminIds,
          payload: {
            companyId: String(company._id),
            companyName: company.name,
            jobId: String(job.id),
            jobTitle: job.title,
            actionUrl: `/admin/jobs/${job.id}`,
            scheduledPublish: true
          },
          deduplicationKey: `job.submitted:${job.id}:${job.updatedAt.toISOString()}`
        });
      }
    }
  }
};

/**
 * Execute a background job.
 */
export const executeJob = async (job) => {
  try {
    switch (job.type) {
      case 'RETENTION_CLEANUP':
        await handleRetentionCleanup();
        break;
      case 'EXPIRE_JOBS':
        await handleExpireJobs();
        break;
      case 'PUBLISH_JOBS':
        await handlePublishJobs();
        break;
      case 'EXPIRE_INVITATION':
        await handleExpireInvitation();
        break;
      case 'EXPIRE_JOIN_REQUEST':
        await handleExpireJoinRequest();
        break;
      case 'REVOKE_SESSION':
        await handleRevokeSession(job.payload);
        break;
      case 'SEND_EMAIL':
        // Placeholder for optional email delivery
        break;
      case 'GENERATE_AUDIT_REPORT':
        await handleGenerateAuditReport(job.payload);
        break;
      default:
        throw new Error(`Unsupported job type: ${job.type}`);
    }

    job.status = 'completed';
    job.processedAt = new Date();
    job.lockedAt = null;
    job.lockedBy = null;
    await job.save();
  } catch (err) {
    job.lastError = err.message;
    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.failedAt = new Date();
    } else {
      job.status = 'pending';
      const backoffMs = Math.pow(2, job.attempts) * 1000; // Exponential backoff: 2s, 4s, 8s
      job.runAt = new Date(Date.now() + backoffMs);
    }
    job.lockedAt = null;
    job.lockedBy = null;
    await job.save();
    throw err;
  }
};

/**
 * Process all eligible background jobs.
 */
export const processNextJobs = async () => {
  let job;
  while ((job = await acquireNextJob())) {
    try {
      await executeJob(job);
    } catch (err) {
      // Main polling loop proceeds even if individual job execution fails
    }
  }
};

/**
 * Start the polling loop of background worker.
 */
export const startBackgroundWorker = () => {
  if (intervalId) return;
  const intervalMs = parseInt(process.env.BACKGROUND_WORKER_INTERVAL || '60000', 10);
  intervalId = setInterval(async () => {
    try {
      await processNextJobs();
    } catch (err) {
      // Suppress loop error
    }
  }, intervalMs);
};

/**
 * Gracefully stop background worker.
 */
export const stopBackgroundWorker = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
};
