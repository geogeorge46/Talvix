import mongoose from 'mongoose';

const companyTagSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 50 },
  color: { type: String, default: '#6366F1' }
}, { timestamps: true, versionKey: false });

companyTagSchema.index({ company: 1, name: 1 }, { unique: true });

export const CompanyTag = mongoose.model('CompanyTag', companyTagSchema);
