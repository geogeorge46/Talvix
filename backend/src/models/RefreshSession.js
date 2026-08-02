import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      trim: true,
    },
    deviceInfo: {
      os: { type: String, default: 'Unknown' },
      browser: { type: String, default: 'Unknown' },
      ipAddress: { type: String, default: 'Unknown' },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expiresAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
