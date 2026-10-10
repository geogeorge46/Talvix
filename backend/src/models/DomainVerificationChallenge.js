import mongoose from 'mongoose';

const domainVerificationChallengeSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    domain: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    challengeHash: {
      type: String,
      required: true,
    },
    txtRecordName: {
      type: String,
      required: true,
    },
    txtRecordValue: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed', 'expired'],
      default: 'pending',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expiresAfterSeconds: 0 },
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const DomainVerificationChallenge = mongoose.model(
  'DomainVerificationChallenge',
  domainVerificationChallengeSchema,
);
