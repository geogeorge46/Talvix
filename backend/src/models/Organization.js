import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true, index: true },
  name: { type: String, required: true },
  hierarchy: {
    parentCompany: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    departments: [{ type: String }],
    businessUnits: [{ type: String }],
    costCenters: [{ type: String }]
  },
  branding: {
    logoUrl: { type: String },
    primaryColor: { type: String, default: '#3182CE' }
  },
  settings: {
    sessionTimeoutMs: { type: Number, default: 3600000 },
    allowedIpRanges: [{ type: String }]
  }
}, { timestamps: true, versionKey: false });

export const Organization = mongoose.model('Organization', organizationSchema);
