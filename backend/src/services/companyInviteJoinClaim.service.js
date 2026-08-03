import crypto from 'crypto';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Invitation } from '../models/Invitation.js';
import { JoinRequest } from '../models/JoinRequest.js';
import { OwnershipClaim } from '../models/OwnershipClaim.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { securityMonitor } from './securityMonitor.service.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';
import { createNotification } from './notification.service.js';

// Default permissions assigned to new recruiters
const DEFAULT_RECRUITER_PERMISSIONS = [
  'jobs.create',
  'jobs.update',
  'applications.view',
  'applications.manage',
  'assessments.view',
  'interviews.view',
  'documents.view',
];

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const inviteRecruiter = async (company, actorId, input, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const { email, role, permissions } = input;
  const lowercaseEmail = email.toLowerCase().trim();

  // Check if user is already a member
  const user = await User.findOne({ email: lowercaseEmail });
  if (user) {
    const existingMember = await CompanyMember.findOne({ company: company.id, recruiter: user.id });
    if (existingMember && existingMember.status !== 'removed') {
      throw new AppError('User is already a member of this company', 409);
    }
  }

  // Check for active pending invitation
  const existingInvite = await Invitation.findOne({
    company: company.id,
    email: lowercaseEmail,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (existingInvite) {
    throw new AppError('A pending invitation already exists for this email address', 409);
  }

  // Generate invite token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 Hours

  const invitation = await Invitation.create({
    company: company.id,
    email: lowercaseEmail,
    role,
    permissions,
    tokenHash,
    expiresAt,
    invitedBy: actorId,
  });

  // Log Audit Event
  await AuditLog.create({
    action: 'team.invite',
    actor: actorId,
    company: company.id,
    newValue: { email: lowercaseEmail, role, permissions, inviteId: invitation._id },
    ipAddress,
    userAgent,
  });

  return { token: rawToken, invitation };
};

export const getInvitationDetails = async (token) => {
  const tokenHash = hashToken(token);
  const invitation = await Invitation.findOne({ tokenHash, status: 'pending' }).populate('company', 'name slug logo description');
  
  if (!invitation || invitation.expiresAt < new Date()) {
    throw new AppError('Invitation is invalid or has expired', 410);
  }

  return invitation;
};

export const acceptInvitation = async (userId, token, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const tokenHash = hashToken(token);
  const invitation = await Invitation.findOne({ tokenHash, status: 'pending' });
  if (!invitation || invitation.expiresAt < new Date()) {
    throw new AppError('Invitation is invalid or has expired', 410);
  }

  const user = await User.findById(userId);
  if (!user || user.role !== 'recruiter') {
    throw new AppError('Only recruiter accounts can accept company invitations', 403);
  }

  const profile = await RecruiterProfile.findOne({ user: userId });
  if (profile?.company) {
    throw new AppError('You are already associated with an active company', 409);
  }

  // Mark invitation as accepted
  invitation.status = 'accepted';
  await invitation.save();

  // Create Company Member record
  const member = await CompanyMember.create({
    company: invitation.company,
    recruiter: userId,
    role: invitation.role,
    permissions: invitation.permissions,
    status: 'active',
  });

  // Update profile
  await RecruiterProfile.updateOne(
    { user: userId },
    { $set: { company: invitation.company, permissions: invitation.permissions, isCompanyOwner: false } }
  );

  // Force re-login
  await revokeUserSessions(userId);

  // Log Audit
  await AuditLog.create({
    action: 'team.join',
    actor: userId,
    company: invitation.company,
    newValue: member,
    ipAddress,
    userAgent,
  });

  return member;
};

export const createJoinRequest = async (userId, companyId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  // Check for rate-limiting / spam
  await securityMonitor.trackJoinRequest(userId, ipAddress);

  const user = await User.findById(userId);
  if (!user || user.role !== 'recruiter') {
    throw new AppError('Only recruiter accounts can request to join companies', 403);
  }

  const profile = await RecruiterProfile.findOne({ user: userId });
  if (profile?.company) {
    throw new AppError('You are already associated with an active company', 409);
  }

  const company = await Company.findOne({ _id: companyId, isActive: true });
  if (!company) {
    throw new AppError('Company not found or is inactive', 404);
  }

  // Domain Verification Auto-Approval Flow
  const userDomain = user.email.split('@')[1]?.toLowerCase();
  const companyDomain = company.officialEmailDomain?.toLowerCase();

  if (
    companyDomain &&
    userDomain === companyDomain &&
    company.autoApproveDomainMembers &&
    company.verificationStatus === 'verified'
  ) {
    // Auto-join immediately
    const member = await CompanyMember.create({
      company: company._id,
      recruiter: userId,
      role: 'recruiter',
      permissions: DEFAULT_RECRUITER_PERMISSIONS,
      status: 'active',
    });

    await RecruiterProfile.updateOne(
      { user: userId },
      { $set: { company: company._id, permissions: DEFAULT_RECRUITER_PERMISSIONS, isCompanyOwner: false } }
    );

    await revokeUserSessions(userId);

    // Audit Log
    await AuditLog.create({
      action: 'recruiter.auto_join_domain',
      actor: userId,
      company: company._id,
      newValue: member,
      ipAddress,
      userAgent,
    });

    return { status: 'approved', company };
  }

  // Normal pending request flow
  const existingRequest = await JoinRequest.findOne({ company: companyId, user: userId, status: 'pending' });
  if (existingRequest) {
    throw new AppError('You already have a pending join request for this company', 409);
  }

  const joinRequest = await JoinRequest.create({
    company: companyId,
    user: userId,
  });

  // Audit Log
  await AuditLog.create({
    action: 'team.join_request',
    actor: userId,
    company: companyId,
    newValue: joinRequest,
    ipAddress,
    userAgent,
  });

  return { status: 'pending', joinRequest };
};

export const listJoinRequests = async (companyId) => {
  return JoinRequest.find({ company: companyId, status: 'pending' }).populate('user', 'fullName email avatar');
};

export const reviewJoinRequest = async (company, requestId, actorId, action, notes = '', ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const request = await JoinRequest.findById(requestId);
  if (!request || !request.company.equals(company.id) || request.status !== 'pending') {
    throw new AppError('Join request not found or already processed', 404);
  }

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.reviewedBy = actorId;
  request.reviewedAt = new Date();
  request.notes = notes;
  await request.save();

  if (action === 'approve') {
    // Check user is not currently in a company
    const profile = await RecruiterProfile.findOne({ user: request.user });
    if (profile?.company) {
      throw new AppError('User already belongs to another company', 409);
    }

    const member = await CompanyMember.create({
      company: company.id,
      recruiter: request.user,
      role: 'recruiter',
      permissions: DEFAULT_RECRUITER_PERMISSIONS,
      status: 'active',
    });

    await RecruiterProfile.updateOne(
      { user: request.user },
      { $set: { company: company.id, permissions: DEFAULT_RECRUITER_PERMISSIONS, isCompanyOwner: false } }
    );

    await revokeUserSessions(request.user);

    await AuditLog.create({
      action: 'team.join',
      actor: actorId,
      company: company.id,
      targetUser: request.user,
      newValue: member,
      ipAddress,
      userAgent,
    });
  } else {
    await AuditLog.create({
      action: 'team.reject',
      actor: actorId,
      company: company.id,
      targetUser: request.user,
      ipAddress,
      userAgent,
    });
  }

  return request;
};

export const submitOwnershipClaim = async (
  claimantId,
  companyId,
  officialEmail,
  linkedinUrl,
  proofUrl = '',
  extraData = {},
  ipAddress = 'Unknown',
  userAgent = 'Unknown'
) => {
  const company = await Company.findOne({ _id: companyId, isActive: true });
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const profile = await RecruiterProfile.findOne({ user: claimantId });
  if (profile?.company) {
    throw new AppError('You cannot claim ownership when already associated with an active company', 409);
  }

  const existingClaim = await OwnershipClaim.findOne({ company: companyId, claimant: claimantId, status: 'pending' });
  if (existingClaim) {
    throw new AppError('You already have a pending ownership claim for this company', 409);
  }

  const claim = await OwnershipClaim.create({
    company: companyId,
    claimant: claimantId,
    officialEmail: officialEmail.toLowerCase().trim(),
    linkedinUrl,
    proofUrl,
    companyWebsite: extraData.companyWebsite || '',
    businessRegistration: extraData.businessRegistration || '',
    gstNumber: extraData.gstNumber || '',
    uploadedDocuments: extraData.uploadedDocuments || [],
    claimantNotes: extraData.claimantNotes || '',
  });

  // Notify current owner, Primary Admin, and HR Admin
  const admins = await CompanyMember.find({
    company: companyId,
    role: { $in: ['primary_admin', 'hr_admin'] },
    status: 'active'
  });
  const recipients = new Set();
  if (company.owner) {
    recipients.add(String(company.owner));
  }
  for (const admin of admins) {
    recipients.add(String(admin.recruiter));
  }

  for (const recipientId of recipients) {
    try {
      await createNotification({
        recipientId,
        type: 'security-alert',
        category: 'security',
        title: 'Company Ownership Claim Filed',
        message: `An ownership claim has been submitted for company: ${company.name} by user ${claimantId}.`,
        source: 'company',
        sourceEntity: { model: 'OwnershipClaim', id: claim._id },
        data: { companyId: String(companyId) }
      });
    } catch (err) {
      // Ignore notification failures
    }
  }

  await AuditLog.create({
    action: 'company.claim_submitted',
    actor: claimantId,
    company: companyId,
    newValue: claim,
    ipAddress,
    userAgent,
  });

  return claim;
};

export const respondToOwnershipClaim = async (claimId, userId, responseText, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const claim = await OwnershipClaim.findById(claimId);
  if (!claim || claim.status !== 'pending') {
    throw new AppError('Claim not found or already resolved', 404);
  }
  const company = await Company.findById(claim.company);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const isOwner = company.owner.equals(userId);
  const membership = await CompanyMember.findOne({ company: company._id, recruiter: userId, status: 'active', role: 'primary_admin' });
  if (!isOwner && !membership) {
    throw new AppError('Forbidden: Only the current company owner can respond to claims', 403);
  }

  claim.ownerResponse = responseText;
  claim.ownerRespondedAt = new Date();
  await claim.save();

  await AuditLog.create({
    action: 'company.claim_owner_responded',
    actor: userId,
    company: company._id,
    targetUser: claim.claimant,
    newValue: { claimId, responseText },
    ipAddress,
    userAgent
  });

  return claim;
};

export const listCompanyInvitations = async (companyId) => {
  return await Invitation.find({ company: companyId }).sort({ createdAt: -1 });
};

export const resendInvitation = async (companyId, invitationId, actorId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const invitation = await Invitation.findOne({ _id: invitationId, company: companyId });
  if (!invitation) throw new AppError('Invitation not found', 404);
  if (invitation.status === 'accepted') throw new AppError('Invitation already accepted', 400);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  invitation.tokenHash = tokenHash;
  invitation.status = 'pending';
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days expiration
  invitation.invitedBy = actorId;
  await invitation.save();

  await AuditLog.create({
    action: 'team.invite_resent',
    actor: actorId,
    company: companyId,
    targetUser: null,
    newValue: { invitationId, email: invitation.email },
    ipAddress,
    userAgent
  });

  return { invitation, token };
};

export const cancelInvitation = async (companyId, invitationId, actorId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const invitation = await Invitation.findOne({ _id: invitationId, company: companyId });
  if (!invitation) throw new AppError('Invitation not found', 404);
  if (invitation.status === 'accepted') throw new AppError('Invitation already accepted', 400);

  invitation.status = 'revoked';
  await invitation.save();

  await AuditLog.create({
    action: 'team.invite_cancelled',
    actor: actorId,
    company: companyId,
    targetUser: null,
    newValue: { invitationId, email: invitation.email },
    ipAddress,
    userAgent
  });

  return invitation;
};
