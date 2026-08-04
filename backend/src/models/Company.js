import mongoose from 'mongoose';
import { COMPANY_SIZES, COMPANY_VERIFICATION_STATUSES } from '../constants/company.js';

const locationSchema = new mongoose.Schema({ city: String, state: String, country: String }, { _id: false });
const assetSchema = new mongoose.Schema({ url: String, publicId: String }, { _id: false });

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 3000, default: '' },
  website: String, email: { type: String, lowercase: true }, phone: String,
  logo: { type: assetSchema, default: () => ({}) }, banner: { type: assetSchema, default: () => ({}) },
  logoDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  industry: { type: String, trim: true, maxlength: 150, default: '' },
  companySize: { type: String, enum: COMPANY_SIZES }, foundedYear: Number,
  headquarters: { type: locationSchema, default: () => ({}) },
  locations: { type: [locationSchema], default: [] },
  socialLinks: { type: new mongoose.Schema({ linkedin: String, twitter: String, github: String, facebook: String }, { _id: false }), default: () => ({}) },
  benefits: { type: [String], default: [] }, technologies: { type: [String], default: [] },
  verificationStatus: { type: String, enum: COMPANY_VERIFICATION_STATUSES, default: 'pending' },
  verificationNotes: { type: String, maxlength: 2000, default: '' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, verifiedAt: { type: Date, default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  officialEmailDomain: { type: String, lowercase: true, trim: true, default: '' },
  autoApproveDomainMembers: { type: Boolean, default: false },
  resumeDownloadLimit: { type: Number, default: null },
  autoApproveJobs: { type: Boolean, default: false },
  interviewReminderPolicy: { type: [String], default: ['24h', '1h'] },
  offerApprovalWorkflowEnabled: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  teamMembers: { type: Array },
}, { timestamps: true, versionKey: false });

companySchema.index({ name: 'text' });
companySchema.index({ verificationStatus: 1, isActive: 1 });
companySchema.index({ industry: 1, companySize: 1 });
export const Company = mongoose.model('Company', companySchema);
