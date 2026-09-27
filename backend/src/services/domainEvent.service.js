import { domainEventSchema } from '../validators/domainEvent.validator.js';
import { activeUsers } from '../utils/notificationRecipients.js';
import { enqueueEvent, processOutboxBatch } from './notificationOutbox.service.js';

export const publishDomainEvent = async (input, options = {}) => {
  const event = domainEventSchema.parse(input);
  const recipientIds = await activeUsers(event.recipientIds);
  if (!recipientIds.length) return null;
  const enqueued = await enqueueEvent({ eventType: event.type, payload: event.payload, recipientIds, company: event.company, deduplicationKey: event.deduplicationKey, availableAt: event.availableAt }, options.session);
  processOutboxBatch(10).catch(() => {});
  return enqueued;
};

export const publishOptionalDomainEvent = async (input, options = {}) => {
  try { return await publishDomainEvent(input, options); } catch (e) { console.error('EVENT ERROR:', e); return null; }
};
