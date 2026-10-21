import mongoose from 'mongoose';

const mismatchedFieldSchema = new mongoose.Schema({
  field: { type: String, required: true },
  submitted: { type: String, default: '' },
  registry: { type: String, default: '' }
}, { _id: false });

const riskIndicatorSchema = new mongoose.Schema({
  code: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  description: { type: String, required: true }
}, { _id: false });

const companyRegistryCheckSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  checkType: {
    type: String,
    enum: ['company_registration', 'gst_registration', 'msme_registration', 'domain_risk', 'identity_cross_check'],
    required: true
  },
  provider: { type: String, required: true },
  identifierType: {
    type: String,
    enum: ['cin', 'llpin', 'gstin', 'udyam', 'company_registration', 'unknown'],
    default: 'unknown'
  },
  maskedIdentifier: { type: String, default: '' },
  registryData: { type: mongoose.Schema.Types.Mixed, default: null },
  summary: { type: String, default: '' },
  outcome: {
    type: String,
    enum: ['match', 'mismatch', 'not_found', 'unavailable', 'manual_review_required', 'not_applicable'],
    required: true
  },
  referenceId: { type: String, default: '' },
  matchedFields: { type: [String], default: [] },
  mismatchedFields: { type: [mismatchedFieldSchema], default: [] },
  riskIndicators: { type: [riskIndicatorSchema], default: [] },
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  checkedAt: { type: Date, default: Date.now },
  overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  overriddenAt: { type: Date, default: null },
  overrideReason: { type: String, default: '' },
  status: { type: String, enum: ['active', 'overridden'], default: 'active' }
}, { versionKey: false, timestamps: true });

companyRegistryCheckSchema.index({ companyId: 1, checkedAt: -1 });

export const CompanyRegistryCheck = mongoose.model('CompanyRegistryCheck', companyRegistryCheckSchema);
