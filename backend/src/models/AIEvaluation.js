import mongoose from 'mongoose';

const aiEvaluationSchema = new mongoose.Schema(
  {
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentAttempt', required: true, index: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'TechnicalSubmission', default: null },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['coding', 'debugging', 'sql', 'system-design', 'work-sample'], required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed' },
    error: { type: String, default: '' },
    advisoryScore: { type: Number, min: 0, max: 100, default: 0 },
    confidence: { type: Number, min: 0, max: 100, default: 90 },
    strengths: { type: [String], default: [] },
    vulnerabilities: { type: [String], default: [] },
    edgeCases: { type: [String], default: [] },
    interviewQuestions: { type: [String], default: [] },
    codeQuality: {
      readability: { type: Number, min: 0, max: 10, default: 8 },
      maintainability: { type: Number, min: 0, max: 10, default: 8 },
      timeComplexity: { type: String, default: 'O(N)' },
      spaceComplexity: { type: String, default: 'O(1)' },
    },
    debuggingAnalysis: {
      rootCauseAddressed: { type: Boolean, default: true },
      reasoning: { type: String, default: '' },
    },
    sqlEfficiency: {
      indexUsage: { type: String, default: 'Optimal' },
      queryOptimizationNotes: { type: String, default: '' },
    },
    systemDesignTradeoffs: {
      scalabilityRating: { type: Number, min: 0, max: 10, default: 8 },
      singlePointsOfFailure: { type: [String], default: [] },
    },
    automatedEvidence: {
      totalTests: { type: Number, default: 0 },
      passedTests: { type: Number, default: 0 },
      failedTests: { type: Number, default: 0 },
      score: { type: Number, default: 0 },
      runtimeMs: { type: Number, default: 0 },
      status: { type: String, default: 'completed' },
    },
    securityRisks: { type: [String], default: [] },
    candidateFeedback: { type: String, default: '' },
    recruiterInsight: { type: String, default: '' },
    model: {
      provider: { type: String, default: 'builtin' },
      name: { type: String, default: 'talvix-technical-v1' },
      version: { type: String, default: '1.0' },
    },
    promptVersion: { type: String, default: 'v1.0' },
  },
  { timestamps: true, versionKey: false }
);

aiEvaluationSchema.index({ attempt: 1, question: 1 }, { unique: true });
aiEvaluationSchema.index({ candidate: 1, attempt: 1 });
aiEvaluationSchema.index({ submission: 1 });

export const AIEvaluation = mongoose.model('AIEvaluation', aiEvaluationSchema);
