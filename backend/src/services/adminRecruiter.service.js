import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { RecruiterVerificationHistory } from '../models/RecruiterVerificationHistory.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';

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

export const approveRecruiter = async (id, adminId, _reason = '', ipAddress = '', userAgent = '') => {
  const profile = await findProfile(id);
  const oldValue = JSON.parse(JSON.stringify(profile));

  const adminUser = await User.findById(adminId);
  const adminName = adminUser ? adminUser.fullName : 'Talvix Admin';
  const userRecord = await User.findById(profile.user);
  const previousStatus = userRecord ? userRecord.recruiterVerificationStatus : 'none';

  profile.isApproved = true;
  profile.approvedBy = adminId;
  profile.approvedAt = new Date();
  profile.rejectionReason = '';
  profile.rejectedBy = null;
  profile.rejectedAt = null;
  profile.suspendedBy = null;
  profile.suspendedAt = null;
  profile.suspensionReason = '';
  await profile.save();

  await User.updateOne({ _id: profile.user }, { $set: { isActive: true, recruiterVerificationStatus: 'verified' } });

  // History timeline record
  const history = new RecruiterVerificationHistory({
    recruiterId: profile.user,
    action: 'verification.approved',
    previousStatus,
    newStatus: 'verified',
    performedBy: adminId,
    performedByName: adminName
  });
  await history.save();

  // Audit Log
  await AuditLog.create({
    action: 'recruiter.verification.approved',
    actor: adminId,
    targetUser: profile.user,
    oldValue,
    newValue: profile,
    ipAddress,
    userAgent
  });

  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_APPROVED, actor: String(adminId), recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user), actionUrl: '/recruiter/profile' }, deduplicationKey: `recruiter.approved:${profile.user}:${profile.approvedAt.toISOString()}` });
  return profile;
};

export const rejectRecruiter = async (id, adminId, reason = '', ipAddress = '', userAgent = '') => {
  if (!reason || !reason.trim()) {
    throw new AppError('Rejection reason is required', 400);
  }
  const profile = await findProfile(id);
  const oldValue = JSON.parse(JSON.stringify(profile));

  const adminUser = await User.findById(adminId);
  const adminName = adminUser ? adminUser.fullName : 'Talvix Admin';
  const userRecord = await User.findById(profile.user);
  const previousStatus = userRecord ? userRecord.recruiterVerificationStatus : 'none';

  profile.isApproved = false;
  profile.rejectedBy = adminId;
  profile.rejectedAt = new Date();
  profile.rejectionReason = reason.trim();
  profile.approvedBy = null;
  profile.approvedAt = null;
  profile.suspendedBy = null;
  profile.suspendedAt = null;
  profile.suspensionReason = '';
  await profile.save();

  await User.updateOne({ _id: profile.user }, { $set: { recruiterVerificationStatus: 'rejected' } });

  // History timeline record
  const history = new RecruiterVerificationHistory({
    recruiterId: profile.user,
    action: 'verification.rejected',
    previousStatus,
    newStatus: 'rejected',
    performedBy: adminId,
    performedByName: adminName,
    reason: reason.trim()
  });
  await history.save();

  // Audit Log
  await AuditLog.create({
    action: 'recruiter.verification.rejected',
    actor: adminId,
    targetUser: profile.user,
    oldValue,
    newValue: profile,
    ipAddress,
    userAgent
  });

  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_REJECTED, actor: String(adminId), recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user) }, deduplicationKey: `recruiter.rejected:${profile.user}:${profile.rejectedAt.toISOString()}` });
  return profile;
};

export const suspendRecruiter = async (id, adminId, reason = '', ipAddress = '', userAgent = '') => {
  if (!reason || !reason.trim()) {
    throw new AppError('Suspension reason is required', 400);
  }
  const profile = await findProfile(id);
  const oldValue = JSON.parse(JSON.stringify(profile));

  const adminUser = await User.findById(adminId);
  const adminName = adminUser ? adminUser.fullName : 'Talvix Admin';
  const userRecord = await User.findById(profile.user);
  const previousStatus = userRecord ? userRecord.recruiterVerificationStatus : 'none';

  profile.isApproved = false;
  profile.suspendedBy = adminId;
  profile.suspendedAt = new Date();
  profile.suspensionReason = reason.trim();
  profile.approvedBy = null;
  profile.approvedAt = null;
  profile.rejectedBy = null;
  profile.rejectedAt = null;
  profile.rejectionReason = '';
  await profile.save();

  await User.updateOne({ _id: profile.user }, { $set: { recruiterVerificationStatus: 'suspended', isActive: false }, $unset: { refreshTokenHash: 1 } });
  await RefreshSession.updateMany({ userId: profile.user }, { $set: { isActive: false } });

  // History timeline record
  const history = new RecruiterVerificationHistory({
    recruiterId: profile.user,
    action: 'verification.suspended',
    previousStatus,
    newStatus: 'suspended',
    performedBy: adminId,
    performedByName: adminName,
    reason: reason.trim()
  });
  await history.save();

  // Audit Log
  await AuditLog.create({
    action: 'recruiter.verification.suspended',
    actor: adminId,
    targetUser: profile.user,
    oldValue,
    newValue: profile,
    ipAddress,
    userAgent
  });

  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_SUSPENDED, actor: String(adminId), recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user) }, deduplicationKey: `recruiter.suspended:${profile.user}:${profile.suspendedAt.toISOString()}` });
  return profile;
};

export const restoreRecruiter = async (id, adminId, _reason = '', ipAddress = '', userAgent = '') => {
  const profile = await findProfile(id);
  const oldValue = JSON.parse(JSON.stringify(profile));

  const adminUser = await User.findById(adminId);
  const adminName = adminUser ? adminUser.fullName : 'Talvix Admin';
  const userRecord = await User.findById(profile.user);
  const previousStatus = userRecord ? userRecord.recruiterVerificationStatus : 'none';

  profile.isApproved = true;
  profile.restoredBy = adminId;
  profile.restoredAt = new Date();
  profile.approvedBy = adminId;
  profile.approvedAt = new Date();
  profile.rejectionReason = '';
  profile.rejectedBy = null;
  profile.rejectedAt = null;
  profile.suspendedBy = null;
  profile.suspendedAt = null;
  profile.suspensionReason = '';
  await profile.save();

  await User.updateOne({ _id: profile.user }, { $set: { isActive: true, recruiterVerificationStatus: 'verified' } });
  await revokeUserSessions(profile.user);

  // History timeline record
  const history = new RecruiterVerificationHistory({
    recruiterId: profile.user,
    action: 'verification.restored',
    previousStatus,
    newStatus: 'verified',
    performedBy: adminId,
    performedByName: adminName
  });
  await history.save();

  // Audit Log
  await AuditLog.create({
    action: 'recruiter.verification.restored',
    actor: adminId,
    targetUser: profile.user,
    oldValue,
    newValue: profile,
    ipAddress,
    userAgent
  });

  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.RECRUITER_APPROVED, actor: String(adminId), recipientIds: [String(profile.user)], payload: { recruiterId: String(profile.user), actionUrl: '/recruiter/profile' }, deduplicationKey: `recruiter.restored:${profile.user}:${profile.approvedAt.toISOString()}` });
  return profile;
};
