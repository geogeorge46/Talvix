import mongoose from 'mongoose';

const joinRequestSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// A user can have only one active request per company at a time
joinRequestSchema.index({ company: 1, user: 1, status: 1 });

export const JoinRequest = mongoose.model('JoinRequest', joinRequestSchema);
