import { CompanyMember } from '../models/CompanyMember.js';
import { Company } from '../models/Company.js';
import { AppError } from '../shared/errors/AppError.js';
import { USER_ROLES } from '../constants/roles.js';

/**
 * Enforces strict multi-tenant isolation.
 * Resolves the recruiter's active company membership, attaches request.tenantCompanyId,
 * and ensures no cross-tenant information disclosure occurs.
 */
export const tenantIsolation = async (request, _response, next) => {
  try {
    if (!request.user) {
      throw new AppError('Authentication required', 401);
    }

    // Platform Admins can bypass tenant isolation for administrative operations
    if (request.user.role === USER_ROLES.ADMIN) {
      return next();
    }

    const membership = await CompanyMember.findOne({
      recruiter: request.user.id,
      status: 'active',
    });

    if (!membership) {
      throw new AppError('Approved recruiter company access is required', 403);
    }

    const company = await Company.findOne({ _id: membership.company, isActive: true });
    if (!company) {
      throw new AppError('Company not found or inactive', 404);
    }

    // Attach properties to the request object for query scoping and permission checks
    request.tenantCompanyId = company._id;
    request.company = company;
    request.companyMember = membership;

    return next();
  } catch (error) {
    return next(error);
  }
};
