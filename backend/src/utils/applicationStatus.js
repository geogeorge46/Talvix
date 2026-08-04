import { APPLICATION_STATUSES } from '../constants/application.js';
import { AppError } from '../shared/errors/AppError.js';

export const TERMINAL_APPLICATION_STATUSES = Object.freeze(['hired', 'rejected', 'withdrawn']);
export const RECRUITER_APPLICATION_TRANSITIONS = Object.freeze({ submitted: ['under-review', 'rejected'], 'under-review': ['shortlisted', 'rejected'], shortlisted: ['assessment-pending', 'interview-scheduled', 'rejected'], 'assessment-pending': ['assessment-in-progress', 'rejected'], 'assessment-in-progress': ['assessment-completed'], 'assessment-completed': ['shortlisted', 'interview-scheduled', 'rejected'], 'interview-scheduled': ['interview-completed', 'rejected'], 'interview-completed': ['offer-pending', 'rejected'], 'offer-pending': ['offer-sent', 'rejected'], 'offer-sent': ['offer-accepted', 'offer-declined'], 'offer-accepted': ['hired'], 'offer-declined': ['shortlisted', 'rejected'] });
export const CANDIDATE_WITHDRAWABLE_STATUSES = Object.freeze(['submitted', 'under-review', 'shortlisted', 'assessment-pending', 'interview-scheduled']);

/** Applies an actor-authorized transition and appends immutable history. */
export const changeApplicationStatus = (application, nextStatus, actorId, reason = '', options = {}) => {
  if (!APPLICATION_STATUSES.includes(nextStatus)) throw new AppError('Invalid application status', 400);
  if (!options.adminOverride && !RECRUITER_APPLICATION_TRANSITIONS[application.status]?.includes(nextStatus)) throw new AppError(`Application cannot transition from ${application.status} to ${nextStatus}`, 409);
  const from = application.status; application.status = nextStatus; application.lastStatusChangedAt = new Date();
  application.statusHistory.push({ from, to: nextStatus, changedBy: actorId, reason, adminOverride: Boolean(options.adminOverride) });
  if (nextStatus === 'rejected') application.rejection = { reason, category: options.rejectionCategory ?? 'other', rejectedBy: actorId, rejectedAt: new Date() };
};
