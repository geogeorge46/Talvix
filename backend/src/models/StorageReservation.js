import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uploadSession: { type: mongoose.Schema.Types.ObjectId, ref: 'FileUploadSession', required: true, unique: true },
  bytes: { type: Number, min: 1, required: true },
  status: { type: String, enum: ['reserved', 'committed', 'released', 'expired'], default: 'reserved', index: true },
  expiresAt: { type: Date, required: true, index: true },
  releasedAt: Date,
  committedAt: Date,
  failureCode: String,
}, { timestamps: true, versionKey: false });

schema.index({ status: 1, expiresAt: 1 });
schema.index({ user: 1, status: 1 });
export const StorageReservation = mongoose.model('StorageReservation', schema);
