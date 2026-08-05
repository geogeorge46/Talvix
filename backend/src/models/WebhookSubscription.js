import mongoose from 'mongoose';

const webhookSubscriptionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  targetUrl: { type: String, required: true },
  events: [{ type: String, required: true }],
  secret: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

export const WebhookSubscription = mongoose.model('WebhookSubscription', webhookSubscriptionSchema);
