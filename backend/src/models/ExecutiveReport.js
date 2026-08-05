import mongoose from 'mongoose';

const executiveReportSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  snapshotDate: { type: Date, required: true, index: true },
  version: { type: Number, default: 1 },
  reportType: { type: String, enum: ['weekly', 'monthly', 'quarterly'], default: 'monthly' },
  aiSummary: { type: String, required: true },
  forecasts: {
    predictedHiringDemand: { type: Number, default: 0 },
    expectedCompletionDays: { type: Number, default: 0 },
    budgetForecastUSD: { type: Number, default: 0 }
  },
  riskAlerts: [{ type: String }],
  recommendations: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

executiveReportSchema.index({ company: 1, reportType: 1, snapshotDate: -1 });
export const ExecutiveReport = mongoose.model('ExecutiveReport', executiveReportSchema);
