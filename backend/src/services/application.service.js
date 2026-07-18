import mongoose from 'mongoose';
import { CANDIDATE_WITHDRAWABLE_STATUSES } from '../utils/applicationStatus.js';
import { Application } from '../models/Application.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Job } from '../models/Job.js';
import { AppError } from '../shared/errors/AppError.js';
import { generateApplicationNumber } from '../utils/applicationNumber.js';
import { buildCandidateSnapshot, buildJobSnapshot } from '../utils/applicationSnapshot.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { calculateSkillMatch } from '../utils/skillMatch.js';
import { DOMAIN_EVENTS } from '../constants/domainEvents.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const supportsTransactions = () => ['ReplicaSetWithPrimary', 'Sharded'].includes(mongoose.connection.client?.topology?.description?.type);

const validateAnswer = (question, answer) => {
  const invalid = () => { throw new AppError(`Invalid answer for question '${question.question}'`, 400); };
  if (['text', 'textarea'].includes(question.type) && typeof answer !== 'string') invalid();
  if (question.type === 'number' && (typeof answer !== 'number' || !Number.isFinite(answer))) invalid();
  if (question.type === 'boolean' && typeof answer !== 'boolean') invalid();
  if (question.type === 'single-choice' && (typeof answer !== 'string' || !question.options.includes(answer))) invalid();
  if (question.type === 'multiple-choice' && (!Array.isArray(answer) || new Set(answer).size !== answer.length || answer.some((item) => !question.options.includes(item)))) invalid();
};

const validateAnswers = (job, answers) => {
  const questions = new Map(job.applicationQuestions.map((question) => [question.id, question]));
  const seen = new Set();
  const normalized = answers.map((answer) => {
    const id = answer.questionId.toString(); const question = questions.get(id);
    if (!question) throw new AppError('Unknown application question', 400);
    if (seen.has(id)) throw new AppError('Duplicate application question answer', 400);
    seen.add(id); validateAnswer(question, answer.answer);
    return { questionId: question._id, question: question.question, type: question.type, answer: answer.answer };
  });
  const missing = job.applicationQuestions.find((question) => question.required && !seen.has(question.id));
  if (missing) throw new AppError(`Answer is required for '${missing.question}'`, 400);
  return normalized;
};

const loadEligibility = async (candidateId, jobId, session) => {
  const profile = await CandidateProfile.findOne({ user: candidateId }).select('+applicationBlocked').session(session ?? null);
  const job = await Job.findById(jobId).populate('company').session(session ?? null);
  if (!profile || profile.applicationBlocked) throw new AppError('Candidate is not eligible to apply', 403);
  if (!job || job.status !== 'published' || !job.company?.isActive || job.company.verificationStatus !== 'verified' || !job.applicationDeadline || job.applicationDeadline <= new Date()) throw new AppError('Job is not accepting applications', 404);
  if (profile.profileCompletion < job.minimumProfileCompletion) throw new AppError(`Profile completion must be at least ${job.minimumProfileCompletion}%`, 400);
  if (job.resumeRequired && !profile.resumeDocument && !profile.resume?.url) throw new AppError('A resume is required to apply for this job', 400);
  return { profile, job, company: job.company };
};

const buildApplicationData = async (user, input, session) => {
  const { profile, job, company } = await loadEligibility(user.id, input.jobId, session);
  if (await Application.exists({ candidate: user.id, job: job.id }).session(session ?? null)) throw new AppError('You have already applied for this job', 409);
  const answers = validateAnswers(job, input.answers);
  const candidateSnapshot = buildCandidateSnapshot(user, profile);
  return {
    candidate: user.id, candidateProfile: profile.id, job: job.id, company: company.id,
    applicationNumber: await generateApplicationNumber(session), status: 'submitted', coverLetter: input.coverLetter ?? '', answers,
    resumeDocument: profile.resumeDocument, resumeSnapshot: profile.resume?.toObject?.() ?? profile.resume, candidateSnapshot,
    jobSnapshot: buildJobSnapshot(job, company), skillMatch: calculateSkillMatch(job.skills, profile.skills),
    statusHistory: [{ from: null, to: 'submitted', changedBy: user.id, reason: 'Application submitted' }], submittedAt: new Date(), lastStatusChangedAt: new Date(),
  };
};

export const submitApplication = async (user, input) => {
  if (supportsTransactions()) {
    const session = await mongoose.startSession(); let application;
    try {
      await session.withTransaction(async () => {
        const data = await buildApplicationData(user, input, session);
        [application] = await Application.create([data], { session });
        const recruiterIds = data.jobSnapshot ? data.company && (await Job.findById(data.job).populate('company').session(session)).company.teamMembers.filter((member) => member.status === 'active' && member.permissions.includes('applications.view')).map((member) => String(member.recruiter)) : [];
        await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.APPLICATION_SUBMITTED, company: String(data.company), recipientIds: [String(user.id), ...recruiterIds], payload: { applicationId: String(application.id), applicationNumber: application.applicationNumber, candidateId: String(user.id), candidateName: user.fullName, companyId: String(data.company), jobId: String(data.job), jobTitle: data.jobSnapshot.title, actionUrl: `/candidate/applications/${application.id}` }, deduplicationKey: `application.submitted:${application.id}` }, { session });
        const result = await Job.updateOne({ _id: data.job, status: 'published', applicationDeadline: { $gt: new Date() } }, { $inc: { applicationsCount: 1 } }, { session });
        if (result.modifiedCount !== 1) throw new AppError('Job is not accepting applications', 404);
      });
      return application;
    } catch (error) {
      if (error?.code === 11000) throw new AppError('You have already applied for this job', 409);
      throw error;
    } finally { await session.endSession(); }
  }
  let application;
  try {
    const data = await buildApplicationData(user, input);
    application = await Application.create(data);
    const companyJob = await Job.findById(data.job).populate('company'); const recruiterIds = companyJob.company.teamMembers.filter((member) => member.status === 'active' && member.permissions.includes('applications.view')).map((member) => String(member.recruiter));
    await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.APPLICATION_SUBMITTED, company: String(data.company), recipientIds: [String(user.id), ...recruiterIds], payload: { applicationId: String(application.id), applicationNumber: application.applicationNumber, candidateId: String(user.id), candidateName: user.fullName, companyId: String(data.company), jobId: String(data.job), jobTitle: data.jobSnapshot.title, actionUrl: `/candidate/applications/${application.id}` }, deduplicationKey: `application.submitted:${application.id}` });
    const result = await Job.updateOne({ _id: data.job, status: 'published', applicationDeadline: { $gt: new Date() } }, { $inc: { applicationsCount: 1 } });
    if (result.modifiedCount !== 1) throw new Error('Job application counter update failed');
    return application;
  } catch (error) {
    if (application) await Application.deleteOne({ _id: application.id });
    if (error?.code === 11000) throw new AppError('You have already applied for this job', 409);
    throw error;
  }
};

const candidateFilter = (candidateId, query) => {
  const filter = { candidate: candidateId, isArchived: false };
  if (query.status) filter.status = query.status; if (query.company) filter.company = query.company;
  if (query.search) { const regex = createSafeRegex(query.search); filter.$or = [{ applicationNumber: regex }, { 'jobSnapshot.title': regex }, { 'jobSnapshot.companyName': regex }]; }
  return filter;
};
const candidateSafe = (document) => {
  const value = document.toObject ? document.toObject() : { ...document };
  delete value.recruiterNotes; delete value.recruiterRating; delete value.ratedBy; delete value.ratedAt;
  delete value.tags; delete value.assignedRecruiters; delete value.rejection;
  value.statusHistory = value.statusHistory?.map(({ from, to, reason, changedAt }) => ({ from, to, reason, changedAt }));
  return value;
};

export const listCandidateApplications = async (candidateId, query) => {
  const filter = candidateFilter(candidateId, query); const sorts = { newest: { submittedAt: -1 }, oldest: { submittedAt: 1 }, status: { status: 1 }, 'match-high': { 'skillMatch.score': -1 }, 'match-low': { 'skillMatch.score': 1 } };
  const [items, total] = await Promise.all([Application.find(filter).select('applicationNumber status job company jobSnapshot skillMatch.score submittedAt lastStatusChangedAt').sort(sorts[query.sort]).skip((query.page - 1) * query.limit).limit(query.limit), Application.countDocuments(filter)]);
  return { applications: items, pagination: buildPagination(query.page, query.limit, total) };
};
export const getCandidateApplication = async (candidateId, id) => { const application = await Application.findOne({ _id: id, candidate: candidateId, isArchived: false }); if (!application) throw new AppError('Application not found', 404); return candidateSafe(application); };
export const withdrawApplication = async (candidateId, id, reason) => {
  const application = await Application.findOne({ _id: id, candidate: candidateId, isArchived: false }); if (!application) throw new AppError('Application not found', 404);
  if (!CANDIDATE_WITHDRAWABLE_STATUSES.includes(application.status)) throw new AppError(`Application cannot transition from ${application.status} to withdrawn`, 409);
  const from = application.status; application.status = 'withdrawn'; application.withdrawal = { reason, withdrawnAt: new Date() }; application.lastStatusChangedAt = new Date(); application.statusHistory.push({ from, to: 'withdrawn', changedBy: candidateId, reason }); await application.save(); await publishOptionalDomainEvent({ type: DOMAIN_EVENTS.APPLICATION_WITHDRAWN, company: String(application.company), recipientIds: application.assignedRecruiters.map(String), payload: { applicationId: String(application.id), applicationNumber: application.applicationNumber, candidateId: String(candidateId), companyId: String(application.company), jobId: String(application.job), jobTitle: application.jobSnapshot.title }, deduplicationKey: `application.withdrawn:${application.id}` }); return candidateSafe(application);
};
export const respondToApplicationOffer = async (candidateId, id, input) => {
  const application = await Application.findOne({ _id: id, candidate: candidateId, isArchived: false });
  if (!application) throw new AppError('Application not found', 404);
  if (application.status !== 'offer-sent') throw new AppError(`Application cannot transition from ${application.status} to ${input.status}`, 409);
  const from = application.status; application.status = input.status; application.lastStatusChangedAt = new Date(); application.statusHistory.push({ from, to: input.status, changedBy: candidateId, reason: input.reason ?? '' }); await application.save(); return candidateSafe(application);
};
export const refreshApplicationSnapshot = async (user, id) => {
  const application = await Application.findOne({ _id: id, candidate: user.id, isArchived: false }); if (!application) throw new AppError('Application not found', 404);
  if (!['submitted', 'under-review'].includes(application.status)) throw new AppError('Application snapshot can no longer be refreshed', 409);
  const [profile, job] = await Promise.all([CandidateProfile.findById(application.candidateProfile), Job.findById(application.job)]); if (!profile || !job) throw new AppError('Application snapshot source not found', 404);
  application.candidateSnapshot = buildCandidateSnapshot(user, profile); application.resumeSnapshot = profile.resume?.toObject?.() ?? profile.resume; application.skillMatch = calculateSkillMatch(job.skills, profile.skills); application.lastSnapshotRefreshedAt = new Date(); application.markModified('candidateSnapshot'); await application.save(); return candidateSafe(application);
};
export const getCandidateTimeline = async (candidateId, id) => { const application = await getCandidateApplication(candidateId, id); return application.statusHistory; };
