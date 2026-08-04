import mongoose from 'mongoose';

const suspiciousSegmentSchema = new mongoose.Schema({
  candidateACode: { type: String, required: true },
  candidateBCode: { type: String, required: true },
  startLineA: { type: Number, default: 0 },
  endLineA: { type: Number, default: 0 },
  startLineB: { type: Number, default: 0 },
  endLineB: { type: Number, default: 0 }
}, { _id: false });

const plagiarismSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  candidateA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  similarityScore: { type: Number, required: true, min: 0, max: 100 },
  detectionMethod: { type: String, enum: ['token', 'ast', 'normalized'], default: 'normalized' },
  suspiciousSegments: { type: [suspiciousSegmentSchema], default: [] }
}, { timestamps: true });

plagiarismSchema.index({ assessment: 1, similarityScore: -1 });

export const AssessmentPlagiarism = mongoose.model('AssessmentPlagiarism', plagiarismSchema);
