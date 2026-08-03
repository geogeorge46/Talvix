import mongoose from 'mongoose';

const backgroundJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'SEND_EMAIL',
        'RETENTION_CLEANUP',
        'EXPIRE_INVITATION',
        'EXPIRE_JOIN_REQUEST',
        'REVOKE_SESSION',
        'GENERATE_AUDIT_REPORT',
        'EXPIRE_JOBS',
        'PUBLISH_JOBS'
      ],
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
      index: true,
    },
    priorityWeight: {
      type: Number,
      default: 2, // MEDIUM: 2, LOW: 1, HIGH: 3, CRITICAL: 4
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    attempts: {
      type: Number,
      default: 0,
      required: true,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      required: true,
    },
    runAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
    lockedAt: {
      type: Date,
      default: null,
      index: true,
    },
    lockedBy: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Map priorities to weights for database-level sorting
backgroundJobSchema.pre('save', function (next) {
  const weights = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  this.priorityWeight = weights[this.priority] || 2;
  if (typeof next === 'function') {
    next();
  }
});

export const BackgroundJob = mongoose.model('BackgroundJob', backgroundJobSchema);
