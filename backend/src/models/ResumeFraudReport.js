import mongoose from 'mongoose';

const fraudReportSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, default: 1 },
  fraudScore: { type: Number, min: 0, max: 100, required: true },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
  confidence: { type: Number, min: 0, max: 100, required: true },
  reasons: [{ type: String }],
  timelineIssues: [{ type: String }],
  duplicateSections: [{ type: String }],
  copiedProjects: [{ type: String }],
  aiProbability: { type: Number, min: 0, max: 100, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

fraudReportSchema.index({ company: 1, candidate: 1 });
export const ResumeFraudReport = mongoose.model('ResumeFraudReport', fraudReportSchema);
