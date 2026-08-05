import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Question } from '../models/Question.js';
import { QuestionRevision } from '../models/QuestionRevision.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { Offer } from '../models/Offer.js';
import { Document } from '../models/Document.js';
import { Notification } from '../models/Notification.js';
import { EmailLog } from '../models/EmailLog.js';
import { AuditLog } from '../models/AuditLog.js';
import { RefreshSession } from '../models/RefreshSession.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination } from '../utils/pagination.js';
import { revokeUserSessions } from '../utils/sessionRevocation.js';

// Helper to write audit logs
const logAdminAction = async ({ action, actor, company, application, targetUser, oldValue, newValue, ipAddress, userAgent }) => {
  await AuditLog.create({
    action,
    actor,
    company,
    application,
    targetUser,
    oldValue,
    newValue,
    ipAddress: ipAddress || 'Unknown',
    userAgent: userAgent || 'Unknown',
    timestamp: new Date(),
  });
};

// ==========================================
// 1. Users Management Services
// ==========================================

export const listUsers = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = { isDeleted: { $ne: true } };

  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }
  if (query.role) filter.role = query.role;
  if (query.isVerified !== undefined) {
    filter.isVerified = query.isVerified === 'true';
  }
  if (query.blocked !== undefined) {
    filter.blocked = query.blocked === 'true';
  }

  const sort = {};
  if (query.sortBy) {
    sort[query.sortBy] = query.sortOrder === 'desc' ? -1 : 1;
  } else {
    sort.createdAt = -1;
  }

  const [rows, total] = await Promise.all([
    User.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const getUserDetail = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('User not found', 404);

  // Fetch linked active sessions and login/activity logs
  const sessions = await RefreshSession.find({ userId }).lean();
  const loginHistory = await AuditLog.find({ actor: userId, action: { $regex: /login|auth/i } })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  const timeline = await AuditLog.find({ $or: [{ actor: userId }, { targetUser: userId }] })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

  return {
    ...user,
    mfaEnabled: false,
    oauthProviders: user.providers || ['LOCAL'],
    sessions,
    loginHistory,
    auditLogs: timeline
  };
};

export const updateUserStatus = async (userId, action, adminId, ip, ua) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const oldValue = user.toJSON();

  if (action === 'suspend') {
    user.isActive = false;
    user.blocked = true;
    await revokeUserSessions(userId);
  } else if (action === 'restore') {
    user.isActive = true;
    user.blocked = false;
  } else if (action === 'verify-email') {
    user.isVerified = true;
    user.emailVerified = true;
  }

  await user.save();
  await logAdminAction({
    action: `user.${action}`,
    actor: adminId,
    targetUser: userId,
    oldValue,
    newValue: user.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return user;
};

export const changeUserRole = async (userId, newRole, adminId, ip, ua) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const oldValue = user.toJSON();
  user.role = newRole;
  user.roles = [newRole];
  await user.save();

  await logAdminAction({
    action: 'user.change_role',
    actor: adminId,
    targetUser: userId,
    oldValue,
    newValue: user.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return user;
};

export const resetUserPassword = async (userId, newPassword, adminId, ip, ua) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  // Directly sets password, model pre-save hook will hash it
  user.password = newPassword;
  await user.save();

  await logAdminAction({
    action: 'user.reset_password',
    actor: adminId,
    targetUser: userId,
    oldValue: { passwordSet: true },
    newValue: { passwordReset: true },
    ipAddress: ip,
    userAgent: ua
  });

  return user;
};

export const softDeleteUser = async (userId, adminId, ip, ua) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError('User not found', 404);

  const oldValue = user.toJSON();
  user.isDeleted = true;
  user.isActive = false;
  user.blocked = true;
  await user.save();
  await revokeUserSessions(userId);

  await logAdminAction({
    action: 'user.soft_delete',
    actor: adminId,
    targetUser: userId,
    oldValue,
    newValue: user.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return user;
};

export const bulkUserAction = async (userIds, action, adminId, ip, ua) => {
  const updates = [];
  for (const id of userIds) {
    try {
      const u = await updateUserStatus(id, action, adminId, ip, ua);
      updates.push(u);
    } catch (e) {
      // Continue for other users
    }
  }
  return { updatedCount: updates.length };
};

export const exportUsersCsv = async (query) => {
  const filter = { isDeleted: { $ne: true } };
  if (query.role) filter.role = query.role;

  const users = await User.find(filter).lean();
  let csv = 'ID,Name,Email,Role,Verified,Blocked,Created At\n';
  users.forEach((u) => {
    csv += `"${u._id}","${u.fullName}","${u.email}","${u.role}",${u.isVerified},${u.blocked},"${u.createdAt?.toISOString()}"\n`;
  });
  return csv;
};

// ==========================================
// 2. Recruiter Management Services
// ==========================================

export const listRecruiters = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    const matchedUsers = await User.find({
      role: 'recruiter',
      fullName: { $regex: query.search, $options: 'i' }
    }).select('_id').lean();
    filter.user = { $in: matchedUsers.map(u => u._id) };
  }

  const [profiles, total] = await Promise.all([
    RecruiterProfile.find(filter)
      .populate('user', 'fullName email role isVerified blocked lastLogin')
      .populate('company', 'name verificationStatus')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    RecruiterProfile.countDocuments(filter)
  ]);

  // Aggregate company membership details for each profile
  const rows = await Promise.all(profiles.map(async (profile) => {
    const membership = await CompanyMember.findOne({ recruiter: profile.user?._id, status: 'active' }).lean();
    return {
      ...profile,
      membershipRole: membership?.role || 'none',
      joinedAt: membership?.createdAt || null
    };
  }));

  return { rows, meta: buildPagination(page, limit, total) };
};

export const getRecruiterDetail = async (recruiterId) => {
  const profile = await RecruiterProfile.findById(recruiterId)
    .populate('user', 'fullName email role isVerified blocked')
    .populate('company', 'name verificationStatus')
    .lean();
  if (!profile) throw new AppError('Recruiter not found', 404);

  const userId = profile.user?._id;
  const companyId = profile.company?._id;

  const [jobs, interviews, offers, members, logs] = await Promise.all([
    userId ? Job.find({ createdBy: userId }).limit(10).lean() : [],
    companyId ? InterviewSchedule.find({ company: companyId }).limit(10).lean() : [],
    companyId ? Offer.find({ company: companyId }).limit(10).lean() : [],
    companyId ? CompanyMember.find({ company: companyId }).lean() : [],
    userId ? AuditLog.find({ actor: userId }).sort({ timestamp: -1 }).limit(5).lean() : []
  ]);

  return {
    ...profile,
    lastActivity: logs[0]?.timestamp || null,
    jobs,
    interviews,
    offers,
    companyMembers: members
  };
};

export const removeRecruiterFromCompany = async (recruiterId, adminId, ip, ua) => {
  const profile = await RecruiterProfile.findById(recruiterId);
  if (!profile) throw new AppError('Recruiter not found', 404);

  const oldCompany = profile.company;
  profile.company = null;
  profile.isCompanyOwner = false;
  await profile.save();

  if (profile.user) {
    await CompanyMember.deleteOne({ recruiter: profile.user });
  }

  await logAdminAction({
    action: 'recruiter.remove_company',
    actor: adminId,
    company: oldCompany,
    targetUser: profile.user,
    oldValue: { company: oldCompany },
    newValue: { company: null },
    ipAddress: ip,
    userAgent: ua
  });

  return profile;
};

// ==========================================
// 3. Company Management Services
// ==========================================

export const listCompanies = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  if (query.status) {
    filter.verificationStatus = query.status;
  }

  const [rows, total] = await Promise.all([
    Company.find(filter)
      .populate('owner', 'fullName email')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Company.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const getCompanyDetail = async (companyId) => {
  const company = await Company.findById(companyId).populate('owner', 'fullName email').lean();
  if (!company) throw new AppError('Company not found', 404);

  const [team, jobs, offers, claims, assessments, interviews] = await Promise.all([
    CompanyMember.find({ company: companyId }).populate('recruiter', 'fullName email').lean(),
    Job.find({ company: companyId }).limit(10).lean(),
    Offer.find({ company: companyId }).limit(10).lean(),
    mongoose.model('OwnershipClaim').find({ company: companyId }).lean(),
    Assessment.find({ company: companyId }).lean(),
    InterviewSchedule.find({ company: companyId }).lean()
  ]);

  // Dynamic Enterprise Health Score out of 100
  let healthScore = 20; // base points
  if (company.verificationStatus === 'verified') healthScore += 40;
  if (company.website) healthScore += 10;
  if (company.phone) healthScore += 10;
  healthScore += Math.min(team.length * 10, 20);

  return {
    ...company,
    healthScore,
    subscriptionStatus: company.resumeDownloadLimit ? 'Premium Tier' : 'Free Tier',
    team,
    jobs,
    offers,
    claims,
    activeAssessments: assessments.length,
    activeInterviews: interviews.length
  };
};

export const mergeCompanies = async (primaryId, secondaryId, adminId, ip, ua) => {
  const primary = await Company.findById(primaryId);
  const secondary = await Company.findById(secondaryId);
  if (!primary || !secondary) throw new AppError('One or both companies not found', 404);

  // Update company references
  await Promise.all([
    Job.updateMany({ company: secondaryId }, { $set: { company: primaryId } }),
    Offer.updateMany({ company: secondaryId }, { $set: { company: primaryId } }),
    CompanyMember.updateMany({ company: secondaryId }, { $set: { company: primaryId } }),
    RecruiterProfile.updateMany({ company: secondaryId }, { $set: { company: primaryId } }),
    Application.updateMany({ company: secondaryId }, { $set: { company: primaryId } }),
    InterviewSchedule.updateMany({ company: secondaryId }, { $set: { company: primaryId } })
  ]);

  // Remove secondary company
  await Company.deleteOne({ _id: secondaryId });

  await logAdminAction({
    action: 'company.merge',
    actor: adminId,
    company: primaryId,
    oldValue: { secondaryId },
    newValue: { mergedInto: primaryId },
    ipAddress: ip,
    userAgent: ua
  });

  return primary;
};

// ==========================================
// 4. Job Management Services
// ==========================================

export const listJobs = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.title = { $regex: query.search, $options: 'i' };
  }
  if (query.status) filter.status = query.status;

  const [rows, total] = await Promise.all([
    Job.find(filter)
      .populate('company', 'name')
      .populate('createdBy', 'fullName')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const getJobDetail = async (jobId) => {
  const job = await Job.findById(jobId).populate('company', 'name').populate('createdBy', 'fullName').lean();
  if (!job) throw new AppError('Job not found', 404);

  const [applicants, pipeline] = await Promise.all([
    Application.find({ job: jobId }).populate('candidate', 'fullName email').limit(10).lean(),
    Application.aggregate([
      { $match: { job: new mongoose.Types.ObjectId(jobId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  return {
    ...job,
    candidateCount: applicants.length,
    pipelineDistribution: pipeline,
    applicants
  };
};

export const updateJobStatus = async (jobId, status, adminId, ip, ua) => {
  const job = await Job.findById(jobId);
  if (!job) throw new AppError('Job not found', 404);

  const oldValue = job.toJSON();
  job.status = status;
  await job.save();

  await logAdminAction({
    action: `job.${status}`,
    actor: adminId,
    company: job.company,
    oldValue,
    newValue: job.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return job;
};

export const cloneJob = async (jobId, adminId, ip, ua) => {
  const original = await Job.findById(jobId);
  if (!original) throw new AppError('Job not found', 404);

  const jobData = original.toObject();
  delete jobData._id;
  delete jobData.createdAt;
  delete jobData.updatedAt;
  jobData.title = `Clone of ${jobData.title}`;
  jobData.slug = `${jobData.slug}-cloned-${Date.now()}`;

  const cloned = await Job.create(jobData);

  await logAdminAction({
    action: 'job.clone',
    actor: adminId,
    company: original.company,
    oldValue: { originalId: jobId },
    newValue: { clonedId: cloned._id },
    ipAddress: ip,
    userAgent: ua
  });

  return cloned;
};

// ==========================================
// 5. Candidate Applications stage management
// ==========================================

export const changeApplicationStage = async (applicationId, status, adminId, ip, ua) => {
  const application = await Application.findById(applicationId);
  if (!application) throw new AppError('Application not found', 404);

  const oldValue = application.toJSON();
  application.status = status;
  application.statusHistory.push({
    from: oldValue.status,
    to: status,
    changedBy: adminId,
    changedAt: new Date(),
    adminOverride: true
  });
  await application.save();

  await logAdminAction({
    action: 'application.stage_change',
    actor: adminId,
    application: applicationId,
    company: application.company,
    oldValue,
    newValue: application.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return application;
};

// ==========================================
// 6. Assessments duplication
// ==========================================

export const listAssessments = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.title = { $regex: query.search, $options: 'i' };
  }

  const [rows, total] = await Promise.all([
    Assessment.find(filter)
      .populate('company', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Assessment.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const cloneAssessment = async (assessmentId, adminId, ip, ua) => {
  const original = await Assessment.findById(assessmentId);
  if (!original) throw new AppError('Assessment not found', 404);

  const data = original.toObject();
  delete data._id;
  data.title = `${data.title} (Copy)`;
  const cloned = await Assessment.create(data);

  await logAdminAction({
    action: 'assessment.clone',
    actor: adminId,
    company: original.company,
    oldValue: { originalId: assessmentId },
    newValue: { clonedId: cloned._id },
    ipAddress: ip,
    userAgent: ua
  });

  return cloned;
};

export const forceSubmitAttempt = async (attemptId, adminId, ip, ua) => {
  const attempt = await AssessmentAttempt.findById(attemptId);
  if (!attempt) throw new AppError('Assessment attempt not found', 404);

  const oldValue = attempt.toJSON();
  attempt.status = 'completed';
  attempt.submittedAt = new Date();
  await attempt.save();

  await logAdminAction({
    action: 'assessment.force_submit',
    actor: adminId,
    oldValue,
    newValue: attempt.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return attempt;
};

// ==========================================
// 7. Question Bank Management Services
// ==========================================

export const listQuestions = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.title = { $regex: query.search, $options: 'i' };
  }
  if (query.difficulty) filter.difficulty = query.difficulty;

  const [rows, total] = await Promise.all([
    Question.find(filter)
      .populate('company', 'name')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Question.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const getQuestionById = async (questionId) => {
  const question = await Question.findById(questionId)
    .populate('company', 'name')
    .lean();
  if (!question) throw new AppError('Question not found', 404);
  return question;
};

export const bulkImportQuestions = async (questionsData, adminId, ip, ua) => {
  const created = await Question.insertMany(questionsData);

  await logAdminAction({
    action: 'question.bulk_import',
    actor: adminId,
    oldValue: {},
    newValue: { count: created.length },
    ipAddress: ip,
    userAgent: ua
  });

  return created;
};

// ==========================================
// 8. Documents Management Services
// ==========================================

export const listDocuments = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.originalFileName = { $regex: query.search, $options: 'i' };
  }
  if (query.malwareStatus) {
    filter['malwareScan.status'] = query.malwareStatus;
  }

  const [rows, total, totalBytes] = await Promise.all([
    Document.find(filter)
      .populate('owner', 'fullName email')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Document.countDocuments(filter),
    Document.aggregate([
      { $group: { _id: null, sum: { $sum: '$sizeBytes' } } }
    ])
  ]);

  return {
    rows,
    storageUsageBytes: totalBytes[0]?.sum || 0,
    meta: buildPagination(page, limit, total)
  };
};

export const updateDocumentStatus = async (documentId, action, adminId, ip, ua) => {
  const document = await Document.findById(documentId);
  if (!document) throw new AppError('Document not found', 404);

  const oldValue = document.toJSON();

  if (action === 'quarantine') {
    document.status = 'quarantined';
    document.malwareScan.status = 'suspicious';
  } else if (action === 'release') {
    document.status = 'active';
    document.malwareScan.status = 'clean';
  }

  await document.save();

  await logAdminAction({
    action: `document.${action}`,
    actor: adminId,
    oldValue,
    newValue: document.toJSON(),
    ipAddress: ip,
    userAgent: ua
  });

  return document;
};

// ==========================================
// 9. Notification Management Services
// ==========================================

export const broadcastNotification = async (title, body, adminId, ip, ua) => {
  const activeUsers = await User.find({ isDeleted: { $ne: true }, blocked: false }).select('_id').lean();

  const notifications = activeUsers.map((u) => ({
    recipient: u._id,
    title,
    body,
    status: 'unread',
    createdAt: new Date()
  }));

  await Notification.insertMany(notifications);

  await logAdminAction({
    action: 'notification.broadcast',
    actor: adminId,
    oldValue: {},
    newValue: { title, count: activeUsers.length },
    ipAddress: ip,
    userAgent: ua
  });

  return { sentCount: activeUsers.length };
};

export const listEmailLogs = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.to = { $regex: query.search, $options: 'i' };
  }
  if (query.status) filter.status = query.status;

  const [rows, total] = await Promise.all([
    EmailLog.find(filter)
      .populate('recipient', 'fullName email')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    EmailLog.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};

export const retryFailedEmailLog = async (logId, adminId, ip, ua) => {
  const log = await EmailLog.findById(logId);
  if (!log) throw new AppError('Email log not found', 404);

  // Update status back to queued to let outgoing worker pick it up
  log.status = 'queued';
  log.attempt += 1;
  await log.save();

  await logAdminAction({
    action: 'email_log.retry',
    actor: adminId,
    oldValue: { logId, status: 'failed' },
    newValue: { logId, status: 'queued' },
    ipAddress: ip,
    userAgent: ua
  });

  return log;
};

// ==========================================
// 10. Global Audit Logs Services
// ==========================================

export const listAuditLogs = async (query) => {
  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 20, 10);
  const filter = {};

  if (query.search) {
    filter.action = { $regex: query.search, $options: 'i' };
  }
  if (query.actor) {
    if (mongoose.Types.ObjectId.isValid(query.actor)) {
      filter.actor = query.actor;
    }
  }
  if (query.ipAddress) filter.ipAddress = query.ipAddress;

  const [rows, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'fullName email')
      .populate('company', 'name')
      .populate('targetUser', 'fullName email')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter)
  ]);

  return { rows, meta: buildPagination(page, limit, total) };
};
