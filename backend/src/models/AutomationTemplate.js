import mongoose from 'mongoose';

const automationTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  category: { type: String, required: true, index: true },
  workflowGraph: {
    nodes: { type: mongoose.Schema.Types.Mixed, default: [] },
    edges: { type: mongoose.Schema.Types.Mixed, default: [] }
  },
  tags: [{ type: String }]
}, { timestamps: true, versionKey: false });

export const AutomationTemplate = mongoose.model('AutomationTemplate', automationTemplateSchema);
