import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { Application } from '../models/Application.js';
import { Offer } from '../models/Offer.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { changeOfferStatus } from '../utils/offerStatus.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';
import { createOfferReminders } from './reminderEvent.service.js';
import { AuditLog } from '../models/AuditLog.js';
import mongoose from 'mongoose';

const own = async (company, id) => {
  const offer = await Offer.findOne({ _id: id, company });
  if (!offer) throw new AppError('Offer not found', 404);
  return offer;
};

const event = (type, offer, recipientIds, extra = {}) =>
  publishOptionalDomainEvent({
    type,
    company: String(offer.company),
    recipientIds: recipientIds.map(String),
    payload: { offerId: String(offer.id), offerNumber: offer.offerNumber, revision: offer.revision, ...extra },
    deduplicationKey: `${type}:${offer.id}:r${offer.revision}`
  });

export const list = (company) => Offer.find({ company, status: 'pending-approval' });

export const get = own;

export const approve = async (company, id, actor, comments, reqMeta = {}) => {
  const offer = await own(company, id);
  if (offer.status === 'approved') return offer;
  if (offer.status !== 'pending-approval') throw new AppError('Offer is not pending approval', 409);

  if (offer.approvalChain && offer.approvalChain.length > 0) {
    const step = offer.approvalChain[offer.currentApprovalStep];
    if (!step) throw new AppError('Approval chain has no active step', 409);

    if (step.approver) {
      if (step.approver.toString() !== actor.toString()) {
        throw new AppError('Only the assigned approver can approve this step', 403);
      }
    } else {
      const UserObj = await mongoose.model('User').findById(actor);
      if (step.role === 'hiring-manager') {
        const JobObj = await mongoose.model('Job').findById(offer.job);
        if (!JobObj?.hiringManager?.equals(actor)) {
          throw new AppError('Only the Hiring Manager can approve this step', 403);
        }
      } else if (step.role === 'company-primary-admin' || step.role === 'owner') {
        const CompanyObj = await mongoose.model('Company').findById(company);
        if (!CompanyObj?.owner?.equals(actor)) {
          throw new AppError('Only the Company Primary Admin can approve this step', 403);
        }
      } else if (step.role === 'hr-admin' || step.role === 'admin') {
        const RecruiterProfileObj = await mongoose.model('RecruiterProfile').findOne({ user: actor });
        if (UserObj?.role !== 'admin' && !RecruiterProfileObj?.permissions?.includes('offers.approve')) {
          throw new AppError('Unauthorized role to approve this step', 403);
        }
      } else {
        if (offer.createdBy.equals(actor) && offer.templateSnapshot?.allowCreatorApproval !== true) {
          throw new AppError('Offer creators cannot approve their own offer', 403);
        }
      }
    }

    step.status = 'approved';
    step.comments = comments;
    step.approvedAt = new Date();
    step.approver = actor;
    offer.currentApprovalStep += 1;

    await AuditLog.create({
      action: 'offer.approve',
      actor,
      company,
      application: offer.application,
      targetUser: offer.candidate,
      newValue: { stepApproved: step.role, currentApprovalStep: offer.currentApprovalStep },
      ipAddress: reqMeta.ipAddress || 'Unknown',
      userAgent: reqMeta.userAgent || 'Unknown'
    });

    if (offer.currentApprovalStep >= offer.approvalChain.length) {
      changeOfferStatus(offer, 'approved', actor, 'recruiter', comments);
      offer.approval.approvedAt = new Date();
      offer.approval.approvedBy = actor;
      offer.approval.approvalComments = comments;
      await offer.save();
      await event(DOMAIN_EVENTS.OFFER_APPROVED, offer, [offer.createdBy]);
    } else {
      await offer.save();
      const nextStep = offer.approvalChain[offer.currentApprovalStep];
      if (nextStep.approver) {
        await event(DOMAIN_EVENTS.OFFER_APPROVAL_REQUESTED, offer, [nextStep.approver]);
      }
    }
  } else {
    if (offer.createdBy.equals(actor) && offer.templateSnapshot?.allowCreatorApproval !== true) {
      throw new AppError('Offer creators cannot approve their own offer', 403);
    }
    changeOfferStatus(offer, 'approved', actor, 'recruiter', comments);
    offer.approval.approvedAt = new Date();
    offer.approval.approvedBy = actor;
    offer.approval.approvalComments = comments;
    await offer.save();
    await event(DOMAIN_EVENTS.OFFER_APPROVED, offer, [offer.createdBy]);

    await AuditLog.create({
      action: 'offer.approve',
      actor,
      company,
      application: offer.application,
      targetUser: offer.candidate,
      newValue: { status: 'approved' },
      ipAddress: reqMeta.ipAddress || 'Unknown',
      userAgent: reqMeta.userAgent || 'Unknown'
    });
  }

  return offer;
};

export const reject = async (company, id, actor, reason, reqMeta = {}) => {
  const offer = await own(company, id);
  if (offer.status !== 'pending-approval') throw new AppError('Offer is not pending approval', 409);

  if (offer.approvalChain && offer.approvalChain.length > 0) {
    const step = offer.approvalChain[offer.currentApprovalStep];
    if (step) {
      step.status = 'rejected';
      step.comments = reason;
      step.approvedAt = new Date();
      step.approver = actor;
    }
  }

  changeOfferStatus(offer, 'rejected', actor, 'recruiter', reason);
  offer.approval.rejectedAt = new Date();
  offer.approval.rejectedBy = actor;
  offer.approval.rejectionReason = reason;
  await offer.save();
  await event(DOMAIN_EVENTS.OFFER_REJECTED, offer, [offer.createdBy], { reason: String(reason).slice(0, 300) });

  await AuditLog.create({
    action: 'offer.reject',
    actor,
    company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'rejected', reason },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return offer;
};

export const send = async (company, id, actor, reqMeta = {}) => {
  const offer = await own(company, id);
  if (offer.status !== 'approved') throw new AppError('Only approved offers can be sent', 409);
  if (!offer.joiningDate || offer.joiningDate <= new Date() || !offer.expiresAt || offer.expiresAt <= new Date() || !offer.candidateSnapshot.email) {
    throw new AppError('Offer is not valid for sending', 400);
  }

  changeOfferStatus(offer, 'sent', actor, 'recruiter');
  offer.sentAt = new Date();
  offer.sentBy = actor;
  offer.candidateResponse = { response: 'pending' };
  await offer.save();

  const application = await Application.findById(offer.application);
  if (application?.status === 'offer-pending') {
    changeApplicationStatus(application, 'offer-sent', actor, 'Offer made available in candidate portal');
    await application.save();
  }

  await event(offer.revision > 1 ? DOMAIN_EVENTS.OFFER_REVISED : DOMAIN_EVENTS.OFFER_SENT, offer, [offer.candidate], { expiresAt: offer.expiresAt, actionUrl: `/candidate/offers/${offer.id}` });
  await createOfferReminders(offer);

  await AuditLog.create({
    action: 'offer.send',
    actor,
    company,
    application: offer.application,
    targetUser: offer.candidate,
    newValue: { status: 'sent' },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return offer;
};
