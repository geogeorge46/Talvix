import mongoose from 'mongoose';

const aiPromptSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, index: true },
  version: { type: Number, required: true, default: 1, index: true },
  template: { type: String, required: true },
  description: { type: String, default: '' },
  requiredVariables: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });

aiPromptSchema.index({ key: 1, version: 1 }, { unique: true });

export const AIPrompt = mongoose.model('AIPrompt', aiPromptSchema);
