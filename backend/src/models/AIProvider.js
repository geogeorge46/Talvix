import mongoose from 'mongoose';

const aiProviderSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  isPrimary: { type: Boolean, default: false },
  apiKey: { type: String, select: false },
  baseUrl: { type: String },
  supportedModels: { type: [String], default: [] },
  costPerInputToken: { type: Number, default: 0 },
  costPerOutputToken: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

export const AIProvider = mongoose.model('AIProvider', aiProviderSchema);
