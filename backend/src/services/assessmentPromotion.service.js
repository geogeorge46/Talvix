import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const supportsTransactions = () => ['ReplicaSetWithPrimary', 'Sharded'].includes(mongoose.connection.client?.topology?.description?.type);

export const promoteCohortCandidates = async (company, actor, assessmentId, input) => {
  const assessment = await Assessment.findOne({ _id: assessmentId, company });
  if (!assessment) throw new AppError('Assessment not found', 404);

  const { applicationIds, targetStage, reason, allowProvisional = false } = input;

  // Retrieve matching applications for this company
  const applications = await Application.find({
    _id: { $in: applicationIds },
    company,
  }).populate('candidate', 'fullName email');

  const appMap = new Map(applications.map((app) => [app._id.toString(), app]));

  // Retrieve matching assignments with attempts to check provisional status
  const assignments = await AssessmentAssignment.find({
    assessment: assessment._id,
    application: { $in: applicationIds },
    company,
  }).populate('latestAttempt').populate('bestAttempt');

  const assignMap = new Map(assignments.map((a) => [a.application.toString(), a]));

  const details = [];
  let promotedCount = 0;
  let alreadyInStageCount = 0;
  let failedCount = 0;

  for (const appId of applicationIds) {
    const appStr = appId.toString();
    const app = appMap.get(appStr);
    const assign = assignMap.get(appStr);

    if (!app) {
      failedCount += 1;
      details.push({
        applicationId: appId,
        status: 'failed',
        reason: 'Application not found for this company',
      });
      continue;
    }

    if (!assign) {
      failedCount += 1;
      details.push({
        applicationId: appId,
        candidateName: app.candidate?.fullName,
        status: 'failed',
        reason: 'Candidate is not assigned to this assessment',
      });
      continue;
    }

    // Check if candidate evaluation is still provisional
    const attempt = assign.bestAttempt || assign.latestAttempt;
    const isProvisional = attempt && (
      attempt.status === 'review-pending' ||
      attempt.questionResults?.some((qr) => qr.requiresManualReview)
    );

    if (isProvisional && !allowProvisional) {
      failedCount += 1;
      details.push({
        applicationId: appId,
        candidateName: app.candidate?.fullName,
        candidateEmail: app.candidate?.email,
        status: 'failed',
        reason: 'Candidate evaluation is provisional (manual review pending). Set allowProvisional to promote.',
      });
      continue;
    }

    // Idempotency: if already in target stage
    if (app.status === targetStage) {
      alreadyInStageCount += 1;
      details.push({
        applicationId: appId,
        candidateName: app.candidate?.fullName,
        candidateEmail: app.candidate?.email,
        status: 'already-in-stage',
        previousStage: app.status,
        currentStage: app.status,
      });
      continue;
    }

    // Apply atomic stage transition and assignment audit sync
    const prevStage = app.status;
    const actionAudit = {
      action: 'promoted',
      reason: `${prevStage} -> ${targetStage}: ${reason}`,
      actor,
      at: new Date(),
    };

    const updateApplicationAndAssignment = async (session) => {
      changeApplicationStatus(app, targetStage, actor, reason, { adminOverride: false });
      await app.save({ session });
      assign.audit.push(actionAudit);
      await assign.save({ session });
    };

    try {
      if (supportsTransactions()) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            await updateApplicationAndAssignment(session);
          });
        } finally {
          await session.endSession();
        }
      } else {
        await updateApplicationAndAssignment();
      }

      // Stable deterministic deduplication key for outbox domain event
      if (targetStage === 'shortlisted') {
        await publishOptionalDomainEvent({
          type: DOMAIN_EVENTS.APPLICATION_SHORTLISTED,
          actor: String(actor),
          company: String(company),
          recipientIds: [String(app.candidate?._id || app.candidate)],
          payload: {
            applicationId: String(app._id),
            jobId: String(app.job),
            status: targetStage,
            reason,
          },
          deduplicationKey: `application.shortlisted:${app._id}:${prevStage}`,
        });
      }

      promotedCount += 1;
      details.push({
        applicationId: appId,
        candidateName: app.candidate?.fullName,
        candidateEmail: app.candidate?.email,
        status: 'promoted',
        previousStage: prevStage,
        currentStage: targetStage,
      });
    } catch (err) {
      failedCount += 1;
      details.push({
        applicationId: appId,
        candidateName: app.candidate?.fullName,
        candidateEmail: app.candidate?.email,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'Stage transition failed',
      });
    }
  }

  return {
    summary: {
      requested: applicationIds.length,
      promoted: promotedCount,
      alreadyInStage: alreadyInStageCount,
      failed: failedCount,
      targetStage,
      note: targetStage === 'interview-scheduled'
        ? 'Application stages updated to interview-scheduled. Meeting date, interviewer, and calendar events must be scheduled separately via the Interview module.'
        : undefined,
    },
    details,
  };
};
