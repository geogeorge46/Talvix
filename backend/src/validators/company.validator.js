import mongoose from 'mongoose';
import { z } from 'zod';
import { COMPANY_SIZES } from '../constants/company.js';
import { RECRUITER_PERMISSIONS } from '../constants/permissions.js';

const currentYear = new Date().getUTCFullYear();
const objectId = z.string().refine((value) => mongoose.isObjectIdOrHexString(value), 'Invalid MongoDB ObjectId');
const text = (max) => z.string().trim().max(max);
const location = z.object({ city: text(100).optional(), state: text(100).optional(), country: text(100).optional() }).strict();
const publicFields = {
  name: text(150).min(1), description: text(3000).optional(), website: z.url().optional(), email: z.email().optional(),
  phone: z.string().trim().regex(/^[+()\-\s\d]{7,20}$/).optional(), industry: text(150).optional(),
  companySize: z.enum(COMPANY_SIZES).optional(), foundedYear: z.number().int().min(1800).max(currentYear).optional(),
  headquarters: location.optional(), locations: z.array(location).max(20).optional(),
  logo: z.object({ url: z.url(), publicId: text(255).optional() }).strict().optional(),
  banner: z.object({ url: z.url(), publicId: text(255).optional() }).strict().optional(),
  socialLinks: z.object({ linkedin: z.url().optional(), twitter: z.url().optional(), github: z.url().optional(), facebook: z.url().optional() }).strict().optional(),
  benefits: z.array(text(150).min(1)).max(50).optional(), technologies: z.array(text(100).min(1)).max(100).optional(),
  officialEmailDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/, 'Invalid domain format').optional(),
  autoApproveDomainMembers: z.boolean().optional(),
};
export const companyCreateSchema = z.object(publicFields).strict();
export const companyUpdateSchema = z.object(publicFields).partial().strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required');
export const companyIdParamsSchema = z.object({ companyId: objectId }).strict();
export const teamMemberParamsSchema = z.object({ memberId: objectId }).strict();
export const addTeamMemberSchema = z.object({ recruiterId: objectId, role: text(100).min(1).default('recruiter'), permissions: z.array(z.enum(RECRUITER_PERMISSIONS)).max(RECRUITER_PERMISSIONS.length).default([]), department: text(100).optional() }).strict();
export const updateTeamMemberSchema = z.object({ role: text(100).min(1).optional(), permissions: z.array(z.enum(RECRUITER_PERMISSIONS)).max(RECRUITER_PERMISSIONS.length).optional(), status: z.enum(['active', 'suspended', 'removed']).optional(), department: text(100).optional() }).strict().refine((data) => Object.keys(data).length > 0, 'At least one field is required');
export const companyAdminActionSchema = z.object({ notes: text(2000).optional() }).strict();
export const companySearchSchema = z.object({
  page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().positive().max(50).default(10),
  search: text(100).optional(), industry: text(150).optional(), companySize: z.enum(COMPANY_SIZES).optional(),
  location: text(120).optional(), technologies: z.string().trim().max(500).optional().transform((v) => v?.split(',').map((x) => x.trim()).filter(Boolean)),
  sort: z.enum(['newest', 'oldest', 'name-asc', 'name-desc']).default('newest'),
}).strict();

export const inviteRecruiterSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  role: z.enum(['primary_admin', 'hr_admin', 'recruiter', 'hiring_manager']).default('recruiter'),
  permissions: z.array(z.enum(RECRUITER_PERMISSIONS)).max(RECRUITER_PERMISSIONS.length).default([]),
}).strict();

export const claimCompanySchema = z.object({
  officialEmail: z.string().trim().email('Invalid official email'),
  linkedinUrl: z.string().trim().url('Invalid LinkedIn URL'),
  proofUrl: z.string().trim().url('Invalid proof URL').optional().or(z.literal('')),
  companyWebsite: z.string().trim().url('Invalid company website').optional().or(z.literal('')),
  businessRegistration: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
  uploadedDocuments: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid document ID')).optional(),
  claimantNotes: z.string().trim().max(2000).optional(),
}).strict();

export const reviewClaimSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: text(2000).optional(),
}).strict();

export const reviewJoinRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: text(2000).optional(),
}).strict();

