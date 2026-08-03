import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AuditLog } from '../models/AuditLog.js';
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
  company.verificationStatus = status;
  company.verificationNotes = notes;
  company.verifiedBy = adminId;
  company.verifiedAt = new Date();

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
    deduplicationKey: `${event}:${company.id}:${company.verifiedAt.toISOString()}`
  });

  return company;
};
