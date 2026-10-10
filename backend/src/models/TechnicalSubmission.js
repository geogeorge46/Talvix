import mongoose from 'mongoose';

const technicalSubmissionSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentAssignment', required: true },
    attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentAttempt', required: true, index: true },
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['coding', 'debugging', 'sql', 'work-sample'], required: true },
    subtype: {
      type: String,
      enum: ['system-design', 'mini-project', 'repository-task', 'ui-implementation', 'testing-task', 'data-analysis', 'case-study'],
      default: undefined,
    },
    language: { type: String, default: 'javascript' },
    sourceCode: { type: String, default: '' },
    originalSourceCode: { type: String, default: '' },
    sqlQuery: { type: String, default: '' },
    bugCategory: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'running', 'evaluated', 'submitted', 'review-pending', 'failed'],
      default: 'draft',
    },
    execution: {
      status: { type: String, default: 'idle' },
      passedTests: { type: Number, default: 0 },
      totalTests: { type: Number, default: 0 },
      runtimeMs: { type: Number, default: 0 },
      memoryKb: { type: Number, default: 0 },
      compileError: { type: String, default: '' },
      runtimeError: { type: String, default: '' },
      testResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    grading: {
      functionalScore: { type: Number, default: 0 },
      performanceScore: { type: Number, default: 0 },
      edgeCaseScore: { type: Number, default: 0 },
      finalScore: { type: Number, default: 0 },
    },
    systemDesign: {
      nodes: { type: [mongoose.Schema.Types.Mixed], default: [] },
      edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
      databaseSchema: { type: [mongoose.Schema.Types.Mixed], default: [] },
      apis: { type: [mongoose.Schema.Types.Mixed], default: [] },
      explanation: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    workSample: {
      submissionType: { type: String, enum: ['github', 'zip', 'url', 'file', 'text'], default: undefined },
      repositoryUrl: { type: String, default: '' },
      branch: { type: String, default: '' },
      hostedUrl: { type: String, default: '' },
      fileUrl: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      textResponse: { type: String, default: '' },
    },
    review: {
      status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
      reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      rubricScores: { type: [mongoose.Schema.Types.Mixed], default: [] },
      totalScore: { type: Number, default: null },
      notes: { type: String, default: '' },
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

technicalSubmissionSchema.index({ attempt: 1, question: 1 }, { unique: true });
technicalSubmissionSchema.index({ candidate: 1, attempt: 1 });
technicalSubmissionSchema.index({ assessment: 1 });

export const TechnicalSubmission = mongoose.model('TechnicalSubmission', technicalSubmissionSchema);
