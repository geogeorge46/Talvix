import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { OwnershipClaim } from '../models/OwnershipClaim.js';
import { AuditLog } from '../models/AuditLog.js';
import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { OWNER_PERMISSIONS } from '../constants/permissions.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';

export const transferCompanyOwnership = async (companyId, newOwnerId, adminId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const company = await Company.findById(companyId);
  if (!company) throw new AppError('Company not found', 404);

  const oldOwnerId = company.owner;
  if (oldOwnerId.equals(newOwnerId)) {
    throw new AppError('The user is already the owner of this company', 400);
  }

  const newOwnerUser = await User.findById(newOwnerId);
  if (!newOwnerUser || newOwnerUser.role !== 'recruiter') {
    throw new AppError('New owner must be a valid recruiter user', 404);
  }

  const oldValue = company.toJSON();

  // Find or create CompanyMember for the new owner
  let newOwnerMember = await CompanyMember.findOne({ company: companyId, recruiter: newOwnerId });
  if (newOwnerMember) {
    newOwnerMember.role = 'primary_admin';
    newOwnerMember.permissions = OWNER_PERMISSIONS;
    newOwnerMember.status = 'active';
    await newOwnerMember.save();
  } else {
    newOwnerMember = await CompanyMember.create({
      company: companyId,
      recruiter: newOwnerId,
      role: 'primary_admin',
      permissions: OWNER_PERMISSIONS,
      status: 'active',
    });
  }

  // Update company owner
  company.owner = newOwnerId;
  await company.save();

  // Demote/Update old owner member if present
  const oldOwnerMember = await CompanyMember.findOne({ company: companyId, recruiter: oldOwnerId });
  if (oldOwnerMember) {
    oldOwnerMember.role = 'recruiter';
    oldOwnerMember.permissions = OWNER_PERMISSIONS.filter(p => p !== 'team.manage' && p !== 'company.manage');
    await oldOwnerMember.save();
    
    await RecruiterProfile.updateOne(
      { user: oldOwnerId },
      { $set: { isCompanyOwner: false, permissions: oldOwnerMember.permissions } }
    );
    await revokeUserSessions(oldOwnerId);
  }

  // Update profiles
  await RecruiterProfile.updateOne(
    { user: newOwnerId },
    { $set: { company: companyId, isCompanyOwner: true, permissions: OWNER_PERMISSIONS } }
  );

  // Revoke sessions
  await revokeUserSessions(newOwnerId);

  // Audit Log
  await AuditLog.create({
    action: 'company.transfer_owner',
    actor: adminId,
    company: companyId,
    targetUser: newOwnerId,
    oldValue: { owner: oldOwnerId },
    newValue: { owner: newOwnerId },
    ipAddress,
    userAgent,
  });

  return company;
};

export const adminRemoveMember = async (companyId, memberId, adminId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const company = await Company.findById(companyId);
  if (!company) throw new AppError('Company not found', 404);

  const member = await CompanyMember.findById(memberId);
  if (!member || !member.company.equals(companyId)) {
    throw new AppError('Member not found in this company', 404);
  }

  if (member.recruiter.equals(company.owner)) {
    throw new AppError('Cannot remove the company owner directly. Transfer ownership first.', 400);
  }

  const oldValue = member.toJSON();
  member.status = 'removed';
  member.permissions = [];
  await member.save();

  await RecruiterProfile.updateOne({ user: member.recruiter }, { $set: { company: null, permissions: [], isCompanyOwner: false } });
  await revokeUserSessions(member.recruiter);

  await AuditLog.create({
    action: 'team.remove',
    actor: adminId,
    company: companyId,
    targetUser: member.recruiter,
    oldValue,
    newValue: member,
    ipAddress,
    userAgent,
  });
};

export const adminApproveMember = async (companyId, memberId, adminId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const member = await CompanyMember.findById(memberId);
  if (!member || !member.company.equals(companyId)) {
    throw new AppError('Member not found in this company', 404);
  }

  const oldValue = member.toJSON();
  member.status = 'active';
  await member.save();

  await RecruiterProfile.updateOne({ user: member.recruiter }, { $set: { company: companyId, permissions: member.permissions } });
  await revokeUserSessions(member.recruiter);

  await AuditLog.create({
    action: 'team.join',
    actor: adminId,
    company: companyId,
    targetUser: member.recruiter,
    oldValue,
    newValue: member,
    ipAddress,
    userAgent,
  });

  return member;
};

export const restoreCompany = async (companyId, adminId, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const company = await Company.findById(companyId);
  if (!company) throw new AppError('Company not found', 404);

  const oldValue = company.toJSON();
  company.verificationStatus = 'verified';
  company.isActive = true;
  await company.save();

  // Restore members
  await CompanyMember.updateMany({ company: companyId, status: 'suspended' }, { $set: { status: 'active' } });

  const members = await CompanyMember.find({ company: companyId, status: 'active' });
  for (const m of members) {
    await revokeUserSessions(m.recruiter);
  }

  await AuditLog.create({
    action: 'company.restore',
    actor: adminId,
    company: companyId,
    oldValue,
    newValue: company,
    ipAddress,
    userAgent,
  });

  return company;
};

export const listAllClaims = async () => {
  return OwnershipClaim.find({}).populate('company', 'name slug').populate('claimant', 'fullName email');
};

export const resolveOwnershipClaim = async (claimId, adminId, action, notes = '', ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const claim = await OwnershipClaim.findById(claimId);
  if (!claim || claim.status !== 'pending') {
    throw new AppError('Claim not found or already reviewed', 404);
  }

  const company = await Company.findById(claim.company);
  if (!company) throw new AppError('Company not found', 404);

  claim.status = action === 'approve' ? 'approved' : 'rejected';
  claim.reviewedBy = adminId;
  claim.reviewedAt = new Date();
  claim.notes = notes;
  await claim.save();

  if (action === 'approve') {
    const fakeOwnerId = company.owner;
    const newOwnerId = claim.claimant;

    // 1. Transfer company ownership to claimant
    company.owner = newOwnerId;
    await company.save();

    // 2. Setup claimant member
    let claimantMember = await CompanyMember.findOne({ company: company._id, recruiter: newOwnerId });
    if (claimantMember) {
      claimantMember.role = 'primary_admin';
      claimantMember.permissions = OWNER_PERMISSIONS;
      claimantMember.status = 'active';
      await claimantMember.save();
    } else {
      claimantMember = await CompanyMember.create({
        company: company._id,
        recruiter: newOwnerId,
        role: 'primary_admin',
        permissions: OWNER_PERMISSIONS,
        status: 'active',
      });
    }

    await RecruiterProfile.updateOne(
      { user: newOwnerId },
      { $set: { company: company._id, isCompanyOwner: true, permissions: OWNER_PERMISSIONS } }
    );
    await revokeUserSessions(newOwnerId);

    // 3. Remove/Suspend the fake owner
    const fakeOwnerMember = await CompanyMember.findOne({ company: company._id, recruiter: fakeOwnerId });
    if (fakeOwnerMember) {
      fakeOwnerMember.status = 'removed';
      await fakeOwnerMember.save();
    }
    
    // De-associate fake owner profile
    await RecruiterProfile.updateOne(
      { user: fakeOwnerId },
      { $set: { company: null, isCompanyOwner: false, permissions: [] } }
    );

    // Platform admin choice: Suspend the fraudulent fake owner account
    await User.updateOne({ _id: fakeOwnerId }, { $set: { isActive: false } });
    await revokeUserSessions(fakeOwnerId);

    // Audit Log
    await AuditLog.create({
      action: 'company.claim_approved',
      actor: adminId,
      company: company._id,
      targetUser: newOwnerId,
      oldValue: { owner: fakeOwnerId },
      newValue: { owner: newOwnerId },
      ipAddress,
      userAgent,
    });
  } else {
    await AuditLog.create({
      action: 'company.claim_rejected',
      actor: adminId,
      company: company._id,
      targetUser: claim.claimant,
      ipAddress,
      userAgent,
    });
  }

  return claim;
};
