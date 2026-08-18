import mongoose from 'mongoose';

const recruiterVerificationHistorySchema = new mongoose.Schema({
  recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, enum: ['verification.submitted', 'verification.rejected', 'verification.resubmitted', 'verification.approved', 'verification.suspended', 'verification.restored', 'profile.updated'], required: true },
  previousStatus: { type: String, default: 'none' },
  newStatus: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, required: true },
  reason: { type: String, default: '' },
  notes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { versionKey: false });

recruiterVerificationHistorySchema.index({ recruiterId: 1, timestamp: -1 });

export const RecruiterVerificationHistory = mongoose.model('RecruiterVerificationHistory', recruiterVerificationHistorySchema);
