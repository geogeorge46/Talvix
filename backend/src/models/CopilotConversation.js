import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['recruiter', 'copilot'],
    required: true
  },
  text: {
    type: String,
    required: true
  },
  intent: {
    type: String,
    default: 'general_chat'
  },
  executionPlan: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const copilotConversationSchema = new mongoose.Schema({
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: 'New Chat Session'
  },
  messages: {
    type: [messageSchema],
    default: []
  },
  pinned: {
    type: Boolean,
    default: false
  },
  metadata: {
    currentJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', default: null },
    favoriteSkills: { type: [String], default: [] },
    recentFilters: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
  }
}, { timestamps: true, versionKey: false });

copilotConversationSchema.index({ recruiter: 1, pinned: -1, updatedAt: -1 });

export const CopilotConversation = mongoose.model('CopilotConversation', copilotConversationSchema);
