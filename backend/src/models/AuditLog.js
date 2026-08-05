import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null, index: true },
  application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null, index: true },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
  newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress: { type: String, default: 'Unknown' },
  userAgent: { type: String, default: 'Unknown' },
  resource: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

// Protect audit logs from modification (immutable audit trail)
auditLogSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Audit logs are immutable and cannot be updated');
  }
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
