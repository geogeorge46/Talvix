import mongoose from 'mongoose';

const hrisIntegrationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  provider: { type: String, enum: ['workday', 'bamboohr', 'successfactors', 'oraclehcm'], required: true },
  status: { type: String, enum: ['connected', 'failed', 'syncing', 'disconnected'], default: 'disconnected' },
  credentials: {
    apiKey: { type: String },
    apiSecret: { type: String },
    tenantId: { type: String },
    subdomain: { type: String }
  },
  lastSyncedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

hrisIntegrationSchema.index({ company: 1, provider: 1 }, { unique: true });
export const HRISIntegration = mongoose.model('HRISIntegration', hrisIntegrationSchema);
