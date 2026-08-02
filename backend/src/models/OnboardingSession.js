import mongoose from 'mongoose';

const onboardingSessionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    googleId: {
      type: String,
      required: false,
    },
    githubId: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
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

export const OnboardingSession = mongoose.model('OnboardingSession', onboardingSessionSchema);
