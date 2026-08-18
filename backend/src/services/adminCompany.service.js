import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { CompanyVerificationHistory } from '../models/CompanyVerificationHistory.js';
import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';

export const listPendingCompanies = async ({ page, limit }) => {
  const filter = { verificationStatus: 'pending', isActive: true };
  const [companies, total] = await Promise.all([
    Company.find(filter).populate('owner', 'fullName email role').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
    Company.countDocuments(filter)
  ]);
  return { companies, pagination: buildPagination(page, limit, total) };
};

export const setCompanyVerification = async (companyId, status, adminId, notes = '', ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const company = await Company.findById(companyId);
  if (!company) throw new AppError('Company not found', 404);

  const oldValue = company.toJSON();
  
  if (status === 'rejected') {
    if (!notes || !notes.trim()) {
      throw new AppError('Rejection reason is required', 400);
    }
    company.rejectionReason = notes.trim();
  } else if (status === 'verified') {
    company.rejectionReason = '';
  }

  company.verificationStatus = status;
  company.verificationNotes = notes;

  if (status === 'verified') {
    company.verifiedBy = adminId;
    company.verifiedAt = new Date();
    company.rejectedBy = null;
    company.rejectedAt = null;
    company.suspendedBy = null;
    company.suspendedAt = null;
    company.suspensionReason = '';
  } else if (status === 'rejected') {
    company.rejectedBy = adminId;
    company.rejectedAt = new Date();
    company.verifiedBy = null;
    company.verifiedAt = null;
    company.suspendedBy = null;
    company.suspendedAt = null;
  } else if (status === 'suspended') {
    company.suspendedBy = adminId;
    company.suspendedAt = new Date();
    company.suspensionReason = notes.trim();
    company.verifiedBy = null;
    company.verifiedAt = null;
    company.rejectedBy = null;
    company.rejectedAt = null;
  }

  // Create verification history entry
  const adminUser = await User.findById(adminId);
  const adminName = adminUser?.fullName || 'System Administrator';

  let historyAction = `verification.${status}`;
  if (status === 'verified') {
    historyAction = (oldValue.verificationStatus === 'suspended' || oldValue.verificationStatus === 'rejected')
      ? 'verification.restored'
      : 'verification.approved';
  }

  await CompanyVerificationHistory.create({
    companyId: company._id,
    action: historyAction,
    previousStatus: oldValue.verificationStatus,
    newStatus: status,
    performedBy: adminId,
    performedByName: adminName,
    reason: status === 'rejected' ? notes.trim() : (status === 'suspended' ? notes.trim() : ''),
    notes: notes,
    timestamp: new Date()
  });

  const members = await CompanyMember.find({ company: company.id, status: 'active' });

  if (status === 'verified') {
    // Find creator/owner's provisional membership
    const ownerMember = await CompanyMember.findOne({ company: company.id, recruiter: company.owner });
    if (ownerMember) {
      ownerMember.role = 'primary_admin';
      await ownerMember.save();
    }
    await RecruiterProfile.updateOne({ user: company.owner }, { $set: { isCompanyOwner: true } });
  }

  if (status === 'suspended') {
    await Job.updateMany({ company: company.id, status: 'published' }, { $set: { status: 'paused' } });
    // Suspend active memberships
    await CompanyMember.updateMany({ company: company.id, status: 'active' }, { $set: { status: 'suspended' } });
    for (const member of members) {
      await revokeUserSessions(member.recruiter);
    }
  }

  await company.save();

  // Create Audit Log
  await AuditLog.create({
    action: `company.${status}`,
    actor: adminId,
    company: company._id,
    oldValue,
    newValue: company,
    ipAddress,
    userAgent,
  });

  const event = status === 'verified' ? DOMAIN_EVENTS.COMPANY_VERIFIED : status === 'rejected' ? DOMAIN_EVENTS.COMPANY_REJECTED : DOMAIN_EVENTS.COMPANY_SUSPENDED;
  const recipients = status === 'suspended' ? members.map((member) => String(member.recruiter)) : [String(company.owner)];
  
  await publishOptionalDomainEvent({
    type: event,
    actor: String(adminId),
    company: String(company.id),
    recipientIds: recipients,
    payload: { companyId: String(company.id), companyName: company.name },
    deduplicationKey: `${event}:${company.id}:${(company.verifiedAt || company.rejectedAt || company.suspendedAt || new Date()).toISOString()}`
  });

  return company;
};
