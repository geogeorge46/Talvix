import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  provider: { type: String, enum: ['google', 'outlook'], required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  expiryDate: { type: Date },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  errorCount: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });

schema.index({ user: 1, provider: 1 }, { unique: true });

export const CalendarToken = mongoose.model('CalendarToken', schema);
