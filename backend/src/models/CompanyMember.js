import mongoose from 'mongoose';
import { RECRUITER_PERMISSIONS } from '../constants/permissions.js';

const companyMemberSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      default: 'recruiter',
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: RECRUITER_PERMISSIONS,
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'removed'],
      default: 'pending',
      required: true,
    },
    department: {
      type: String,
      default: '',
    },
    lastActive: {
      type: Date,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Ensure a recruiter has at most one membership record per company
companyMemberSchema.index({ company: 1, recruiter: 1 }, { unique: true });

export const CompanyMember = mongoose.model('CompanyMember', companyMemberSchema);
