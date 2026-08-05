import mongoose from 'mongoose';

const notificationPreferenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  channels: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    slack: { type: Boolean, default: false },
    teams: { type: Boolean, default: false }
  },
  frequency: { type: String, enum: ['instant', 'daily_digest', 'weekly_digest'], default: 'instant' }
}, { timestamps: true, versionKey: false });

export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
