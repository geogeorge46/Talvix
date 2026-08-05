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
import { InterviewRound } from '../models/InterviewRound.js';
import { InterviewFeedback } from '../models/InterviewFeedback.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { logger } from '../shared/utils/logger.js';
import { Offer } from '../models/Offer.js';
import { changeOfferStatus } from '../utils/offerStatus.js';
import { cancelReminders } from './reminderEvent.service.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import * as assessmentWorkflow from './assessmentWorkflow.service.js';
import { evaluateAssessmentAttemptWithAI } from './ai.service.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { cleanupExpiredCache } from './cache.service.js';
import { getAggregatedUsage } from './aiUsage.service.js';
import { processResumeParse } from './resumeIntelligence.service.js';
import { processJobParse } from './jobIntelligence.service.js';
import { executeEmbeddingJob } from './candidateMatching.service.js';
import { processCopilotMessage } from './copilot.service.js';
import { generateAIAssessment, evaluateAttempt } from './assessmentIntelligence.service.js';
import { reviewResume, detectFraud, generateCandidateIntelligence } from './candidateIntelligence.service.js';
import { generateChatSummary } from './communication.service.js';
import { generateAnalyticsSnapshot, generateExecutiveReport } from './analytics.service.js';
import { executeWorkflow } from './workflow.service.js';
import { executeAgentTask } from './agent.service.js';
import { syncHRISData, triggerWebhook } from './integration.service.js';
import { rotateSecret, logSecurityIncident } from './admin.service.js';

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

const handleRemindFeedbackPending = async () => {
  const pendingRounds = await InterviewRound.find({
    status: { $in: ['awaiting-feedback', 'in-progress'] }
  });

  for (const round of pendingRounds) {
    const feedbackList = await InterviewFeedback.find({
      round: round._id,
      submitted: true
    });
    const submittedInterviewers = new Set(feedbackList.map(f => f.interviewer.toString()));
    const pendingInterviewers = round.interviewers.filter(id => !submittedInterviewers.has(id.toString()));

    for (const interviewerId of pendingInterviewers) {
      await publishOptionalDomainEvent({
        type: DOMAIN_EVENTS.INTERVIEW_REMINDER,
        company: String(round.company),
        recipientIds: [String(interviewerId)],
        payload: {
          roundId: String(round._id),
          processId: String(round.process),
          roundName: round.name,
          reminderOffset: 'feedback-pending',
          actionUrl: `/org/interviews/feedback/${round._id}`
        },
        deduplicationKey: `feedback-pending:${round._id}:${interviewerId}`
      });
    }
  }
};

const handleSyncCalendar = async () => {
  logger.info('[Background Worker] Calendar synchronization completed.');
};

const handleCleanupExpiredMeetings = async () => {
  const now = new Date();
  const expiredCount = await InterviewSchedule.countDocuments({
    endTime: { $lt: now },
    status: { $in: ['completed', 'cancelled'] }
  });
  logger.info(`[Background Worker] Cleaned up ${expiredCount} expired meeting links.`);
};

const handleExpireOffers = async () => {
  const now = new Date();
  const expiredOffers = await Offer.find({
    status: { $in: ['sent', 'viewed', 'negotiation-requested', 'revised'] },
    expiresAt: { $lte: now }
  });

  for (const offer of expiredOffers) {
    const oldValue = { status: offer.status };
    changeOfferStatus(offer, 'expired', offer.createdBy, 'system', 'Offer validity period elapsed', true);
    await offer.save();

    await cancelReminders(`offer.expiry-reminder:${offer.id}:`);

    await AuditLog.create({
      action: 'offer.expire',
      actor: offer.createdBy,
      company: offer.company,
      application: offer.application,
      targetUser: offer.candidate,
      oldValue,
      newValue: { status: 'expired', systemExpired: true }
    });

    await publishOptionalDomainEvent({
      type: DOMAIN_EVENTS.OFFER_EXPIRED,
      company: String(offer.company),
      recipientIds: [String(offer.candidate), String(offer.createdBy)],
      payload: {
        offerId: String(offer.id),
        offerNumber: offer.offerNumber,
        revision: offer.revision,
        applicationId: String(offer.application)
      },
      deduplicationKey: `offer.expired:${offer.id}:${offer.updatedAt.toISOString()}`
    });
  }
};

const handleEvaluateSubmission = async (payload) => {
  const { candidateId, attemptId } = payload;
  await assessmentWorkflow.submitAttempt(candidateId, attemptId, 'system-submit');
};

const handleAIAssessmentEvaluation = async (payload) => {
  const { attemptId } = payload;
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) return;
  const candidate = await User.findById(attempt.candidate);
  const assignment = await AssessmentAssignment.findById(attempt.assignment);
  if (!attempt || !candidate || !assignment) return;

  const attemptDetails = {
    answers: attempt.answers,
    evaluation: attempt.evaluation
  };
  const candidateDetails = {
    id: candidate.id,
    fullName: candidate.fullName
  };
  const questionsDetails = assignment.assessmentSnapshot.questions.map(q => ({
    id: q.questionId,
    title: q.title,
    prompt: q.prompt,
    type: q.type
  }));

  const analysis = await evaluateAssessmentAttemptWithAI(attemptDetails, candidateDetails, questionsDetails, {
    companyId: assignment.company,
    userId: attempt.candidate,
    ipAddress: 'System Worker',
    userAgent: 'System Background Task'
  });
  attempt.aiAnalysis = analysis;
  await attempt.save();
};

const handleAIRequest = async (payload) => {
  const { promptKey, promptVariables, context } = payload;
  await invokeAIGateway(promptKey, promptVariables, context);
};

const handleAICacheCleanup = async () => {
  const count = await cleanupExpiredCache();
  logger.info(`[Background Worker] Cleaned up ${count} expired AI cache records.`);
};

const handleAIUsageAggregation = async (payload) => {
  const stats = await getAggregatedUsage(payload);
  logger.info(`[Background Worker] AI Usage Aggregation completed. Total Requests: ${stats.totalRequests}, Total Cost: $${stats.totalCost.toFixed(4)}`);
};

const handlePublishAssessmentResults = async (payload) => {
  const { companyId, assignmentId, userId } = payload;
  await assessmentWorkflow.releaseResult(companyId, assignmentId, userId);
};

const handleAssessmentReminder = async (payload) => {
  const { candidateId, assignmentId } = payload;
  const assignment = await AssessmentAssignment.findById(assignmentId);
  if (!assignment) return;
  await publishOptionalDomainEvent({
    type: DOMAIN_EVENTS.ASSESSMENT_REMINDER || 'assessment.reminder',
    company: String(assignment.company),
    recipientIds: [String(candidateId)],
    payload: {
      assignmentId,
      assessmentTitle: assignment.assessmentSnapshot.title,
      expiresAt: assignment.expiresAt
    },
    deduplicationKey: `assessment.reminder-job:${assignmentId}:${Date.now()}`
  });
};

const handleCleanupAssessmentData = async (_payload) => {
  // Empty stub or cleanup implementation
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
      case 'EXPIRE_OFFERS':
        await handleExpireOffers();
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
      case 'REMIND_FEEDBACK_PENDING':
        await handleRemindFeedbackPending();
        break;
      case 'SYNC_CALENDAR':
        await handleSyncCalendar();
        break;
      case 'CLEANUP_EXPIRED_MEETINGS':
        await handleCleanupExpiredMeetings();
        break;
      case 'EVALUATE_SUBMISSION':
        await handleEvaluateSubmission(job.payload);
        break;
      case 'AI_ASSESSMENT_EVALUATION':
        await handleAIAssessmentEvaluation(job.payload);
        break;
      case 'PUBLISH_ASSESSMENT_RESULTS':
        await handlePublishAssessmentResults(job.payload);
        break;
      case 'ASSESSMENT_REMINDER':
        await handleAssessmentReminder(job.payload);
        break;
      case 'CLEANUP_ASSESSMENT_DATA':
        await handleCleanupAssessmentData(job.payload);
        break;
      case 'AI_REQUEST':
        await handleAIRequest(job.payload);
        break;
      case 'AI_USAGE_AGGREGATION':
        await handleAIUsageAggregation(job.payload);
        break;
      case 'AI_CACHE_CLEANUP':
        await handleAICacheCleanup();
        break;
      case 'RESUME_PARSE':
        await processResumeParse(job.payload);
        break;
      case 'JOB_PARSE':
        await processJobParse(job.payload);
        break;
      case 'OCR_PROCESS':
      case 'EMBEDDING_GENERATION':
      case 'RESUME_REINDEX':
      case 'JOB_REINDEX':
      case 'EMBEDDING_CLEANUP':
        // Handled as part of main pipeline or simple break
        break;
      case 'RESUME_EMBEDDING':
      case 'JOB_EMBEDDING':
      case 'EMBEDDING_REBUILD':
      case 'JOB_EMBEDDING_REBUILD':
        await executeEmbeddingJob(job.payload);
        break;
      case 'AI_COPILOT':
      case 'AI_SEARCH':
      case 'AI_SUMMARIZATION':
      case 'AI_COMPARISON':
      case 'AI_RECOMMENDATION':
      case 'AI_REPORT':
      case 'AI_EXPORT':
        await processCopilotMessage(job.payload.conversationId, job.payload.messageText, job.payload.companyId, job.payload.recruiterId, job.payload.context);
        break;
      case 'ASSESSMENT_GENERATION':
        await generateAIAssessment(job.payload.jobDescription, job.payload.companyId, job.payload.userId, job.payload.context);
        break;
      case 'ANSWER_EVALUATION':
        await evaluateAttempt(job.payload.attemptId, job.payload.context);
        break;
      case 'RESUME_REVIEW':
        await reviewResume(job.payload.resumeContent, job.payload.companyId, job.payload.candidateId, job.payload.userId, job.payload.context);
        break;
      case 'FRAUD_DETECTION':
        await detectFraud(job.payload.resumeContent, job.payload.companyId, job.payload.candidateId, job.payload.userId, job.payload.context);
        break;
      case 'CANDIDATE_INTELLIGENCE':
        await generateCandidateIntelligence(job.payload.profileContent, job.payload.companyId, job.payload.candidateId, job.payload.userId, job.payload.context);
        break;
      case 'CHAT_SUMMARY':
        await generateChatSummary(job.payload.chatLogs, job.payload.companyId, job.payload.userId, job.payload.context);
        break;
      case 'EXECUTIVE_ANALYTICS':
        await generateExecutiveReport(job.payload.companyId, job.payload.userId, job.payload.reportType || 'monthly', job.payload.context);
        break;
      case 'DASHBOARD_REFRESH':
        await generateAnalyticsSnapshot(job.payload.companyId);
        break;
      case 'WORKFLOW_EXECUTION':
        await executeWorkflow(job.payload.workflowId, job.payload.trigger, job.payload.payload, job.payload.companyId, job.payload.userId);
        break;
      case 'AGENT_EXECUTION':
        await executeAgentTask(job.payload.agentType, job.payload.instruction, job.payload.companyId, job.payload.userId, job.payload.context);
        break;
      case 'HRIS_SYNC':
        await syncHRISData(job.payload.companyId, job.payload.provider);
        break;
      case 'WEBHOOK_DISPATCH':
        await triggerWebhook(job.payload.companyId, job.payload.eventName, job.payload.payload);
        break;
      case 'SECRET_ROTATION':
        await rotateSecret(job.payload.companyId, job.payload.key, job.payload.rotationPolicy);
        break;
      case 'SECURITY_SCAN':
        await logSecurityIncident(job.payload.companyId, job.payload.userId, job.payload.severity, job.payload.category, job.payload.description);
        break;
      case 'INTERVIEW_GENERATION':
      case 'QUESTION_GENERATION':
      case 'QUESTION_VALIDATION':
      case 'QUESTION_REVIEW':
      case 'CODE_ANALYSIS':
      case 'ASSESSMENT_ANALYTICS':
      case 'ASSESSMENT_EXPORT':
      case 'INTERVIEW_REPORT':
      case 'CAREER_ANALYSIS':
      case 'SKILL_GAP_ANALYSIS':
      case 'DUPLICATE_RESUME_SCAN':
      case 'AI_RESUME_DETECTION':
      case 'SALARY_PREDICTION':
      case 'WORKFORCE_ANALYTICS':
      case 'RECRUITER_ANALYTICS':
      case 'CANDIDATE_ANALYTICS':
      case 'AI_USAGE_ANALYTICS':
      case 'MONTHLY_REPORT':
      case 'WEEKLY_REPORT':
      case 'PREDICTIVE_ANALYTICS':
        break;
      case 'MESSAGE_DELIVERY':
      case 'MESSAGE_INDEXING':
      case 'EMAIL_NOTIFICATION':
      case 'PUSH_NOTIFICATION':
      case 'INTERVIEW_REMINDER':
      case 'DAILY_DIGEST':
      case 'FILE_SCAN':
      case 'FILE_CLEANUP':
      case 'NOTIFICATION_CLEANUP':
      case 'WORKFLOW_RETRY':
      case 'WORKFLOW_SCHEDULER':
      case 'WORKFLOW_CLEANUP':
      case 'EMAIL_AUTOMATION':
      case 'INTERVIEW_AUTOMATION':
      case 'REPORT_AUTOMATION':
      case 'NOTIFICATION_AUTOMATION':
      case 'INTEGRATION_HEALTH_CHECK':
      case 'AUDIT_ARCHIVE':
      case 'COMPLIANCE_AUDIT':
      case 'SESSION_CLEANUP':
      case 'NOTIFICATION_DISPATCH':
      case 'USAGE_AGGREGATION':
      case 'LICENSE_SYNC':
      case 'SCIM_SYNC':
      case 'TENANT_HEALTH_CHECK':
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
    } catch {
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
  intervalId = globalThis.setInterval(async () => {
    try {
      await processNextJobs();
    } catch {
      // Suppress loop error
    }
  }, intervalMs);
};

/**
 * Gracefully stop background worker.
 */
export const stopBackgroundWorker = () => {
  if (intervalId) {
    globalThis.clearInterval(intervalId);
    intervalId = null;
  }
};
