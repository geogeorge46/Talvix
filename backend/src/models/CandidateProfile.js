import mongoose from 'mongoose';

const { Schema } = mongoose;

const locationSchema = new Schema(
  { city: String, state: String, country: String },
  { _id: false },
);

const assetSchema = new Schema(
  { url: String, publicId: String },
  { _id: false },
);

const educationSchema = new Schema({
  institution: { type: String, required: true, trim: true },
  degree: { type: String, required: true, trim: true },
  fieldOfStudy: { type: String, trim: true },
  startYear: { type: Number, required: true },
  endYear: Number,
  currentlyStudying: { type: Boolean, default: false },
  grade: { type: String, trim: true },
  description: { type: String, trim: true },
});

const skillSchema = new Schema({
  name: { type: String, required: true, trim: true },
  proficiency: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true,
  },
  yearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
  verified: { type: Boolean, default: false },
});

const experienceSchema = new Schema({
  company: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  employmentType: {
    type: String,
    enum: ['internship', 'full-time', 'part-time', 'contract', 'freelance'],
  },
  location: { type: String, trim: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  currentlyWorking: { type: Boolean, default: false },
  description: { type: String, trim: true },
  skills: [{ type: String, trim: true }],
});

const projectSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  technologies: [{ type: String, trim: true }],
  githubUrl: String,
  liveUrl: String,
  startDate: Date,
  endDate: Date,
});

const certificationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  issuingOrganization: { type: String, required: true, trim: true },
  issueDate: Date,
  expirationDate: Date,
  credentialId: { type: String, trim: true },
  credentialUrl: String,
});

const candidateProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    headline: { type: String, trim: true, maxlength: 120, default: '' },
    bio: { type: String, trim: true, maxlength: 1500, default: '' },
    phone: { type: String, trim: true, default: '' },
    location: { type: locationSchema, default: () => ({}) },
    dateOfBirth: Date,
    gender: { type: String, enum: ['female', 'male', 'non-binary', 'prefer-not-to-say'] },
    profilePhoto: { type: assetSchema, default: () => ({}) },
    profilePhotoDocument: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    resume: {
      type: new Schema(
        { url: String, publicId: String, fileName: String, uploadedAt: Date },
        { _id: false },
      ),
      default: () => ({}),
    },
    resumeDocument: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    education: { type: [educationSchema], default: [] },
    skills: { type: [skillSchema], default: [] },
    experience: { type: [experienceSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    socialLinks: {
      type: new Schema({ github: String, linkedin: String, portfolio: String }, { _id: false }),
      default: () => ({}),
    },
    preferredRoles: { type: [String], default: [] },
    preferredJobTypes: {
      type: [{ type: String, enum: ['internship', 'full-time', 'part-time', 'contract', 'freelance'] }],
      default: [],
    },
    preferredLocations: { type: [String], default: [] },
    expectedSalary: {
      type: new Schema(
        { minimum: { type: Number, min: 0 }, maximum: { type: Number, min: 0 }, currency: String },
        { _id: false },
      ),
      default: () => ({}),
    },
    availability: {
      type: String,
      enum: ['immediately', 'notice-period', 'unavailable'],
      default: 'unavailable',
    },
    noticePeriodDays: { type: Number, min: 0, max: 365, default: 0 },
    profileVisibility: {
      type: String,
      enum: ['public', 'recruiters-only', 'private'],
      default: 'recruiters-only',
    },
    profileCompletion: { type: Number, min: 0, max: 100, default: 0 },
    applicationBlocked: { type: Boolean, default: false, select: false },
  },
  { timestamps: true, versionKey: false },
);

candidateProfileSchema.index({ profileVisibility: 1, profileCompletion: -1 });
candidateProfileSchema.index({ "education.institution": 1, "education.fieldOfStudy": 1 });
candidateProfileSchema.index({ profileCompletion: 1 });
candidateProfileSchema.index({ 'skills.name': 1 });
candidateProfileSchema.index({ 'location.city': 1, 'location.country': 1 });
candidateProfileSchema.index({ preferredRoles: 1 });
candidateProfileSchema.index({ preferredJobTypes: 1 });
candidateProfileSchema.index({ availability: 1 });

export const CandidateProfile = mongoose.model('CandidateProfile', candidateProfileSchema);
