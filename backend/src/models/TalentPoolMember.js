import mongoose from 'mongoose';

const { Schema } = mongoose;

const talentPoolMemberSchema = new Schema({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  candidateProfile: { type: Schema.Types.ObjectId, ref: 'CandidateProfile', required: true },
  status: {
    type: String,
    enum: ['sourced', 'interested', 'contacted', 'silver-medalist', 'archived'],
    default: 'sourced',
    index: true
  },
  tags: [{ type: Schema.Types.ObjectId, ref: 'CompanyTag' }],
  notes: [{
    recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

talentPoolMemberSchema.index({ company: 1, candidate: 1 }, { unique: true });

export const TalentPoolMember = mongoose.model('TalentPoolMember', talentPoolMemberSchema);
