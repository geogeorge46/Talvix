import mongoose from 'mongoose';

const aiCacheSchema = new mongoose.Schema({
  cacheKey: { type: String, required: true, unique: true, index: true },
  response: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true }
}, { timestamps: true, versionKey: false });

export const AICache = mongoose.model('AICache', aiCacheSchema);
