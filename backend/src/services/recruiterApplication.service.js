import mongoose from 'mongoose';
import { Application } from '../models/Application.js';
import { Job } from '../models/Job.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { changeApplicationStatus } from '../utils/applicationStatus.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { genericApplicationEvent } from '../utils/applicationNotificationPolicy.js';
import { publishOptionalDomainEvent } from './domainEvent.service.js';

const companyApplication = async (companyId, id) => { const application = await Application.findOne({ _id: id, company: companyId, isArchived: false }); if (!application) throw new AppError('Application not found', 404); return application; };
const filterFor = (companyId, query) => {
  const filter = { company: companyId, isArchived: false };
  if (query.jobId) filter.job = query.jobId; if (query.status) filter.status = query.status;
  if (query.skills?.length) filter['candidateSnapshot.skills.name'] = { $all: query.skills.map(createSafeRegex) };
  if (query.minimumMatchScore !== undefined || query.maximumMatchScore !== undefined) filter['skillMatch.score'] = { ...(query.minimumMatchScore !== undefined && { $gte: query.minimumMatchScore }), ...(query.maximumMatchScore !== undefined && { $lte: query.maximumMatchScore }) };
  if (query.minimumRating) filter.recruiterRating = { $gte: query.minimumRating }; if (query.tags?.length) filter.tags = { $all: query.tags };
  if (query.assignedRecruiter) filter.assignedRecruiters = query.assignedRecruiter;
  if (query.submittedFrom || query.submittedTo) filter.submittedAt = { ...(query.submittedFrom && { $gte: query.submittedFrom }), ...(query.submittedTo && { $lte: query.submittedTo }) };
  if (query.search) { const regex = createSafeRegex(query.search); filter.$or = [{ 'candidateSnapshot.fullName': regex }, { 'candidateSnapshot.email': regex }, { applicationNumber: regex }, { 'jobSnapshot.title': regex }, { 'candidateSnapshot.skills.name': regex }]; }
  return filter;
};
export const listCompanyApplications = async (companyId, query) => {
  const filter = filterFor(companyId, query); const sorts = { newest: { submittedAt: -1 }, oldest: { submittedAt: 1 }, 'match-high': { 'skillMatch.score': -1 }, 'match-low': { 'skillMatch.score': 1 }, 'rating-high': { recruiterRating: -1 }, 'rating-low': { recruiterRating: 1 }, 'candidate-name': { 'candidateSnapshot.fullName': 1 } };
  const [applications, total] = await Promise.all([Application.find(filter).sort(sorts[query.sort]).skip((query.page - 1) * query.limit).limit(query.limit), Application.countDocuments(filter)]);
  return { applications, pagination: buildPagination(query.page, query.limit, total) };
};
export const getCompanyApplication = (companyId, id) => companyApplication(companyId, id);
export const updateApplicationStatus = async (companyId, id, actorId, input) => { const application = await companyApplication(companyId, id); const previousStatus=application.status; changeApplicationStatus(application, input.status, actorId, input.reason, { rejectionCategory: input.rejectionCategory }); await application.save(); const type=genericApplicationEvent({previousStatus,nextStatus:input.status}); const history=application.statusHistory.at(-1); if(type)await publishOptionalDomainEvent({type,actor:String(actorId),company:String(companyId),recipientIds:[String(application.candidate)],payload:{applicationId:String(application.id),applicationNumber:application.applicationNumber,candidateId:String(application.candidate),companyId:String(companyId),jobId:String(application.job),jobTitle:application.jobSnapshot.title,status:input.status,reason:input.status==='rejected'?String(input.reason??'').slice(0,300):undefined,actionUrl:`/candidate/applications/${application.id}`},deduplicationKey:`${type}:${application.id}:${history.id}`}); return application; };
export const addApplicationNote = async (companyId, id, actorId, input) => { const application = await companyApplication(companyId, id); application.recruiterNotes.push({ author: actorId, ...input }); await application.save(); return application.recruiterNotes.at(-1); };
export const updateApplicationNote = async (companyId, applicationId, noteId, actorId, input) => { const application = await companyApplication(companyId, applicationId); const note = application.recruiterNotes.id(noteId); if (!note) throw new AppError('Recruiter note not found', 404); if (!note.author.equals(actorId)) throw new AppError('Recruiter note not found', 404); note.set(input); await application.save(); return note; };
export const deleteApplicationNote = async (companyId, applicationId, noteId, actorId, isOwner) => { const application = await companyApplication(companyId, applicationId); const note = application.recruiterNotes.id(noteId); if (!note || (!note.author.equals(actorId) && !isOwner)) throw new AppError('Recruiter note not found', 404); note.deleteOne(); await application.save(); };
export const rateApplication = async (companyId, id, actorId, rating) => { const application = await companyApplication(companyId, id); application.recruiterRating = rating; application.ratedBy = actorId; application.ratedAt = new Date(); await application.save(); return application; };
export const tagApplication = async (companyId, id, tags) => { const application = await companyApplication(companyId, id); application.tags = tags; await application.save(); return application; };
export const assignApplicationRecruiters = async (company, id, recruiterIds) => {
  const application = await companyApplication(company.id, id); const uniqueIds = recruiterIds.map((value) => new mongoose.Types.ObjectId(value));
  const [users, profiles] = await Promise.all([User.find({ _id: { $in: uniqueIds }, role: 'recruiter' }).select('+isActive'), RecruiterProfile.find({ user: { $in: uniqueIds }, company: company.id, isApproved: true })]);
  const validUsers = new Set(users.filter((user) => user.isActive).map((user) => user.id)); const validProfiles = new Set(profiles.map((profile) => profile.user.toString()));
  const activeMembers = new Set(company.teamMembers.filter((member) => member.status === 'active').map((member) => member.recruiter.toString()));
  if (uniqueIds.some((idValue) => !validUsers.has(idValue.toString()) || !validProfiles.has(idValue.toString()) || !activeMembers.has(idValue.toString()))) throw new AppError('One or more assignees are invalid', 400);
  application.assignedRecruiters = uniqueIds; await application.save(); return application;
};
export const getApplicationPipeline = async (companyId, jobId) => {
  const match = { company: new mongoose.Types.ObjectId(companyId), isArchived: false, ...(jobId && { job: new mongoose.Types.ObjectId(jobId) }) };
  const rows = await Application.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]); const pipeline = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  return { total: rows.reduce((sum, row) => sum + row.count, 0), pipeline };
};
export const getJobApplicationStatistics = async (companyId, jobId) => {
  if (!await Job.exists({ _id: jobId, company: companyId })) throw new AppError('Job not found', 404);
  const match = { company: new mongoose.Types.ObjectId(companyId), job: new mongoose.Types.ObjectId(jobId), isArchived: false };
  const [summary, status, overTime, skills, missing] = await Promise.all([
    Application.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: 1 }, averageMatchScore: { $avg: '$skillMatch.score' }, highestMatchScore: { $max: '$skillMatch.score' }, lowestMatchScore: { $min: '$skillMatch.score' }, averageRecruiterRating: { $avg: '$recruiterRating' } } }]),
    Application.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Application.aggregate([{ $match: match }, { $unwind: '$candidateSnapshot.skills' }, { $group: { _id: '$candidateSnapshot.skills.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Application.aggregate([{ $match: match }, { $unwind: '$skillMatch.missingRequiredSkills' }, { $group: { _id: '$skillMatch.missingRequiredSkills', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
  ]);
  return { ...(summary[0] ?? { total: 0, averageMatchScore: null, highestMatchScore: null, lowestMatchScore: null, averageRecruiterRating: null }), applicationsByStatus: Object.fromEntries(status.map((row) => [row._id, row.count])), applicationCountOverTime: overTime.map((row) => ({ date: row._id, count: row.count })), topCandidateSkills: skills.map((row) => ({ skill: row._id, count: row.count })), missingRequiredSkills: missing.map((row) => ({ skill: row._id, count: row.count })) };
};
