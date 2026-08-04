import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { CANDIDATE_VISIBLE_OFFER_STATUSES } from '../constants/offer.js';
import { Application } from '../models/Application.js';
import { Company } from '../models/Company.js';
import { Offer } from '../models/Offer.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { serializeCandidateOffer, serializeCandidateTimeline } from '../utils/offerSerializer.js';
import { changeOfferStatus } from '../utils/offerStatus.js';
import { isOfferExpired } from '../utils/offerTiming.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { cancelReminders } from './reminderEvent.service.js';
import { AuditLog } from '../models/AuditLog.js';

const event = (type, offer, recipients) =>
  publishOptionalDomainEvent({
    type,
    company: String(offer.company),
    recipientIds: recipients.map(String),
    payload: { offerId: String(offer.id), offerNumber: offer.offerNumber, revision: offer.revision },
    deduplicationKey: `${type}:${offer.id}:r${offer.revision}`
  });

const own = async (user, id, reqMeta = {}) => {
  const offer = await Offer.findOne({ _id: id, candidate: user, status: { $in: CANDIDATE_VISIBLE_OFFER_STATUSES } });
  if (!offer) throw new AppError('Offer not found', 404);
  
  if (isOfferExpired(offer) && ['sent', 'viewed', 'revised', 'negotiation-requested'].includes(offer.status)) {
    changeOfferStatus(offer, 'expired', user, 'candidate', 'Offer validity elapsed');
    await offer.save();
    await cancelReminders(`offer.expiry-reminder:${offer.id}:`);
    await event(DOMAIN_EVENTS.OFFER_EXPIRED, offer, [offer.candidate, offer.createdBy]);

    await AuditLog.create({
      action: 'offer.expire',
      actor: user,
      company: offer.company,
      application: offer.application,
      targetUser: offer.candidate,
      newValue: { status: 'expired', reason: 'Validity period elapsed' },
      ipAddress: reqMeta.ipAddress || 'Unknown',
      userAgent: reqMeta.userAgent || 'Unknown'
    });
  }
  return offer;
};

export const list = async (user, query) => {
  const filter = { candidate: user, status: { $in: CANDIDATE_VISIBLE_OFFER_STATUSES } };
  if (query.status) filter.status = query.status;
  if (query.company) filter.company = query.company;
  if (query.jobId) filter.job = query.jobId;
  const sorts = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, expiry: { expiresAt: 1 } };
  return (await Offer.find(filter).sort(sorts[query.sort])).map(serializeCandidateOffer);
};

export const get = async (user, id, reqMeta = {}) => serializeCandidateOffer(await own(user, id, reqMeta));

export const view = async (user, id, reqMeta = {}) => {
  const offer = await own(user, id, reqMeta);
  if (offer.status === 'sent') {
    changeOfferStatus(offer, 'viewed', user, 'candidate');
    offer.viewedAt = new Date();
    await offer.save();
    await event(DOMAIN_EVENTS.OFFER_VIEWED, offer, [offer.createdBy]);

    await AuditLog.create({
      action: 'offer.view',
      actor: user,
      company: offer.company,
      application: offer.application,
      targetUser: offer.candidate,
      newValue: { status: 'viewed' },
      ipAddress: reqMeta.ipAddress || 'Unknown',
      userAgent: reqMeta.userAgent || 'Unknown'
    });
  }
  return serializeCandidateOffer(offer);
};

const responsive = async (user, id, reqMeta = {}) => {
  const offer = await own(user, id, reqMeta);
  if (!['sent', 'viewed', 'revised'].includes(offer.status)) throw new AppError('Offer cannot be responded to', 409);
  if (isOfferExpired(offer)) throw new AppError('Offer has expired', 409);
  const latest = await Offer.findOne({ chainId: offer.chainId }).sort({ revision: -1 });
  if (!latest._id.equals(offer.id)) throw new AppError('Only the latest offer revision may be answered', 409);
  if (!await Company.exists({ _id: offer.company, isActive: true })) throw new AppError('Offer is unavailable', 409);
  return offer;
};

export const accept = async (user, id, input, reqMeta = {}) => {
  const offer = await responsive(user, id, reqMeta);
  const signature = input.signature || offer.candidateSnapshot?.fullName || 'Signed Digitally';

  changeOfferStatus(offer, 'accepted', user, 'candidate', input.comments);
  offer.candidateResponse = {
    response: 'accepted',
    respondedAt: new Date(),
    comments: input.comments,
    electronicSignature: signature,
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  };
  await offer.save();

  const application = await Application.findById(offer.application);
  if (application.status === 'offer-sent') {
    changeApplicationStatus(application, 'offer-accepted', user, 'Candidate accepted offer');
    await application.save();
  }

  await cancelReminders(`offer.expiry-reminder:${offer.id}:`);
  await event(DOMAIN_EVENTS.OFFER_ACCEPTED, offer, [offer.createdBy]);

  await AuditLog.create({
    action: 'offer.accept',
    actor: user,
    company: offer.company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'accepted', signature },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return { offer: serializeCandidateOffer(offer), application: { id: application.id, status: application.status } };
};

export const decline = async (user, id, input, reqMeta = {}) => {
  const offer = await responsive(user, id, reqMeta);
  changeOfferStatus(offer, 'declined', user, 'candidate', input.reason);
  offer.candidateResponse = {
    response: 'declined',
    respondedAt: new Date(),
    comments: input.reason,
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  };
  offer.decline = { ...input, declinedAt: new Date() };
  await offer.save();

  const application = await Application.findById(offer.application);
  if (application.status === 'offer-sent') {
    changeApplicationStatus(application, 'offer-declined', user, input.reason);
    await application.save();
  }

  await cancelReminders(`offer.expiry-reminder:${offer.id}:`);
  await event(DOMAIN_EVENTS.OFFER_DECLINED, offer, [offer.createdBy]);

  await AuditLog.create({
    action: 'offer.decline',
    actor: user,
    company: offer.company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'declined', reason: input.reason },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return serializeCandidateOffer(offer);
};

export const negotiate = async (user, id, input, reqMeta = {}) => {
  const offer = await responsive(user, id, reqMeta);
  if (offer.negotiation?.requestedAt && !offer.negotiation.resolvedAt) {
    throw new AppError('An unresolved negotiation already exists', 409);
  }

  changeOfferStatus(offer, 'negotiation-requested', user, 'candidate', input.message);
  offer.candidateResponse = {
    response: 'negotiation-requested',
    respondedAt: new Date(),
    comments: input.message,
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  };
  offer.negotiation = { requestedAt: new Date(), requestedBy: user, ...input };
  await offer.save();

  await event(DOMAIN_EVENTS.OFFER_NEGOTIATION_REQUESTED, offer, [offer.createdBy]);

  await AuditLog.create({
    action: 'offer.negotiate',
    actor: user,
    company: offer.company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'negotiation-requested', message: input.message, requestedChanges: input.requestedChanges },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return serializeCandidateOffer(offer);
};

export const timeline = async (user, id, reqMeta = {}) => serializeCandidateTimeline(await own(user, id, reqMeta));
export const getRaw = async (user, id, reqMeta = {}) => own(user, id, reqMeta);
