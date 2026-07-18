export const RECRUITER_PERMISSIONS = Object.freeze([
  'company.manage', 'jobs.create', 'jobs.update', 'jobs.delete', 'jobs.publish',
  'applications.view', 'applications.manage', 'assessments.view', 'assessments.manage', 'assessments.assign', 'assessments.review',
  'interviews.view', 'interviews.manage', 'interviews.schedule', 'interviews.evaluate',
  'offers.view', 'offers.manage', 'offers.approve', 'offers.send', 'team.manage',
  'documents.view', 'documents.manage', 'documents.verify',
]);

export const OWNER_PERMISSIONS = RECRUITER_PERMISSIONS;
