import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true, index: true },
  scopes: [{ type: String, default: ['*'] }],
  expiresAt: { type: Date },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

export const APIKey = mongoose.model('APIKey', apiKeySchema);
