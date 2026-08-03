import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AppError } from '../shared/errors/AppError.js';
import { updatePresenceTick } from '../services/realtime.service.js';

/** Loads the recruiter's active company and verifies active team membership. */
export const requireCompanyAccess = async (request, _response, next) => {
  try {
    const profile = request.recruiterProfile ?? await RecruiterProfile.findOne({ user: request.user.id });
    if (!profile?.company) throw new AppError('Company not found', 404);
    
    const company = await Company.findOne({ _id: profile.company, isActive: true });
    if (!company) throw new AppError('Company not found', 404);

    let member = await CompanyMember.findOne({
      company: company._id,
      recruiter: request.user.id,
      status: 'active',
    });

    if (!member && company.teamMembers && Array.isArray(company.teamMembers)) {
      const legacyMember = company.teamMembers.find(
        (m) => String(m.recruiter) === String(request.user.id) && m.status === 'active'
      );
      if (legacyMember) {
        member = {
          _id: company._id, // fallback mock id
          company: company._id,
          recruiter: request.user.id,
          role: legacyMember.role || 'recruiter',
          permissions: legacyMember.permissions || [],
          status: legacyMember.status
        };
      }
    }

    if (!member) throw new AppError('Company not found', 404);
    
    if (member._id && typeof CompanyMember.updateOne === 'function' && member.lastActive) {
      if (!member.lastActive || Date.now() - new Date(member.lastActive).getTime() > 300000) {
        CompanyMember.updateOne({ _id: member._id }, { $set: { lastActive: new Date() } }).catch(err => console.error('Failed to update member lastActive:', err));
      }
    }
    
    updatePresenceTick(company._id, request.user.id);
    
    request.recruiterProfile = profile;
    request.company = company;
    request.companyMember = member;
    return next();
  } catch (error) {
    return next(error);
  }
};
