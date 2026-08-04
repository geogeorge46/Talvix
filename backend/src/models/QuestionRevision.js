import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
  version: { type: Number, required: true },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  changeLog: { type: String, default: '', maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

revisionSchema.index({ question: 1, version: 1 }, { unique: true });

export const QuestionRevision = mongoose.model('QuestionRevision', revisionSchema);
