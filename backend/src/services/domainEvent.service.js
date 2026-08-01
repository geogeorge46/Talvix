import { domainEventSchema } from '../validators/domainEvent.validator.js';
import { activeUsers } from '../utils/notificationRecipients.js';
import { enqueueEvent } from './notificationOutbox.service.js';

export const publishDomainEvent = async (input, options = {}) => {
  const event = domainEventSchema.parse(input);
  const recipientIds = await activeUsers(event.recipientIds);
  if (!recipientIds.length) return null;
  return enqueueEvent({ eventType: event.type, payload: event.payload, recipientIds, company: event.company, deduplicationKey: event.deduplicationKey, availableAt: event.availableAt }, options.session);
};

export const publishOptionalDomainEvent = async (input, options = {}) => {
  try { return await publishDomainEvent(input, options); } catch { return null; }
};
