import { USER_ROLES } from '../constants/roles.js';
import { OWNER_PERMISSIONS } from '../constants/permissions.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { AppError } from '../shared/errors/AppError.js';

/** Enforces persisted recruiter approval, membership, and permissions. */
export const authorizePermissions = (...requiredPermissions) => async (request, _response, next) => {
  try {
    if (request.user.role === USER_ROLES.ADMIN) return next();
    
    const profile = await RecruiterProfile.findOne({ user: request.user.id });
    const isManagingOwnCompany = requiredPermissions.includes('company.manage') && profile?.company;

    if (!profile || (!profile.isApproved && !isManagingOwnCompany) || !profile.company) {
      throw new AppError('Approved recruiter company access is required', 403);
    }
    
    const company = await Company.findOne({ _id: profile.company, isActive: true });
    if (!company) {
      throw new AppError('Approved recruiter company access is required', 403);
    }

    let membership = await CompanyMember.findOne({
      company: company._id,
      recruiter: request.user.id,
      status: 'active',
    });

    if (!membership && company.teamMembers && Array.isArray(company.teamMembers)) {
      const legacyMember = company.teamMembers.find(
        (m) => String(m.recruiter) === String(request.user.id) && m.status === 'active'
      );
      if (legacyMember) {
        membership = {
          role: legacyMember.role || 'recruiter',
          permissions: legacyMember.permissions || [],
          status: legacyMember.status
        };
      }
    }

    const isOwner = Boolean(
      (company.owner && company.owner.equals(request.user.id)) ||
      profile.isCompanyOwner ||
      membership?.role === 'primary_admin'
    );
    const userPermissions = isOwner ? OWNER_PERMISSIONS : (profile.permissions || []);
    const memberPermissions = isOwner ? OWNER_PERMISSIONS : (membership?.permissions || []);

    const hasPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission) && memberPermissions.includes(permission));
      
    const requiresVerifiedCompany = requiredPermissions.some((permission) =>
      permission.startsWith('jobs.publish') ||
      permission.startsWith('applications.') ||
      permission.startsWith('assessments.') ||
      permission.startsWith('interviews.') ||
      permission.startsWith('offers.') ||
      permission.startsWith('documents.')
    );
    
    if ((!membership && !isOwner) || !hasPermissions || (requiresVerifiedCompany && company.verificationStatus !== 'verified')) {
      throw new AppError('You do not have the required company permission', 403);
    }
    
    request.recruiterProfile = profile;
    request.company = company;
    request.companyMember = membership || { role: 'primary_admin', permissions: OWNER_PERMISSIONS, status: 'active' };
    return next();
  } catch (error) {
    return next(error);
  }
};
