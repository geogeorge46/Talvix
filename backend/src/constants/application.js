export const APPLICATION_STATUSES = Object.freeze([
  'submitted', 'under-review', 'shortlisted', 'assessment-pending',
  'assessment-in-progress', 'assessment-completed', 'interview-scheduled',
  'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted',
  'offer-declined', 'hired', 'rejected', 'withdrawn',
]);
export const APPLICATION_SOURCES = Object.freeze(['talvix', 'referral', 'campus', 'agency', 'manual']);
export const REJECTION_CATEGORIES = Object.freeze([
  'skills-mismatch', 'experience-mismatch', 'education-mismatch',
  'assessment-performance', 'interview-performance', 'position-filled',
  'candidate-unavailable', 'other',
]);
export const MAX_APPLICATION_ASSIGNEES = 10;
