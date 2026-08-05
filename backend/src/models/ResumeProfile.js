import mongoose from 'mongoose';

const resumeProfileSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  personalInfo: {
    fullName: { type: String, required: true },
    email: String,
    phone: String,
    address: String,
    country: String,
    state: String,
    city: String
  },
  professionalSummary: {
    summary: String,
    objective: String,
    headline: String
  },
  skills: {
    technical: [String],
    frameworks: [String],
    languages: [String],
    databases: [String],
    cloud: [String],
    devops: [String],
    tools: [String],
    soft: [String]
  },
  experience: [{
    company: String,
    position: String,
    startDate: Date,
    endDate: Date,
    durationMonths: Number,
    employmentType: String,
    responsibilities: [String],
    technologies: [String],
    achievements: [String]
  }],
  education: [{
    degree: String,
    university: String,
    branch: String,
    cgpa: Number,
    percentage: Number,
    graduationYear: Number
  }],
  projects: [{
    title: String,
    description: String,
    techStack: [String],
    github: String,
    liveUrl: String,
    durationMonths: Number,
    role: String
  }],
  certifications: [{
    name: String,
    provider: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String
  }],
  languages: [{
    language: String,
    proficiency: String
  }],
  links: {
    github: String,
    linkedin: String,
    portfolio: String,
    leetcode: String,
    hackerrank: String,
    kaggle: String
  },
  metrics: {
    resumeScore: { type: Number, default: 0 },
    technicalScore: { type: Number, default: 0 },
    atsScore: { type: Number, default: 0 },
    experienceLevel: String,
    careerLevel: String,
    confidenceScore: { type: Number, default: 0 }
  },
  embeddingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeEmbedding' },
  searchTokens: [String],
  currentVersion: { type: Number, default: 1 }
}, { timestamps: true, versionKey: false });

resumeProfileSchema.index({ 'personalInfo.fullName': 'text', searchTokens: 'text' });

export const ResumeProfile = mongoose.model('ResumeProfile', resumeProfileSchema);
