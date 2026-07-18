import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';

export const activeUsers = async (ids) => User.find({ _id: { $in: [...new Set(ids.map(String))] }, isActive: true }).distinct('_id');
export const companyRecipients = async (companyId, permission) => {
  const company = await Company.findById(companyId).select('owner teamMembers');
  if (!company) return [];
  const ids = company.teamMembers.filter((member) => member.status === 'active' && (!permission || member.permissions.includes(permission))).map((member) => member.recruiter);
  return approvedRecruiters(ids);
};
export const platformAdmins = () => User.find({ role: 'admin', isActive: true }).distinct('_id');
export const approvedRecruiters = async (ids) => {
  const profiles = await RecruiterProfile.find({ user: { $in: ids }, isApproved: true }).distinct('user');
  return activeUsers(profiles);
};
