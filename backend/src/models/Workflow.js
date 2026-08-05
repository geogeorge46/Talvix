import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  trigger: { type: String, required: true, index: true },
  nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
  edges: { type: mongoose.Schema.Types.Mixed, default: [] },
  activeVersion: { type: Number, default: 1 },
  published: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'draft', 'archived'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

export const Workflow = mongoose.model('Workflow', workflowSchema);
