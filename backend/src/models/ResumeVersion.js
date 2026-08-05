import mongoose from 'mongoose';

const resumeVersionSchema = new mongoose.Schema({
  resumeProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeProfile', required: true, index: true },
  version: { type: Number, required: true },
  parsedData: { type: mongoose.Schema.Types.Mixed, required: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

resumeVersionSchema.index({ resumeProfile: 1, version: 1 }, { unique: true });

export const ResumeVersion = mongoose.model('ResumeVersion', resumeVersionSchema);
