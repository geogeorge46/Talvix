import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  permissions: [{ type: String, required: true }],
  scopes: [{ type: String, default: ['*'] }],
  inheritance: { type: String }
}, { timestamps: true, versionKey: false });

roleSchema.index({ company: 1, name: 1 }, { unique: true });
export const Role = mongoose.model('Role', roleSchema);
