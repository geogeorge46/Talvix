import mongoose from 'mongoose';

const jobIntelligenceSchema = new mongoose.Schema({
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, unique: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  skills: {
    required: [String],
    preferred: [String],
    soft: [String]
  },
  responsibilities: [String],
  experience: {
    minYears: Number,
    maxYears: Number,
    preferredDescription: String
  },
  education: {
    degrees: [String],
    branches: [String],
    preferredDescription: String
  },
  certifications: [String],
  languages: [{
    language: String,
    proficiency: String
  }],
  industry: String,
  employmentType: String,
  location: {
    country: String,
    state: String,
    city: String,
    type: { type: String, enum: ['onsite', 'remote', 'hybrid'] }
  },
  salaryRange: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'USD' }
  },
  benefits: [String],
  hiringSummary: String,
  riskFlags: [{
    category: String,
    message: String,
    severity: { type: String, enum: ['low', 'medium', 'high'] }
  }],
  searchTokens: [String],
  currentVersion: { type: Number, default: 1 }
}, { timestamps: true, versionKey: false });

jobIntelligenceSchema.index({ searchTokens: 'text' });

export const JobIntelligence = mongoose.model('JobIntelligence', jobIntelligenceSchema);
