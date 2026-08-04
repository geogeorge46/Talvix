import mongoose from 'mongoose';
import { DECLINE_CATEGORIES, EMPLOYMENT_TYPES, OFFER_STATUSES, WORK_MODES } from '../constants/offer.js';
import { clause, compensationSchema } from './OfferTemplate.js';

const history = new mongoose.Schema({ from: String, to: { type: String, required: true }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, actorRole: String, reason: { type: String, maxlength: 2000, default: '' }, changedAt: { type: Date, default: Date.now }, adminOverride: { type: Boolean, default: false } }, { _id: true });
const offerSchema = new mongoose.Schema({
  offerNumber: { type: String, required: true, unique: true }, chainId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true }, company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true }, job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true }, application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true }, candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, candidateProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateProfile' }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, template: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferTemplate' }, templateSnapshot: { type: mongoose.Schema.Types.Mixed, immutable: true }, revision: { type: Number, min: 1, default: 1 }, parentOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer', default: null }, revisionReason: String,
  title: { type: String, required: true, maxlength: 200 }, department: String, employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true }, workMode: { type: String, enum: WORK_MODES, required: true }, location: { city: String, state: String, country: String, address: String }, joiningDate: Date, reportingTo: { name: String, designation: String, reference: mongoose.Schema.Types.ObjectId }, compensation: { type: compensationSchema, required: true }, benefits: [String], terms: [String], clauses: { type: [clause], default: [] }, probation: { enabled: Boolean, durationMonths: Number, terms: String }, noticePeriod: { employeeDays: Number, employerDays: Number }, validFrom: Date, expiresAt: Date, status: { type: String, enum: OFFER_STATUSES, default: 'draft' },
  approval: { required: { type: Boolean, default: true }, requestedAt: Date, requestedBy: mongoose.Schema.Types.ObjectId, approvedAt: Date, approvedBy: mongoose.Schema.Types.ObjectId, approvalComments: String, rejectedAt: Date, rejectedBy: mongoose.Schema.Types.ObjectId, rejectionReason: String },
  approvalChain: {
    type: [{
      role: { type: String, required: true },
      approver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      comments: String,
      approvedAt: Date
    }],
    default: []
  },
  currentApprovalStep: { type: Number, default: 0 },
  sentAt: Date, sentBy: mongoose.Schema.Types.ObjectId, viewedAt: Date,
  candidateResponse: {
    response: { type: String, enum: ['pending', 'accepted', 'declined', 'negotiation-requested'], default: 'pending' },
    respondedAt: Date,
    comments: String,
    electronicSignature: String,
    ipAddress: String,
    userAgent: String
  },
  negotiation: { requestedAt: Date, requestedBy: mongoose.Schema.Types.ObjectId, message: String, requestedChanges: mongoose.Schema.Types.Mixed, resolvedAt: Date, resolvedBy: mongoose.Schema.Types.ObjectId, resolution: String, comments: String }, decline: { reason: String, category: { type: String, enum: DECLINE_CATEGORIES }, declinedAt: Date }, withdrawal: { reason: String, withdrawnBy: mongoose.Schema.Types.ObjectId, withdrawnAt: Date }, document: { url: String, publicId: String, fileName: String, generatedAt: Date }, candidateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true }, jobSnapshot: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true }, statusHistory: { type: [history], default: [] }, hiringConfirmation: { confirmedBy: mongoose.Schema.Types.ObjectId, confirmedAt: Date, joiningDate: Date }, isArchived: { type: Boolean, default: false },
}, { timestamps: true, versionKey: false });
offerSchema.index({ application: 1, status: 1 }); offerSchema.index({ application: 1, revision: 1 }, { unique: true }); offerSchema.index({ company: 1, status: 1 }); offerSchema.index({ candidate: 1, status: 1 }); offerSchema.index({ job: 1, status: 1 }); offerSchema.index({ expiresAt: 1 }); offerSchema.index({ createdAt: -1 }); offerSchema.index({ isArchived: 1 }); offerSchema.index({ parentOffer: 1 });
offerSchema.index({ application: 1 }, { name: 'unique_active_offer_application', unique: true, partialFilterExpression: { status: { $in: ['draft', 'pending-approval', 'approved', 'sent', 'viewed', 'negotiation-requested', 'revised', 'accepted'] } } });
offerSchema.post('save', function(doc) {
  if (doc.company) {
    Promise.all([
      import('../services/realtime.service.js'),
      import('../services/recruiterAnalytics.service.js')
    ]).then(([{ broadcastToCompany }, { invalidateAnalyticsCache }]) => {
      broadcastToCompany(doc.company, 'offer_status_update', doc);
      invalidateAnalyticsCache(doc.company);
    }).catch(err => console.error(err));
  }
});

export const Offer = mongoose.model('Offer', offerSchema);
