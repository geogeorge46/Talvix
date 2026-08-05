import mongoose from 'mongoose';

const resumeEmbeddingSchema = new mongoose.Schema({
  resumeProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeProfile', required: true, index: true },
  version: { type: Number, required: true },
  vector: { type: [Number], required: true }, // Store embedding coordinates
  dimensions: { type: Number, default: 768 }
}, { timestamps: true, versionKey: false });

resumeEmbeddingSchema.index({ resumeProfile: 1, version: 1 }, { unique: true });

export const ResumeEmbedding = mongoose.model('ResumeEmbedding', resumeEmbeddingSchema);
