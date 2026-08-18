import mongoose from 'mongoose';

const companyVerificationHistorySchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  action: { type: String, enum: [
    'submitted', 'resubmitted', 'verified', 'rejected', 'suspended', 'restored',
    'verification.submitted', 'verification.resubmitted', 'verification.approved',
    'verification.rejected', 'verification.suspended', 'verification.restored',
    'company.updated'
  ], required: true },
  previousStatus: { type: String, default: 'none' },
  newStatus: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performedByName: { type: String, required: true },
  reason: { type: String, default: '' },
  notes: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
}, { versionKey: false });

companyVerificationHistorySchema.index({ companyId: 1, timestamp: -1 });

export const CompanyVerificationHistory = mongoose.model('CompanyVerificationHistory', companyVerificationHistorySchema);
