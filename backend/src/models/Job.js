import mongoose from 'mongoose';
import { EMPLOYMENT_TYPES, JOB_STATUSES, PROFICIENCY_LEVELS, WORK_MODES } from '../constants/job.js';

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true }, required: { type: Boolean, default: true },
  minimumProficiency: { type: String, enum: PROFICIENCY_LEVELS, default: 'beginner' },
  minimumYearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
  weight: { type: Number, min: 1, max: 100, required: true },
});
const questionSchema = new mongoose.Schema({
  question: { type: String, required: true }, type: { type: String, enum: ['text', 'textarea', 'number', 'boolean', 'single-choice', 'multiple-choice'], required: true },
  required: { type: Boolean, default: false }, options: { type: [String], default: [] },
});
const jobIntelligenceSchema = new mongoose.Schema({
  schemaVersion: { type: Number, default: 1 },
  promptVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['none', 'pending', 'completed', 'failed', 'stale'], default: 'none' },
  extractedAt: { type: Date, default: null },
  contentHash: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: '' }
}, { _id: false });

const jobQualitySchema = new mongoose.Schema({
  schemaVersion: { type: Number, default: 1 },
  promptVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['none', 'pending', 'completed', 'failed', 'stale'], default: 'none' },
  analyzedAt: { type: Date, default: null },
  contentHash: { type: String, default: '' },
  overallScore: { type: Number, min: 0, max: 100, default: 0 },
  categoryScores: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  findings: { type: Array, default: [] },
  summary: { type: String, default: '' },
  error: { type: String, default: '' }
}, { _id: false });

const jobBlueprintSchema = new mongoose.Schema({
  schemaVersion: { type: Number, default: 1 },
  promptVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['none', 'pending', 'proposed', 'approved', 'stale', 'converted', 'failed'], default: 'none' },
  generatedAt: { type: Date, default: null },
  contentHash: { type: String, default: '' },
  data: { type: mongoose.Schema.Types.Mixed, default: null },
  convertedAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', default: null },
  error: { type: String, default: '' }
}, { _id: false });

const jobSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 150 }, slug: { type: String, required: true },
  department: { type: String, trim: true, default: '' },
  hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  description: { type: String, required: true, trim: true, maxlength: 10000 },
  responsibilities: { type: [String], default: [] }, requirements: { type: [String], default: [] }, preferredQualifications: { type: [String], default: [] },
  skills: { type: [skillSchema], default: [] }, employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
  workMode: { type: String, enum: WORK_MODES, required: true },
  location: { type: new mongoose.Schema({ city: String, state: String, country: String }, { _id: false }), default: () => ({}) },
  salary: { type: new mongoose.Schema({ minimum: Number, maximum: Number, currency: String, period: { type: String, enum: ['hourly', 'monthly', 'yearly'] }, isVisible: { type: Boolean, default: true } }, { _id: false }), default: () => ({}) },
  minimumExperience: { type: Number, min: 0, max: 60, default: 0 }, maximumExperience: { type: Number, min: 0, max: 60 },
  educationRequirements: { type: [String], default: [] }, openings: { type: Number, min: 1, default: 1 }, applicationDeadline: Date,
  scheduledPublishAt: Date,
  applicationQuestions: { type: [questionSchema], default: [] }, assessmentRequired: { type: Boolean, default: false },
  resumeRequired: { type: Boolean, default: true }, minimumProfileCompletion: { type: Number, min: 0, max: 100, default: 0 },
  status: { type: String, enum: JOB_STATUSES, default: 'draft' }, rejectionReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, reviewedAt: { type: Date, default: null },
  publishedAt: Date, closedAt: Date, closedReason: { type: String, default: '' }, viewsCount: { type: Number, default: 0 }, applicationsCount: { type: Number, default: 0 }, hiredCount: { type: Number, default: 0, min: 0 }, isFeatured: { type: Boolean, default: false },
  intelligence: { type: jobIntelligenceSchema, default: () => ({ status: 'none', schemaVersion: 1, promptVersion: 1, extractedAt: null, contentHash: '', data: null, error: '' }) },
  quality: { type: jobQualitySchema, default: () => ({ status: 'none', schemaVersion: 1, promptVersion: 1, analyzedAt: null, contentHash: '', overallScore: 0, categoryScores: {}, findings: [], summary: '', error: '' }) },
  blueprint: { type: jobBlueprintSchema, default: () => ({ status: 'none', schemaVersion: 1, promptVersion: 1, generatedAt: null, contentHash: '', data: null, convertedAssessmentId: null, error: '' }) }
}, { timestamps: true, versionKey: false });

jobSchema.index({ company: 1, slug: 1 }, { unique: true });
jobSchema.index({ company: 1, status: 1, createdAt: -1 });
jobSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
jobSchema.index({ status: 1, publishedAt: -1 });
jobSchema.index({ employmentType: 1, workMode: 1 });
jobSchema.index({ 'skills.name': 1 }); jobSchema.index({ 'location.city': 1, 'location.country': 1 });
jobSchema.index({ applicationDeadline: 1 }); jobSchema.index({ title: 'text', description: 'text' });
export const Job = mongoose.model('Job', jobSchema);
