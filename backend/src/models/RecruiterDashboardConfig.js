import mongoose from 'mongoose';

const widgetItemSchema = new mongoose.Schema({
  id: { type: String, required: true },
  visible: { type: Boolean, default: true },
  order: { type: Number, required: true }
}, { _id: false });

const recruiterDashboardConfigSchema = new mongoose.Schema({
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  widgets: { type: [widgetItemSchema], default: [] }
}, { timestamps: true, versionKey: false });

export const RecruiterDashboardConfig = mongoose.model('RecruiterDashboardConfig', recruiterDashboardConfigSchema);
