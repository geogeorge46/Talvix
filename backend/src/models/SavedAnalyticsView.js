import mongoose from 'mongoose';

const savedAnalyticsViewSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  filters: { type: mongoose.Schema.Types.Mixed, required: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true, versionKey: false });

savedAnalyticsViewSchema.index({ recruiter: 1, name: 1 }, { unique: true });

export const SavedAnalyticsView = mongoose.model('SavedAnalyticsView', savedAnalyticsViewSchema);
