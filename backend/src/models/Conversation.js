import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  type: { type: String, enum: ['direct', 'group', 'panel'], default: 'direct' },
  title: { type: String, default: '' },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

conversationSchema.index({ company: 1, participants: 1 });
export const Conversation = mongoose.model('Conversation', conversationSchema);
