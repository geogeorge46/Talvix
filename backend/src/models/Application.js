import mongoose from 'mongoose';
import { APPLICATION_SOURCES, APPLICATION_STATUSES, REJECTION_CATEGORIES } from '../constants/application.js';

const historySchema = new mongoose.Schema({ from: String, to: { type: String, enum: APPLICATION_STATUSES, required: true }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, maxlength: 2000, default: '' }, changedAt: { type: Date, default: Date.now }, adminOverride: { type: Boolean, default: false } }, { _id: true });
const noteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, required: true, maxlength: 3000 },
  isPrivate: { type: Boolean, default: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  editHistory: [{ note: String, editedAt: { type: Date, default: Date.now } }],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });
const matchBreakdownSchema = new mongoose.Schema({ skill: String, required: Boolean, candidateProficiency: String, minimumProficiency: String, candidateExperience: Number, minimumExperience: Number, weight: Number, score: Number }, { _id: false });

const applicationSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile', required: true, index: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true }, company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  applicationNumber: { type: String, required: true, unique: true }, status: { type: String, enum: APPLICATION_STATUSES, default: 'submitted' },
  coverLetter: { type: String, maxlength: 5000, default: '' },
  resumeSnapshot: { type: new mongoose.Schema({ url: String, publicId: String, fileName: String, uploadedAt: Date }, { _id: false }), default: () => ({}) },
  resumeDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  candidateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true }, jobSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  answers: { type: [new mongoose.Schema({ questionId: mongoose.Schema.Types.ObjectId, question: String, type: String, answer: mongoose.Schema.Types.Mixed }, { _id: false })], default: [] },
  skillMatch: { type: new mongoose.Schema({ score: { type: Number, min: 0, max: 100 }, matchedSkills: [String], missingRequiredSkills: [String], breakdown: [matchBreakdownSchema] }, { _id: false }), required: true },
  recruiterRating: { type: Number, min: 1, max: 5, default: null }, ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, ratedAt: Date,
  recruiterNotes: { type: [noteSchema], default: [] }, tags: { type: [String], default: [] }, assignedRecruiters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  source: { type: String, enum: APPLICATION_SOURCES, default: 'talvix' }, referral: { type: new mongoose.Schema({ referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, referralCode: String }, { _id: false }), default: () => ({}) },
  withdrawal: { type: new mongoose.Schema({ reason: String, withdrawnAt: Date }, { _id: false }), default: () => ({}) },
  rejection: { type: new mongoose.Schema({ reason: String, category: { type: String, enum: REJECTION_CATEGORIES }, rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, rejectedAt: Date }, { _id: false }), default: () => ({}) },
  submittedAt: { type: Date, default: Date.now }, lastStatusChangedAt: { type: Date, default: Date.now }, lastSnapshotRefreshedAt: Date,
  statusHistory: { type: [historySchema], default: [] }, isArchived: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });

applicationSchema.index({ candidate: 1, job: 1 }, { unique: true });
applicationSchema.index({ company: 1, status: 1 }); applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ candidate: 1, status: 1 }); applicationSchema.index({ submittedAt: -1 });
applicationSchema.index({ assignedRecruiters: 1 }); applicationSchema.index({ tags: 1 });
applicationSchema.index({ recruiterRating: 1 }); applicationSchema.index({ 'skillMatch.score': -1 }); applicationSchema.index({ isArchived: 1 });
applicationSchema.post('save', function(doc) {
  if (doc.company) {
    Promise.all([
      import('../services/realtime.service.js'),
      import('../services/recruiterAnalytics.service.js')
    ]).then(([{ broadcastToCompany }, { invalidateAnalyticsCache }]) => {
      broadcastToCompany(doc.company, 'new_application', doc);
      invalidateAnalyticsCache(doc.company);
    }).catch(err => console.error(err));
  }
});

export const Application = mongoose.model('Application', applicationSchema);
