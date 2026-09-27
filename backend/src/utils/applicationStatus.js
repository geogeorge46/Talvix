import { APPLICATION_STATUSES } from '../constants/application.js';
import { AppError } from '../shared/errors/AppError.js';
import { Offer } from '../models/Offer.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';

export const TERMINAL_APPLICATION_STATUSES = Object.freeze(['hired', 'rejected', 'withdrawn']);
export const RECRUITER_APPLICATION_TRANSITIONS = Object.freeze({
  submitted: ['under-review', 'shortlisted', 'rejected'],
  'under-review': ['shortlisted', 'rejected'],
  shortlisted: ['assessment-pending', 'interview-scheduled', 'interview-completed', 'offer-pending', 'offer-sent', 'rejected'],
  'assessment-pending': ['assessment-in-progress', 'rejected'],
  'assessment-in-progress': ['assessment-completed'],
  'assessment-completed': ['shortlisted', 'interview-scheduled', 'interview-completed', 'offer-pending', 'offer-sent', 'rejected'],
  'interview-scheduled': ['interview-completed', 'offer-pending', 'offer-sent', 'rejected'],
  'interview-completed': ['offer-pending', 'offer-sent', 'rejected'],
  'offer-pending': ['offer-sent', 'rejected'],
  'offer-sent': ['offer-accepted', 'offer-declined', 'hired', 'rejected'],
  'offer-accepted': ['hired'],
  'offer-declined': ['shortlisted', 'rejected']
});
export const CANDIDATE_WITHDRAWABLE_STATUSES = Object.freeze(['submitted', 'under-review', 'shortlisted', 'assessment-pending', 'interview-scheduled']);

/** Applies an actor-authorized transition and appends immutable history. */
export const changeApplicationStatus = (application, nextStatus, actorId, reason = '', options = {}) => {
  if (!APPLICATION_STATUSES.includes(nextStatus)) throw new AppError('Invalid application status', 400);
  if (!options.adminOverride && !RECRUITER_APPLICATION_TRANSITIONS[application.status]?.includes(nextStatus)) throw new AppError(`Application cannot transition from ${application.status} to ${nextStatus}`, 409);
  const from = application.status; application.status = nextStatus; application.lastStatusChangedAt = new Date();
  application.statusHistory.push({ from, to: nextStatus, changedBy: actorId, reason, adminOverride: Boolean(options.adminOverride) });
  if (nextStatus === 'rejected') application.rejection = { reason, category: options.rejectionCategory ?? 'other', rejectedBy: actorId, rejectedAt: new Date() };
};

export const syncApplicationStatus = async (application) => {
  if (!application || TERMINAL_APPLICATION_STATUSES.includes(application.status)) {
    return application;
  }

  try {
    const activeOffer = await Offer.findOne({
      application: application._id || application.id,
      isArchived: false,
      status: { $in: ['draft', 'pending-approval', 'approved', 'sent', 'viewed', 'negotiation-requested', 'revised', 'accepted', 'onboarding-started', 'completed'] }
    }).sort({ revision: -1 }).lean();

    if (activeOffer) {
      let targetStatus = null;
      if (['sent', 'viewed', 'negotiation-requested', 'revised'].includes(activeOffer.status)) {
        targetStatus = 'offer-sent';
      } else if (['accepted', 'onboarding-started', 'completed'].includes(activeOffer.status)) {
        targetStatus = 'offer-accepted';
      } else if (['draft', 'pending-approval', 'approved'].includes(activeOffer.status)) {
        targetStatus = 'offer-pending';
      }

      if (targetStatus && application.status !== targetStatus) {
        changeApplicationStatus(application, targetStatus, activeOffer.createdBy || application.candidate, `Auto-synced status from active offer (${activeOffer.status})`, { adminOverride: true });
        await application.save();
        return application;
      }
    }

    const activeInterview = await InterviewSchedule.findOne({
      application: application._id || application.id,
      status: { $in: ['confirmed', 'rescheduled', 'completed'] }
    }).lean();

    if (activeInterview && ['submitted', 'under-review', 'shortlisted', 'assessment-completed'].includes(application.status)) {
      const targetStatus = activeInterview.status === 'completed' ? 'interview-completed' : 'interview-scheduled';
      changeApplicationStatus(application, targetStatus, activeInterview.scheduledBy || application.candidate, `Auto-synced status from interview (${activeInterview.status})`, { adminOverride: true });
      await application.save();
      return application;
    }
  } catch (err) {
    console.error('Error auto-syncing application status:', err);
  }

  return application;
};

