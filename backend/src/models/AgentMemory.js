import mongoose from 'mongoose';

const agentMemorySchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  context: { type: String, default: '' },
  preferences: { type: mongoose.Schema.Types.Mixed, default: {} },
  recentActions: [{ type: String }],
  embeddings: [{ type: Number }]
}, { timestamps: true, versionKey: false });

export const AgentMemory = mongoose.model('AgentMemory', agentMemorySchema);
