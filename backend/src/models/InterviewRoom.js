import mongoose from 'mongoose';

const interviewRoomSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  title: { type: String, required: true },
  interviewSchedule: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSchedule' },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['interviewer', 'candidate', 'observer'] },
    joinedAt: Date,
    leftAt: Date
  }],
  status: { type: String, enum: ['scheduled', 'active', 'completed'], default: 'scheduled' },
  videoUrl: String,
  recordingUrl: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true, versionKey: false });

export const InterviewRoom = mongoose.model('InterviewRoom', interviewRoomSchema);
