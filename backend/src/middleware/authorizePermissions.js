import { USER_ROLES } from '../constants/roles.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AppError } from '../shared/errors/AppError.js';

/** Enforces persisted recruiter approval, membership, and permissions. */
export const authorizePermissions = (...requiredPermissions) => async (request, _response, next) => {
  try {
    if (request.user.role === USER_ROLES.ADMIN) return next();
    const profile = await RecruiterProfile.findOne({ user: request.user.id });
    if (!profile || !profile.isApproved || !profile.company) {
      throw new AppError('Approved recruiter company access is required', 403);
    }
    const company = await Company.findOne({ _id: profile.company, isActive: true });
    const membership = company?.teamMembers.find((member) => member.recruiter.equals(request.user.id) && member.status === 'active');
    const hasPermissions = requiredPermissions.every((permission) =>
      profile.permissions.includes(permission) && membership?.permissions.includes(permission));
    const requiresVerifiedCompany = requiredPermissions.some((permission) => permission.startsWith('applications.') || permission.startsWith('assessments.') || permission.startsWith('interviews.') || permission.startsWith('offers.') || permission.startsWith('documents.'));
    if (!membership || !hasPermissions || (requiresVerifiedCompany && company.verificationStatus !== 'verified')) {
      throw new AppError('You do not have the required company permission', 403);
    }
    request.recruiterProfile = profile;
    request.company = company;
    request.companyMember = membership;
    return next();
  } catch (error) {
    return next(error);
  }
};
