import mongoose from 'mongoose';

const analyticsSnapshotSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  snapshotDate: { type: Date, required: true, index: true },
  version: { type: Number, default: 1 },
  funnel: {
    applied: { type: Number, default: 0 },
    screened: { type: Number, default: 0 },
    interviewed: { type: Number, default: 0 },
    offers: { type: Number, default: 0 },
    hired: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 }
  },
  metrics: {
    timeToHireDays: { type: Number, default: 0 },
    offerAcceptanceRate: { type: Number, default: 0 },
    assessmentCompletionRate: { type: Number, default: 0 },
    recruiterProductivityScore: { type: Number, default: 0 }
  },
  aiSpending: {
    totalTokens: { type: Number, default: 0 },
    totalCostUSD: { type: Number, default: 0 }
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

analyticsSnapshotSchema.index({ company: 1, snapshotDate: -1 });
export const AnalyticsSnapshot = mongoose.model('AnalyticsSnapshot', analyticsSnapshotSchema);
