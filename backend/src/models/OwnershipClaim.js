import mongoose from 'mongoose';

const ownershipClaimSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    officialEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    proofUrl: {
      type: String,
      trim: true,
      default: '',
    },
    companyWebsite: {
      type: String,
      trim: true,
      default: '',
    },
    businessRegistration: {
      type: String,
      trim: true,
      default: '',
    },
    gstNumber: {
      type: String,
      trim: true,
      default: '',
    },
    uploadedDocuments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    claimantNotes: {
      type: String,
      trim: true,
      default: '',
    },
    ownerResponse: {
      type: String,
      trim: true,
      default: '',
    },
    ownerRespondedAt: {
      type: Date,
      default: null,
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
      maxlength: 2000,
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const OwnershipClaim = mongoose.model('OwnershipClaim', ownershipClaimSchema);
