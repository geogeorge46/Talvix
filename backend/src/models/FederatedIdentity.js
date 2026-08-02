import mongoose from 'mongoose';

const federatedIdentitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['LOCAL', 'GOOGLE', 'GITHUB', 'MICROSOFT', 'APPLE'],
      required: true,
    },
    providerId: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Enforce unique combinations of provider and providerId
federatedIdentitySchema.index({ provider: 1, providerId: 1 }, { unique: true });

export const FederatedIdentity = mongoose.model('FederatedIdentity', federatedIdentitySchema);
