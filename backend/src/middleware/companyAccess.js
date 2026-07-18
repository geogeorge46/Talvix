import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AppError } from '../shared/errors/AppError.js';

/** Loads the recruiter's active company and verifies active team membership. */
export const requireCompanyAccess = async (request, _response, next) => {
  try {
    const profile = request.recruiterProfile ?? await RecruiterProfile.findOne({ user: request.user.id });
    if (!profile?.company) throw new AppError('Company not found', 404);
    const company = await Company.findOne({ _id: profile.company, isActive: true });
    const member = company?.teamMembers.find((entry) => entry.recruiter.equals(request.user.id) && entry.status === 'active');
    if (!company || !member) throw new AppError('Company not found', 404);
    request.recruiterProfile = profile;
    request.company = company;
    request.companyMember = member;
    return next();
  } catch (error) {
    return next(error);
  }
};
