import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  usedBytes: { type: Number, min: 0, default: 0 },
  reservedBytes: { type: Number, min: 0, default: 0 },
  documentCount: { type: Number, min: 0, default: 0 },
  reservationVersion: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });

export const UserStorageUsage = mongoose.model('UserStorageUsage', schema);
