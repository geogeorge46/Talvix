import mongoose from 'mongoose';

const workflowVersionSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  version: { type: Number, required: true },
  graph: {
    nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
    edges: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

export const WorkflowVersion = mongoose.model('WorkflowVersion', workflowVersionSchema);
