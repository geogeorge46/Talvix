import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

export const listPendingCompanies = async ({ page, limit }) => {
  const filter = { verificationStatus: 'pending', isActive: true };
  const [companies, total] = await Promise.all([Company.find(filter).populate('owner', 'fullName email role').sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit), Company.countDocuments(filter)]);
  return { companies, pagination: buildPagination(page, limit, total) };
};
export const setCompanyVerification = async (companyId, status, adminId, notes = '') => {
  const company = await Company.findById(companyId);
  if (!company) throw new AppError('Company not found', 404);
  company.verificationStatus = status; company.verificationNotes = notes;
  company.verifiedBy = adminId; company.verifiedAt = new Date();
  if (status === 'suspended') await Job.updateMany({ company: company.id, status: 'published' }, { $set: { status: 'paused' } });
  await company.save();
  const event = status === 'verified' ? DOMAIN_EVENTS.COMPANY_VERIFIED : status === 'rejected' ? DOMAIN_EVENTS.COMPANY_REJECTED : DOMAIN_EVENTS.COMPANY_SUSPENDED;
  const recipients = status === 'suspended' ? company.teamMembers.filter((member) => member.status === 'active').map((member) => String(member.recruiter)) : [String(company.owner)];
  await publishOptionalDomainEvent({ type: event, actor: String(adminId), company: String(company.id), recipientIds: recipients, payload: { companyId: String(company.id), companyName: company.name }, deduplicationKey: `${event}:${company.id}:${company.verifiedAt.toISOString()}` });
  return company;
};
