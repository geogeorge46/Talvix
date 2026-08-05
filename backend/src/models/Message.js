import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  attachments: [{
    fileName: String,
    url: String,
    mimeType: String,
    sizeBytes: Number
  }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

messageSchema.index({ conversation: 1, createdAt: -1 });
export const Message = mongoose.model('Message', messageSchema);
