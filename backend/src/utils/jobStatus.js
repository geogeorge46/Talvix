import { AppError } from '../shared/errors/AppError.js';

export const JOB_TRANSITIONS = Object.freeze({
  draft: ['pending-review', 'published'],
  'pending-review': ['published', 'rejected'],
  rejected: ['draft', 'published'],
  published: ['paused', 'closed'],
  paused: ['published', 'closed'],
  closed: ['archived'],
  archived: [],
});

/** Enforces the job state machine and applies lifecycle timestamps. */
export const transitionJob = (job, nextStatus) => {
  if (!JOB_TRANSITIONS[job.status]?.includes(nextStatus)) {
    throw new AppError(`Job cannot transition from ${job.status} to ${nextStatus}`, 409);
  }
  job.status = nextStatus;
  if (nextStatus === 'published') job.publishedAt = new Date();
  if (nextStatus === 'closed') job.closedAt = new Date();
};
