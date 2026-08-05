import mongoose from 'mongoose';

const workflowExecutionSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  trigger: { type: String, required: true },
  status: { type: String, enum: ['running', 'completed', 'failed', 'retrying'], default: 'running', index: true },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  executionLog: [{ type: String }],
  duration: { type: Number, default: 0 },
  tokenUsage: { type: Number, default: 0 },
  aiCost: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

export const WorkflowExecution = mongoose.model('WorkflowExecution', workflowExecutionSchema);
