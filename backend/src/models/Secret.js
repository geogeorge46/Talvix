import mongoose from 'mongoose';

const secretSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  key: { type: String, required: true },
  encryptedValue: { type: String, required: true },
  rotationPolicy: { type: String, enum: ['manual', '30d', '90d'], default: 'manual' },
  expiresAt: { type: Date }
}, { timestamps: true, versionKey: false });

secretSchema.index({ company: 1, key: 1 }, { unique: true });
export const Secret = mongoose.model('Secret', secretSchema);
