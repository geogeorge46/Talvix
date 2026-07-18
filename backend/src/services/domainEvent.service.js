import { domainEventSchema } from '../validators/domainEvent.validator.js';
import { enqueueEvent } from './notificationOutbox.service.js';

export const publishDomainEvent = async (input, options = {}) => {
  const event = domainEventSchema.parse(input);
  return enqueueEvent({ eventType: event.type, payload: event.payload, recipientIds: event.recipientIds, company: event.company, deduplicationKey: event.deduplicationKey, availableAt: event.availableAt }, options.session);
};

export const publishOptionalDomainEvent = async (input, options = {}) => {
  try { return await publishDomainEvent(input, options); } catch { return null; }
};
