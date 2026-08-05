import mongoose from 'mongoose';

const resumeReviewSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  version: { type: Number, default: 1 },
  atsScore: { type: Number, min: 0, max: 100, required: true },
  grammarScore: { type: Number, min: 0, max: 100, required: true },
  formattingScore: { type: Number, min: 0, max: 100, required: true },
  technicalScore: { type: Number, min: 0, max: 100, required: true },
  projectScore: { type: Number, min: 0, max: 100, required: true },
  overallScore: { type: Number, min: 0, max: 100, required: true },
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  recommendations: [{ type: String }],
  missingKeywords: [{ type: String }],
  missingSections: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

resumeReviewSchema.index({ company: 1, candidate: 1 });
export const ResumeReview = mongoose.model('ResumeReview', resumeReviewSchema);
