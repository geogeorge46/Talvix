import mongoose from 'mongoose';

const jobEmbeddingSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
  version: { type: Number, required: true },
  vector: { type: [Number], required: true },
  dimensions: { type: Number, default: 768 }
}, { timestamps: true, versionKey: false });

jobEmbeddingSchema.index({ job: 1, version: 1 }, { unique: true });

export const JobEmbedding = mongoose.model('JobEmbedding', jobEmbeddingSchema);
