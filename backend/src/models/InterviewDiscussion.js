import mongoose from 'mongoose';

const interviewNoteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  isPrivate: { type: Boolean, default: false },
  rating: { type: Number, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const actionItemSchema = new mongoose.Schema({
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  done: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const interviewDiscussionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  interviewSchedule: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSchedule', required: true, index: true },
  notes: { type: [interviewNoteSchema], default: [] },
  actionItems: { type: [actionItemSchema], default: [] },
  aiSummary: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

export const InterviewDiscussion = mongoose.model('InterviewDiscussion', interviewDiscussionSchema);
