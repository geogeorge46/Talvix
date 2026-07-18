export const USER_ROLES = Object.freeze({
  CANDIDATE: 'candidate',
  RECRUITER: 'recruiter',
  ADMIN: 'admin',
});

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLES));
export const PUBLIC_REGISTRATION_ROLES = Object.freeze([
  USER_ROLES.CANDIDATE,
  USER_ROLES.RECRUITER,
]);
