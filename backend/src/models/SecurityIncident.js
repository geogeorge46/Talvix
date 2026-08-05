import mongoose from 'mongoose';

const securityIncidentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  category: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['open', 'investigating', 'resolved'], default: 'open' }
}, { timestamps: true, versionKey: false });

export const SecurityIncident = mongoose.model('SecurityIncident', securityIncidentSchema);
