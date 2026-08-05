import mongoose from 'mongoose';

const jobVersionSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  version: { type: Number, required: true },
  parsedData: { type: mongoose.Schema.Types.Mixed, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

jobVersionSchema.index({ job: 1, version: 1 }, { unique: true });

export const JobVersion = mongoose.model('JobVersion', jobVersionSchema);
