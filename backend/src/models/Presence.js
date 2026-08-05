import mongoose from 'mongoose';

const presenceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  status: { type: String, enum: ['online', 'offline', 'away', 'busy'], default: 'offline' },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true, versionKey: false });

export const Presence = mongoose.model('Presence', presenceSchema);
