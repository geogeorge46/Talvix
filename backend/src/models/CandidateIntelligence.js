import mongoose from 'mongoose';

const candidateIntelligenceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, default: 1 },
  technicalScore: { type: Number, min: 0, max: 100, required: true },
  communicationScore: { type: Number, min: 0, max: 100, required: true },
  assessmentScore: { type: Number, min: 0, max: 100, required: true },
  resumeScore: { type: Number, min: 0, max: 100, required: true },
  interviewScore: { type: Number, min: 0, max: 100, required: true },
  cultureFit: { type: Number, min: 0, max: 100, required: true },
  learningSpeed: { type: Number, min: 0, max: 100, required: true },
  overallCandidateRating: { type: Number, min: 0, max: 100, required: true },
  hiringReadiness: { type: String, enum: ['ready', 'near-ready', 'needs-training'], required: true },
  expectedSalary: { type: Number, default: 0 },
  expectedNoticePeriodDays: { type: Number, default: 30 },
  hiringRecommendation: { type: String, enum: ['hire', 'strong hire', 'maybe', 'reject'], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

candidateIntelligenceSchema.index({ company: 1, candidate: 1 });
export const CandidateIntelligence = mongoose.model('CandidateIntelligence', candidateIntelligenceSchema);
