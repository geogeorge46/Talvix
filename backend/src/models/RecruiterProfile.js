import mongoose from 'mongoose';
import { RECRUITER_PERMISSIONS } from '../constants/permissions.js';

const recruiterProfileSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true, default: null },
  designation: { type: String, trim: true, maxlength: 150, default: '' },
  department: { type: String, trim: true, maxlength: 150, default: '' },
  phone: { type: String, trim: true, default: '' },
  profilePhoto: { type: new mongoose.Schema({ url: String, publicId: String }, { _id: false }), default: () => ({}) },
  profilePhotoDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  linkedinUrl: { type: String, default: '' },
  bio: { type: String, trim: true, maxlength: 1000, default: '' },
  isCompanyOwner: { type: Boolean, default: false },
  permissions: [{ type: String, enum: RECRUITER_PERMISSIONS }],
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

recruiterProfileSchema.index({ isApproved: 1, createdAt: 1 });
export const RecruiterProfile = mongoose.model('RecruiterProfile', recruiterProfileSchema);
