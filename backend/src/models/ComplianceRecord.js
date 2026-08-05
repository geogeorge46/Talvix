import mongoose from 'mongoose';

const complianceRecordSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  regulation: { type: String, enum: ['gdpr', 'soc2', 'iso27001', 'hipaa'], required: true },
  evidence: { type: String, required: true },
  status: { type: String, enum: ['compliant', 'review_required', 'non_compliant'], default: 'compliant' }
}, { timestamps: true, versionKey: false });

export const ComplianceRecord = mongoose.model('ComplianceRecord', complianceRecordSchema);
