const catalogue = {
  ACCOUNT: ['account.registered', 'account.password-changed', 'account.security-alert'],
  RECRUITER: ['recruiter.approved', 'recruiter.rejected', 'recruiter.suspended'],
  COMPANY: ['company.created', 'company.verified', 'company.rejected', 'company.suspended', 'company.team-member-added', 'company.team-permissions-updated', 'company.team-member-removed'],
  JOB: ['job.submitted', 'job.approved', 'job.rejected', 'job.published', 'job.paused', 'job.closed'],
  APPLICATION: ['application.submitted', 'application.under-review', 'application.shortlisted', 'application.rejected', 'application.withdrawn', 'application.hired'],
  ASSESSMENT: ['assessment.assigned', 'assessment.started', 'assessment.submitted', 'assessment.review-required', 'assessment.completed', 'assessment.result-released', 'assessment.expired', 'assessment.reminder'],
  INTERVIEW: ['interview.scheduled', 'interview.candidate-accepted', 'interview.reschedule-requested', 'interview.rescheduled', 'interview.cancelled', 'interview.no-show', 'interview.feedback-released', 'interview.completed', 'interview.reminder'],
  OFFER: ['offer.approval-requested', 'offer.approved', 'offer.rejected', 'offer.sent', 'offer.viewed', 'offer.negotiation-requested', 'offer.revised', 'offer.accepted', 'offer.declined', 'offer.withdrawn', 'offer.expired', 'offer.hire-confirmed', 'offer.expiry-reminder'],
  DOCUMENT: ['document.verification-requested', 'document.verified', 'document.rejected', 'document.quarantined'],
};

export const DOMAIN_EVENTS = Object.freeze(Object.fromEntries(Object.values(catalogue).flatMap((events) => events.map((event) => [event.toUpperCase().replace(/[.-]/g, '_'), event]))));
export const DOMAIN_EVENT_NAMES = Object.freeze(Object.values(DOMAIN_EVENTS));
