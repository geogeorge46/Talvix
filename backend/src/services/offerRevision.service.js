import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Offer } from '../models/Offer.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { prepareCompensation } from '../utils/offerCompensation.js';
import { generateOfferNumber } from '../utils/offerNumber.js';
import { changeOfferStatus } from '../utils/offerStatus.js';
import { calculateOfferExpiry } from '../utils/offerTiming.js';
import { CandidateOnboarding } from '../models/CandidateOnboarding.js';
import { AuditLog } from '../models/AuditLog.js';
const own = async (company, id) => { const offer = await Offer.findOne({ _id: id, company }); if (!offer) throw new AppError('Offer not found', 404); return offer; };
export const resolve = async (company, id, actor, input) => { const offer = await own(company, id); if (offer.status !== 'negotiation-requested' || offer.negotiation.resolvedAt) throw new AppError('No unresolved negotiation exists', 409); offer.negotiation.resolution = input.resolution; offer.negotiation.comments = input.comments; offer.negotiation.resolvedAt = new Date(); offer.negotiation.resolvedBy = actor; if (['reaffirmed', 'rejected'].includes(input.resolution)) changeOfferStatus(offer, 'sent', actor, 'recruiter', input.comments); else if (input.resolution === 'withdrawn') changeOfferStatus(offer, 'withdrawn', actor, 'recruiter', input.comments); await offer.save(); return offer; };
export const revise = async (company, id, actor, input) => { const session = await mongoose.startSession(); try { let revisionOffer; await session.withTransaction(async () => { const old = await Offer.findOne({ _id: id, company }).session(session); if (!old) throw new AppError('Offer not found', 404); if (!['rejected', 'approved', 'sent', 'viewed', 'negotiation-requested', 'declined'].includes(old.status)) throw new AppError('Offer cannot be revised', 409); const latest = await Offer.findOne({ chainId: old.chainId }).sort({ revision: -1 }).session(session); if (!latest._id.equals(old.id)) throw new AppError('Only the latest offer may be revised', 409); const revision = old.revision + 1; const data = old.toObject(); for (const key of ['_id', 'createdAt', 'updatedAt', 'statusHistory', 'approval', 'sentAt', 'sentBy', 'viewedAt', 'candidateResponse', 'negotiation', 'decline', 'withdrawal', 'hiringConfirmation']) delete data[key]; changeOfferStatus(old, 'superseded', actor, 'recruiter', input.reason); await old.save({ session }); const offerNumber = await generateOfferNumber(session, revision, old.offerNumber); [revisionOffer] = await Offer.create([{ ...data, ...input, offerNumber, revision, parentOffer: old.id, revisionReason: input.reason, createdBy: actor, status: 'draft', compensation: prepareCompensation(input.compensation ?? old.compensation.toObject()), expiresAt: input.validityDays ? calculateOfferExpiry(input.validityDays) : old.expiresAt, approval: { required: old.approval.required } }], { session }); }); return revisionOffer; } finally { await session.endSession(); } };
export const confirmHire = async (company, id, actor, reqMeta = {}) => {
  const offer = await own(company, id);
  if (offer.hiringConfirmation?.confirmedAt) return offer;
  if (offer.status !== 'accepted') throw new AppError('Only an accepted offer can be confirmed', 409);
  const application = await Application.findById(offer.application);
  if (application.status !== 'offer-accepted') throw new AppError('Application is not ready for hiring', 409);

  changeApplicationStatus(application, 'hired', actor, 'Hiring confirmed');
  changeOfferStatus(offer, 'onboarding-started', actor, 'recruiter', 'Hiring confirmed & onboarding started');
  
  offer.hiringConfirmation = {
    confirmedBy: actor,
    confirmedAt: new Date(),
    joiningDate: offer.joiningDate
  };

  // Create CandidateOnboarding record with default tasks
  const onboarding = await CandidateOnboarding.create({
    company,
    candidate: offer.candidate,
    job: offer.job,
    offer: offer.id,
    status: 'in-progress',
    tasks: [
      { title: 'Submit signed contract & tax documents', completed: false },
      { title: 'Complete direct deposit bank details', completed: false },
      { title: 'Complete identity & background verification', completed: false },
      { title: 'Schedule first-day onboarding sync', completed: false }
    ]
  });

  await Promise.all([offer.save(), application.save()]);

  await AuditLog.create({
    action: 'offer.onboarding_started',
    actor,
    company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { onboardingId: onboarding.id, status: 'onboarding-started' },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return offer;
};

export const completeOnboarding = async (company, id, actor, reqMeta = {}) => {
  const offer = await own(company, id);
  if (offer.status !== 'onboarding-started') {
    throw new AppError('Offer onboarding has not been started or is already completed', 409);
  }

  changeOfferStatus(offer, 'completed', actor, 'recruiter', 'Onboarding workflow completed');
  await offer.save();

  await CandidateOnboarding.updateOne(
    { offer: offer.id },
    { status: 'completed', completedAt: new Date() }
  );

  await AuditLog.create({
    action: 'offer.completed',
    actor,
    company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'completed' },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return offer;
};
