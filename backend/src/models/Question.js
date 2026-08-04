import mongoose from 'mongoose';
import { QUESTION_DIFFICULTIES, QUESTION_TYPES, SUPPORTED_CODE_LANGUAGES } from '../constants/assessment.js';

const optionSchema = new mongoose.Schema({ id: { type: String, required: true }, text: { type: String, required: true, maxlength: 2000 } }, { _id: false });
const testCaseSchema = new mongoose.Schema({ input: mongoose.Schema.Types.Mixed, expectedOutput: mongoose.Schema.Types.Mixed, isHidden: { type: Boolean, default: false }, weight: { type: Number, required: true, min: 0.01 } }, { _id: false });
const codingSchema = new mongoose.Schema({ languageSupport: [{ type: String, enum: SUPPORTED_CODE_LANGUAGES }], starterCode: { type: Map, of: String, default: {} }, functionName: { type: String, maxlength: 100 }, testCases: { type: [testCaseSchema], default: [] }, timeLimit: { type: Number, default: 2.0 }, memoryLimit: { type: Number, default: 512000 }, cpuLimit: { type: Number, default: 1.0 }, maxOutputSize: { type: Number, default: 102400 }, maxSourceSize: { type: Number, default: 50000 } }, { _id: false });

const questionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: QUESTION_TYPES, required: true }, title: { type: String, trim: true, maxlength: 200, default: '' }, prompt: { type: String, required: true, maxlength: 10000 }, description: { type: String, maxlength: 10000, default: '' },
  skills: { type: [String], default: [] }, difficulty: { type: String, enum: QUESTION_DIFFICULTIES, required: true }, defaultMarks: { type: Number, required: true, min: 0.01 },
  options: { type: [optionSchema], default: [] }, correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null, select: false }, coding: { type: codingSchema, default: undefined },
  explanation: { type: String, maxlength: 5000, default: '', select: false }, isReusable: { type: Boolean, default: true }, isActive: { type: Boolean, default: true }, usageCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true, versionKey: false });
questionSchema.index({ company: 1, type: 1 }); questionSchema.index({ company: 1, difficulty: 1 }); questionSchema.index({ company: 1, isActive: 1, isReusable: 1 }); questionSchema.index({ skills: 1 }); questionSchema.index({ title: 'text', prompt: 'text' });
export const Question = mongoose.model('Question', questionSchema);
