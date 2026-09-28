import mongoose from 'mongoose'; import { CANDIDATE_RESPONSES, INTERVIEW_MODES, MEETING_PROVIDERS, SCHEDULE_STATUSES } from '../constants/interview.js';
const location=new mongoose.Schema({name:String,address:String,city:String,state:String,country:String,instructions:String},{_id:false}); const prior=new mongoose.Schema({startTime:Date,endTime:Date,timezone:String,mode:String,meetingProvider:String,meetingUrl:String,meetingId:String,location,changedBy:mongoose.Schema.Types.ObjectId,reason:String,changedAt:{type:Date,default:Date.now}},{_id:false});
const rescheduleItem = new mongoose.Schema({
  previousScheduledAt: Date,
  newScheduledAt: Date,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  changedAt: { type: Date, default: Date.now }
}, { _id: false });

const schema = new mongoose.Schema({
  process: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewProcess', required: true },
  round: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewRound', required: true, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  interviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timezone: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  scheduledAt: { type: Date },
  endsAt: { type: Date },
  joinWindowMinutes: { type: Number, default: 5 },
  joinAvailableAt: { type: Date },
  durationMinutes: { type: Number, required: true },
  mode: { type: String, enum: INTERVIEW_MODES, required: true, default: 'video' },
  meetingProvider: { type: String, enum: MEETING_PROVIDERS, required: true, default: 'native' },
  meetingUrl: String,
  meetingId: String,
  meetingPassword: { type: String, select: false },
  phoneDetails: { phoneNumber: String, extension: String },
  location,
  candidateInstructions: { type: String, maxlength: 3000 },
  interviewerInstructions: { type: String, maxlength: 3000, select: false },
  status: { type: String, enum: SCHEDULE_STATUSES, default: 'scheduled' },
  startedAt: Date,
  endedAt: Date,
  completedAt: Date,
  candidateJoinedAt: Date,
  interviewerJoinedAt: Date,
  candidateResponse: { type: String, enum: CANDIDATE_RESPONSES, default: 'pending' },
  candidateResponseAt: Date,
  rescheduleRequest: { requestedBy: mongoose.Schema.Types.ObjectId, reason: String, preferredSlots: [{ startTime: Date, endTime: Date }], requestedAt: Date, resolvedAt: Date, resolvedBy: mongoose.Schema.Types.ObjectId },
  rescheduleHistory: [rescheduleItem],
  cancellation: { cancelledBy: mongoose.Schema.Types.ObjectId, reason: String, cancelledAt: Date },
  reminderState: { type: mongoose.Schema.Types.Mixed, default: {} },
  version: { type: Number, min: 1, default: 1 },
  previousSchedules: { type: [prior], default: [] },
  audit: { type: Array, default: [] }
}, { timestamps: true, versionKey: false });

schema.pre('save', function () {
  if (this.startTime && !this.scheduledAt) {
    this.scheduledAt = this.startTime;
  }
  if (this.scheduledAt && !this.startTime) {
    this.startTime = this.scheduledAt;
  }
  if (this.endTime && !this.endsAt) {
    this.endsAt = this.endTime;
  }
  if (this.endsAt && !this.endTime) {
    this.endTime = this.endsAt;
  }
  const schedTime = this.scheduledAt || this.startTime;
  const win = this.joinWindowMinutes || 5;
  if (schedTime) {
    this.joinAvailableAt = new Date(new Date(schedTime).getTime() - win * 60 * 1000);
  }
});


schema.index({ round: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['scheduled', 'proposed', 'confirmed', 'reschedule-requested', 'rescheduled', 'waiting_room', 'in_progress'] } } });
schema.index({ company: 1, startTime: 1 });
schema.index({ company: 1, scheduledBy: 1, status: 1, startTime: -1 });
schema.index({ candidate: 1, startTime: 1 });
schema.index({ interviewers: 1, startTime: 1 });
schema.index({ status: 1 });
schema.index({ candidateResponse: 1 });
schema.index({ startTime: 1 });
schema.index({ endTime: 1 });
schema.index({ company: 1, mode: 1, 'location.name': 1, startTime: 1, endTime: 1 });
schema.post('save', function (doc) {
  if (doc.company) {
    Promise.all([
      import('../services/realtime.service.js'),
      import('../services/recruiterAnalytics.service.js')
    ]).then(([{ broadcastToCompany }, { invalidateAnalyticsCache }]) => {
      broadcastToCompany(doc.company, 'interview_status_update', doc);
      invalidateAnalyticsCache(doc.company);
    }).catch(err => console.error(err));
  }
});

export const InterviewSchedule = mongoose.model('InterviewSchedule', schema);

