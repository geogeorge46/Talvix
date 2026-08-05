import mongoose from 'mongoose';

const aiUsageLogSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  providerName: { type: String, required: true, index: true },
  modelName: { type: String, required: true, index: true },
  promptKey: { type: String, default: null, index: true },
  promptVersion: { type: Number, default: null },
  tokensInput: { type: Number, default: 0 },
  tokensOutput: { type: Number, default: 0 },
  cost: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  status: { type: String, enum: ['success', 'failed'], required: true, index: true },
  errorMessage: { type: String, default: '' },
  ipAddress: { type: String, default: 'Unknown' },
  userAgent: { type: String, default: 'Unknown' },
  requestPayload: { type: mongoose.Schema.Types.Mixed, default: null },
  responsePayload: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, versionKey: false });

export const AIUsageLog = mongoose.model('AIUsageLog', aiUsageLogSchema);
