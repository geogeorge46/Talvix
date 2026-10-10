import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { CompanyMember } from '../models/CompanyMember.js';

export const activeUsers = async (ids) => {
  const objectIds = [...new Set((ids || []).map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return [];
  const users = await User.find({ _id: { $in: objectIds }, isActive: { $ne: false }, isDeleted: { $ne: true } }).select('_id');
  return users.map((u) => u._id);
};
export const companyRecipients = async (companyId, permission) => {
  const company = await Company.findOne({ _id: companyId, isActive: true, verificationStatus: 'verified' }).select('teamMembers');
  if (!company) return [];
  
  const members = await CompanyMember.find({
    company: companyId,
    status: 'active'
  });

  let ids = [];
  if (members.length > 0) {
    ids = members
      .filter((member) => !permission || member.permissions.includes(permission))
      .map((member) => member.recruiter);
  } else if (company.teamMembers && Array.isArray(company.teamMembers)) {
    // Fallback to legacy inline teamMembers array for compatibility
    ids = company.teamMembers
      .filter((member) => member.status === 'active' && (!permission || member.permissions.includes(permission)))
      .map((member) => member.recruiter);
  }

  return approvedRecruiters(ids, company.id);
};
export const platformAdmins = async () => {
  const admins = await User.find({ role: 'admin', isActive: { $ne: false }, isDeleted: { $ne: true } }).select('_id');
  return admins.map((u) => u._id);
};
export const approvedRecruiters = async (ids, companyId) => {
  const objectIds = [...new Set((ids || []).map(String))]
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return [];
  const filter = { user: { $in: objectIds }, isApproved: true };
  if (companyId) filter.company = companyId;
  const profiles = await RecruiterProfile.find(filter).select('user');
  return activeUsers(profiles.map((p) => p.user));
};
