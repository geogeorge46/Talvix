import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

export const listPendingRecruiters = async ({ page, limit }) => {
  const filter = { isApproved: false };
  const [profiles, total] = await Promise.all([
    RecruiterProfile.find(filter).populate('user', 'fullName email role createdAt').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    RecruiterProfile.countDocuments(filter),
  ]);
  return { recruiters: profiles, pagination: buildPagination(page, limit, total) };
};

const findProfile = async (id) => {
  const profile = await RecruiterProfile.findById(id);
  if (!profile) throw new AppError('Recruiter profile not found', 404);
  return profile;
};

export const approveRecruiter = async (id, adminId) => {
  const profile = await findProfile(id);
  profile.isApproved = true; profile.approvedBy = adminId; profile.approvedAt = new Date();
  await profile.save();
  await User.updateOne({ _id: profile.user }, { $set: { isActive: true } });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_APPROVED, actor: String(adminId), recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user), actionUrl: '/recruiter/profile' }, deduplicationKey: `recruiter.approved:${profile.user}:${profile.approvedAt.toISOString()}` });
  return profile;
};

export const rejectRecruiter = async (id) => {
  const profile = await findProfile(id);
  profile.isApproved = false; profile.approvedBy = null; profile.approvedAt = null;
  await profile.save(); await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_REJECTED, recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user) }, deduplicationKey: `recruiter.rejected:${profile.user}:${profile.updatedAt.toISOString()}` }); return profile;
};

export const suspendRecruiter = async (id) => {
  const profile = await findProfile(id);
  profile.isApproved = false; await profile.save();
  await User.updateOne({ _id: profile.user }, { $set: { isActive: false }, $unset: { refreshTokenHash: 1 } });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_SUSPENDED, recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user) }, deduplicationKey: `recruiter.suspended:${profile.user}:${profile.updatedAt.toISOString()}` });
  return profile;
};
