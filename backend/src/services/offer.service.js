import mongoose from 'mongoose';
import { ACTIVE_OFFER_STATUSES, OFFER_ELIGIBLE_APPLICATION_STATUSES } from '../constants/offer.js';
import { Application } from '../models/Application.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Company } from '../models/Company.js';
import { Job } from '../models/Job.js';
import { Offer } from '../models/Offer.js';
import { OfferTemplate } from '../models/OfferTemplate.js';
import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { prepareCompensation } from '../utils/offerCompensation.js';
import { generateOfferNumber } from '../utils/offerNumber.js';
import { changeOfferStatus } from '../utils/offerStatus.js';
import { calculateOfferExpiry } from '../utils/offerTiming.js';
import { buildPagination } from '../utils/pagination.js';
import { AuditLog } from '../models/AuditLog.js';

const own = async (c, id) => {
  const x = await Offer.findOne({ _id: id, company: c, isArchived: false });
  if (!x) throw new AppError('Offer not found', 404);
  return x;
};

const createRecords = async (c, u, b, s) => {
  const app = await Application.findOne({ _id: b.applicationId, company: c, isArchived: false }).session(s);
  if (!app) throw new AppError('Application not found', 404);
  if (!OFFER_ELIGIBLE_APPLICATION_STATUSES.includes(app.status)) throw new AppError('Application is not eligible for an offer', 409);
  if (await Offer.exists({ application: app.id, status: { $in: ACTIVE_OFFER_STATUSES } }).session(s)) {
    throw new AppError('An active offer already exists for this application', 409);
  }

  const [user, profile, job, company] = await Promise.all([
    User.findById(app.candidate).select('+isActive').session(s),
    CandidateProfile.findById(app.candidateProfile).session(s),
    Job.findOne({ _id: app.job, company: c }).session(s),
    Company.findById(c).session(s)
  ]);

  if (!user?.isActive || !job || !company?.isActive || company.verificationStatus !== 'verified') {
    throw new AppError('Offer eligibility requirements are not met', 409);
  }

  let template;
  if (b.templateId) {
    template = await OfferTemplate.findOne({ _id: b.templateId, company: c, isActive: true }).session(s);
    if (!template) throw new AppError('Offer template not found', 404);
    await OfferTemplate.updateOne({ _id: template.id }, { $inc: { usageCount: 1 } }, { session: s });
  }

  const offerNumber = await generateOfferNumber(s);
  const [offer] = await Offer.create([{
    ...b,
    offerNumber,
    chainId: new mongoose.Types.ObjectId(),
    company: c,
    job: app.job,
    application: app.id,
    candidate: app.candidate,
    candidateProfile: app.candidateProfile,
    createdBy: u,
    template: b.templateId,
    templateSnapshot: template?.toObject(),
    compensation: prepareCompensation(b.compensation),
    expiresAt: calculateOfferExpiry(b.validityDays),
    approval: { required: template?.approvalRequired ?? true },
    candidateSnapshot: { fullName: user.fullName, email: user.email, phone: profile?.phone, location: profile?.location },
    jobSnapshot: { title: job.title, employmentType: job.employmentType, workMode: job.workMode, location: job.location, companyName: company.name }
  }], { session: s });

  if (app.status === 'interview-completed') {
    changeApplicationStatus(app, 'offer-pending', u, 'Offer drafted');
    await app.save({ session: s });
  }
  return offer;
};

export const create = async (c, u, b, reqMeta = {}) => {
  const s = await mongoose.startSession();
  try {
    let o;
    await s.withTransaction(async () => {
      o = await createRecords(c, u, b, s);
      await AuditLog.create([{
        action: 'offer.create',
        actor: u,
        company: c,
        application: o.application,
        targetUser: o.candidate,
        newValue: { offerId: o.id, offerNumber: o.offerNumber },
        ipAddress: reqMeta.ipAddress || 'Unknown',
        userAgent: reqMeta.userAgent || 'Unknown'
      }], { session: s });
    });
    return o;
  } catch (e) {
    if (e.code === 11000) throw new AppError('An active offer already exists for this application', 409);
    throw e;
  } finally {
    await s.endSession();
  }
};

export const list = async (c, q) => {
  const f = { company: c, isArchived: false };
  for (const [k, d] of [['applicationId', 'application'], ['jobId', 'job'], ['candidate', 'candidate'], ['status', 'status']]) {
    if (q[k]) f[d] = q[k];
  }
  const sorts = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    expiry: { expiresAt: 1 },
    'compensation-high': { 'compensation.estimatedTotal': -1 },
    'compensation-low': { 'compensation.estimatedTotal': 1 },
    'candidate-name': { 'candidateSnapshot.fullName': 1 },
    status: { status: 1 }
  };
  const [offers, total] = await Promise.all([
    Offer.find(f).sort(sorts[q.sort]).skip((q.page - 1) * q.limit).limit(q.limit),
    Offer.countDocuments(f)
  ]);
  return { offers, pagination: buildPagination(q.page, q.limit, total) };
};

export const get = own;

export const update = async (c, id, b, reqMeta = {}) => {
  const o = await own(c, id);
  if (!['draft', 'rejected'].includes(o.status)) throw new AppError('Only draft or rejected offers can be edited', 409);
  const oldValue = { compensation: o.compensation, joiningDate: o.joiningDate, title: o.title };
  o.set({ ...b, ...(b.compensation && { compensation: prepareCompensation(b.compensation) }) });
  await o.save();

  await AuditLog.create({
    action: 'offer.update',
    actor: o.createdBy,
    company: c,
    application: o.application,
    targetUser: o.candidate,
    oldValue,
    newValue: { title: o.title, joiningDate: o.joiningDate },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return o;
};

export const requestApproval = async (c, id, u, reqMeta = {}) => {
  const o = await own(c, id);
  if (!['draft', 'rejected'].includes(o.status) || !o.joiningDate || !o.expiresAt || !o.compensation) {
    throw new AppError('Offer is incomplete or cannot request approval', 409);
  }

  const CompanyModel = mongoose.model('Company');
  const companyObj = await CompanyModel.findById(c);

  if (o.approval.required) {
    changeOfferStatus(o, 'pending-approval', u, 'recruiter');
    o.approval.requestedAt = new Date();
    o.approval.requestedBy = u;

    if (companyObj?.offerApprovalWorkflowEnabled === true) {
      const roles = o.templateSnapshot?.requiredApproverRoles || ['hiring-manager', 'owner'];
      o.approvalChain = [];
      const JobModel = mongoose.model('Job');
      const job = await JobModel.findById(o.job);

      for (const r of roles) {
        let approverId = null;
        if (r === 'hiring-manager') {
          approverId = job?.hiringManager || null;
        } else if (r === 'owner' || r === 'company-primary-admin') {
          approverId = companyObj?.owner || null;
        }
        o.approvalChain.push({
          role: r,
          approver: approverId,
          status: 'pending',
          comments: '',
          approvedAt: null
        });
      }
      o.currentApprovalStep = 0;
    } else {
      o.approvalChain = [];
    }
  } else {
    changeOfferStatus(o, 'approved', u, 'recruiter');
  }

  await o.save();

  await AuditLog.create({
    action: 'offer.approval_requested',
    actor: u,
    company: c,
    application: o.application,
    targetUser: o.candidate,
    newValue: { status: o.status, approvalChain: o.approvalChain },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return o;
};

export const withdraw = async (c, id, u, reason, reqMeta = {}) => {
  const o = await own(c, id);
  if (o.status === 'accepted') throw new AppError('Accepted offers cannot be withdrawn', 409);
  changeOfferStatus(o, 'withdrawn', u, 'recruiter', reason);
  o.withdrawal = { reason, withdrawnBy: u, withdrawnAt: new Date() };
  await o.save();

  await AuditLog.create({
    action: 'offer.withdraw',
    actor: u,
    company: c,
    application: o.application,
    targetUser: o.candidate,
    newValue: { status: 'withdrawn', reason },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return o;
};

export const cancel = async (c, id, u, reason, reqMeta = {}) => {
  const o = await own(c, id);
  if (!['draft', 'rejected'].includes(o.status)) throw new AppError('Only draft or rejected offers can be cancelled', 409);
  changeOfferStatus(o, 'cancelled', u, 'recruiter', reason);
  await o.save();

  await AuditLog.create({
    action: 'offer.cancel',
    actor: u,
    company: c,
    application: o.application,
    targetUser: o.candidate,
    newValue: { status: 'cancelled', reason },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return o;
};

export const archive = async (c, id, reqMeta = {}) => {
  const o = await own(c, id);
  if (ACTIVE_OFFER_STATUSES.includes(o.status)) throw new AppError('Active offers cannot be archived', 409);
  o.isArchived = true;
  await o.save();

  await AuditLog.create({
    action: 'offer.archive',
    actor: o.createdBy,
    company: c,
    application: o.application,
    targetUser: o.candidate,
    newValue: { isArchived: true },
    ipAddress: reqMeta.ipAddress || 'Unknown',
    userAgent: reqMeta.userAgent || 'Unknown'
  });

  return o;
};

export const history = async (c, id) => {
  const o = await own(c, id);
  return Offer.find({ chainId: o.chainId, company: c }).sort({ revision: 1 });
};
