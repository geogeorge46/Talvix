import mongoose from 'mongoose';

import { OWNER_PERMISSIONS } from '../constants/permissions.js';
import { USER_ROLES } from '../constants/roles.js';
import { Company } from '../models/Company.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { generateUniqueSlug } from '../utils/slug.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const supportsTransactions = () => ['ReplicaSetWithPrimary', 'Sharded'].includes(mongoose.connection.client?.topology?.description?.type);

const buildCompany = async (input, userId, session) => {
  const slug = await generateUniqueSlug(input.name, (candidate) => Company.exists({ slug: candidate }).session(session ?? null));
  const [company] = await Company.create([{
    ...input, slug, owner: userId, verificationStatus: 'pending', isActive: true,
    teamMembers: [{ recruiter: userId, role: 'owner', permissions: OWNER_PERMISSIONS, status: 'active' }],
  }], { session });
  await RecruiterProfile.updateOne({ user: userId }, { $set: { company: company._id, isCompanyOwner: true, permissions: OWNER_PERMISSIONS } }, { session });
  return company;
};

export const createCompany = async (userId, input) => {
  const profile = await RecruiterProfile.findOne({ user: userId });
  if (!profile?.isApproved) throw new AppError('Recruiter approval is required', 403);
  if (profile.company || await Company.exists({ owner: userId, isActive: true })) throw new AppError('Recruiter already belongs to an active company', 409);

  if (supportsTransactions()) {
    const session = await mongoose.startSession(); let company;
    try {
      await session.withTransaction(async () => { company = await buildCompany(input, userId, session); });
      return company;
    } finally { await session.endSession(); }
  }
  const slug = await generateUniqueSlug(input.name, (candidate) => Company.exists({ slug: candidate }));
  let company;
  try {
    company = await Company.create({ ...input, slug, owner: userId, verificationStatus: 'pending', isActive: true, teamMembers: [{ recruiter: userId, role: 'owner', permissions: OWNER_PERMISSIONS, status: 'active' }] });
    await RecruiterProfile.updateOne({ user: userId }, { $set: { company: company._id, isCompanyOwner: true, permissions: OWNER_PERMISSIONS } });
    return company;
  }
  catch (error) {
    if (company) await Company.deleteOne({ _id: company.id });
    await RecruiterProfile.updateOne({ user: userId }, { $set: { company: null, isCompanyOwner: false, permissions: [] } });
    throw error;
  }
};

export const getRecruiterCompany = async (userId) => {
  const profile = await RecruiterProfile.findOne({ user: userId });
  const company = profile?.company ? await Company.findById(profile.company).populate('teamMembers.recruiter', 'fullName email role avatar') : null;
  if (!company) throw new AppError('Company not found', 404);
  return company;
};

export const updateCompany = async (company, input) => {
  const nameChanged = input.name && input.name !== company.name;
  Object.entries(input).forEach(([key, value]) => company.set(key, value));
  if (nameChanged) company.slug = await generateUniqueSlug(input.name, (slug) => Company.exists({ slug, _id: { $ne: company.id } }));
  await company.save(); return company;
};

export const getPublicCompany = async (companyId) => {
  const company = await Company.findOne({ _id: companyId, verificationStatus: 'verified', isActive: true }).select('-teamMembers -verificationNotes -verifiedBy -owner');
  if (!company) throw new AppError('Company not found', 404);
  return company;
};

export const searchCompanies = async (query) => {
  const filter = { verificationStatus: 'verified', isActive: true };
  const conditions = [];
  if (query.search) conditions.push({ $or: [{ name: createSafeRegex(query.search) }, { description: createSafeRegex(query.search) }] });
  if (query.industry) filter.industry = createSafeRegex(query.industry);
  if (query.companySize) filter.companySize = query.companySize;
  if (query.location) { const regex = createSafeRegex(query.location); conditions.push({ $or: [{ 'headquarters.city': regex }, { 'headquarters.country': regex }, { 'locations.city': regex }, { 'locations.country': regex }] }); }
  if (query.technologies?.length) filter.technologies = { $all: query.technologies.map(createSafeRegex) };
  if (conditions.length) filter.$and = conditions;
  const sorts = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, 'name-asc': { name: 1 }, 'name-desc': { name: -1 } };
  const [companies, total] = await Promise.all([
    Company.find(filter).select('name slug description website logo logoDocument industry companySize headquarters locations technologies benefits socialLinks createdAt').sort(sorts[query.sort]).skip((query.page - 1) * query.limit).limit(query.limit),
    Company.countDocuments(filter),
  ]);
  return { companies, pagination: buildPagination(query.page, query.limit, total) };
};

export const addTeamMember = async (company, input) => {
  const user = await User.findOne({ _id: input.recruiterId, role: USER_ROLES.RECRUITER }).select('+isActive');
  const profile = user ? await RecruiterProfile.findOne({ user: user.id }) : null;
  if (!user?.isActive || !profile?.isApproved) throw new AppError('Approved recruiter not found', 404);
  if (profile.company && !profile.company.equals(company.id)) throw new AppError('Recruiter already belongs to another company', 409);
  const existing = company.teamMembers.find((member) => member.recruiter.equals(user.id));
  if (existing && existing.status !== 'removed') throw new AppError('Recruiter is already a team member', 409);
  if (existing) { existing.role = input.role; existing.permissions = input.permissions; existing.status = 'active'; existing.joinedAt = new Date(); }
  else company.teamMembers.push({ recruiter: user.id, role: input.role, permissions: input.permissions, status: 'active' });
  await company.save();
  await RecruiterProfile.updateOne({ _id: profile.id }, { $set: { company: company.id, permissions: input.permissions, isCompanyOwner: false } });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.COMPANY_TEAM_MEMBER_ADDED, company: String(company.id), recipientIds: [String(user.id)], payload: { companyId: String(company.id), companyName: company.name, recruiterId: String(user.id), actionUrl: '/recruiter/profile' }, deduplicationKey: `company.team-member-added:${company.id}:${user.id}:${existing?.joinedAt?.toISOString() ?? company.updatedAt.toISOString()}` });
  return company.teamMembers.find((member) => member.recruiter.equals(user.id));
};

export const updateTeamMember = async (company, memberId, input) => {
  const member = company.teamMembers.id(memberId);
  if (!member) throw new AppError('Team member not found', 404);
  if (member.recruiter.equals(company.owner)) throw new AppError('Company owner membership cannot be modified', 409);
  member.set(input); await company.save();
  await RecruiterProfile.updateOne({ user: member.recruiter }, { $set: { permissions: member.permissions, company: member.status === 'removed' ? null : company.id } });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.COMPANY_TEAM_PERMISSIONS_UPDATED, company: String(company.id), recipientIds: [String(member.recruiter)], payload: { companyId: String(company.id), companyName: company.name, recruiterId: String(member.recruiter) }, deduplicationKey: `company.team-permissions-updated:${company.id}:${member.id}:${company.updatedAt.toISOString()}` });
  return member;
};

export const removeTeamMember = async (company, memberId) => {
  const member = company.teamMembers.id(memberId);
  if (!member) throw new AppError('Team member not found', 404);
  if (member.recruiter.equals(company.owner)) throw new AppError('Company owner cannot be removed', 409);
  member.status = 'removed'; member.permissions = []; await company.save();
  await RecruiterProfile.updateOne({ user: member.recruiter }, { $set: { company: null, permissions: [], isCompanyOwner: false } });
  await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.COMPANY_TEAM_MEMBER_REMOVED, company: String(company.id), recipientIds: [String(member.recruiter)], payload: { companyId: String(company.id), companyName: company.name, recruiterId: String(member.recruiter) }, deduplicationKey: `company.team-member-removed:${company.id}:${member.id}:${company.updatedAt.toISOString()}` });
};
