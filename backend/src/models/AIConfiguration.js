import mongoose from 'mongoose';

const aiConfigurationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, unique: true, index: true },
  primaryProvider: { type: String, required: true, default: 'gemini' },
  fallbackProvider: { type: String, default: null },
  modelMappings: {
    type: Map,
    of: String,
    default: () => ({
      fast: 'gemini-2.5-flash',
      premium: 'gemini-2.5-pro'
    })
  },
  rateLimits: {
    requestsPerMinute: { type: Number, default: 60 },
    tokensPerMinute: { type: Number, default: 100000 }
  },
  cachingEnabled: { type: Boolean, default: true },
  cacheTtlSeconds: { type: Number, default: 3600 },
  retryCount: { type: Number, default: 3 },
  retryBackoffMs: { type: Number, default: 1000 },
  promptInjectionFiltersEnabled: { type: Boolean, default: true },
  allowedPrompts: { type: [String], default: [] }
}, { timestamps: true, versionKey: false });

export const AIConfiguration = mongoose.model('AIConfiguration', aiConfigurationSchema);
