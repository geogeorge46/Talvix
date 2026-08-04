import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 100 },
  type: { type: String, enum: ['mcq', 'coding', 'sql', 'debugging', 'output-prediction', 'file-upload'], required: true },
  questionCount: { type: Number, required: true, min: 1, max: 100 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], default: 'mixed' },
  skills: [{ type: String }]
}, { _id: false });

const blueprintSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, maxlength: 200 },
  description: { type: String, maxlength: 2000, default: '' },
  sections: { type: [sectionSchema], default: [] },
  defaultDuration: { type: Number, required: true, min: 1, max: 1440, default: 60 },
  passingScore: { type: Number, required: true, min: 1, max: 100, default: 50 },
  settings: {
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    showResultImmediately: { type: Boolean, default: false },
    allowBackNavigation: { type: Boolean, default: true }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

blueprintSchema.index({ company: 1, name: 1 });

export const AssessmentBlueprint = mongoose.model('AssessmentBlueprint', blueprintSchema);
