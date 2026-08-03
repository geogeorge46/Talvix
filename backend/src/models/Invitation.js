import mongoose from 'mongoose';
import { RECRUITER_PERMISSIONS } from '../constants/permissions.js';

const invitationSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['primary_admin', 'hr_admin', 'recruiter', 'hiring_manager'],
      default: 'recruiter',
      required: true,
    },
    permissions: [
      {
        type: String,
        enum: RECRUITER_PERMISSIONS,
      },
    ],
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired', 'revoked'],
      default: 'pending',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

invitationSchema.index({ email: 1, status: 1 });

export const Invitation = mongoose.model('Invitation', invitationSchema);
