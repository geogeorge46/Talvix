import mongoose from 'mongoose';

const workflowNodeExecutionSchema = new mongoose.Schema({
  workflowExecution: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowExecution', required: true, index: true },
  nodeId: { type: String, required: true, index: true },
  status: { type: String, enum: ['success', 'failed', 'running', 'skipped'], default: 'running' },
  inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  outputs: { type: mongoose.Schema.Types.Mixed, default: {} },
  retries: { type: Number, default: 0 },
  duration: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

export const WorkflowNodeExecution = mongoose.model('WorkflowNodeExecution', workflowNodeExecutionSchema);
