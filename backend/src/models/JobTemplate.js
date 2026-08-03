import mongoose from 'mongoose';
import { EMPLOYMENT_TYPES, PROFICIENCY_LEVELS, WORK_MODES } from '../constants/job.js';

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  required: { type: Boolean, default: true },
  minimumProficiency: { type: String, enum: PROFICIENCY_LEVELS, default: 'beginner' },
  minimumYearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
  weight: { type: Number, min: 1, max: 100, required: true },
}, { _id: false });

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'number', 'boolean', 'single-choice', 'multiple-choice'], required: true },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
}, { _id: false });

const schema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, default: '' },

  title: { type: String, required: true, trim: true, maxlength: 150 },
  jobDescription: { type: String, trim: true, maxlength: 10000, default: '' },
  responsibilities: { type: [String], default: [] },
  requirements: { type: [String], default: [] },
  preferredQualifications: { type: [String], default: [] },
  skills: { type: [skillSchema], default: [] },
  employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
  workMode: { type: String, enum: WORK_MODES, required: true },
  location: { type: new mongoose.Schema({ city: String, state: String, country: String }, { _id: false }), default: () => ({}) },
  salary: { type: new mongoose.Schema({ minimum: Number, maximum: Number, currency: String, period: { type: String, enum: ['hourly', 'monthly', 'yearly'] }, isVisible: { type: Boolean, default: true } }, { _id: false }), default: () => ({}) },
  minimumExperience: { type: Number, min: 0, max: 60, default: 0 },
  maximumExperience: { type: Number, min: 0, max: 60 },
  educationRequirements: { type: [String], default: [] },
  applicationQuestions: { type: [questionSchema], default: [] },
  assessmentRequired: { type: Boolean, default: false },
  resumeRequired: { type: Boolean, default: true },
  minimumProfileCompletion: { type: Number, min: 0, max: 100, default: 0 },
  department: { type: String, trim: true, default: '' },

  isActive: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

schema.index({ company: 1, isActive: 1 });
schema.index({ name: 'text', title: 'text' });

export const JobTemplate = mongoose.model('JobTemplate', schema);
