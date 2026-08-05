import mongoose from 'mongoose';

const tenantQuotaSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
  aiTokens: { type: Number, default: 1000000 },
  apiRequests: { type: Number, default: 50000 },
  storage: { type: Number, default: 53687091200 }, // 50GB in bytes
  users: { type: Number, default: 50 }
}, { timestamps: true, versionKey: false });

export const TenantQuota = mongoose.model('TenantQuota', tenantQuotaSchema);
