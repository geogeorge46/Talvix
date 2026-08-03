import mongoose from 'mongoose';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { Job } from '../models/Job.js';
import { Application } from '../models/Application.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { InterviewRound } from '../models/InterviewRound.js';
import { Offer } from '../models/Offer.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';

// Cache map: key -> { data, expiresAt }
const analyticsCache = new Map();
const TTL = 10000; // 10 seconds default TTL

export const invalidateAnalyticsCache = (companyId) => {
  const companyKey = String(companyId);
  analyticsCache.delete(`recruiter-dash-${companyKey}`);
  analyticsCache.delete(`company-dash-${companyKey}`);
  analyticsCache.delete(`recruiter-analytics-${companyKey}`);
};

const getOrSetCache = async (key, queryFn) => {
  const cached = analyticsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  const data = await queryFn();
  analyticsCache.set(key, { data, expiresAt: Date.now() + TTL });
  return data;
};

export const fetchRecruiterDashboard = async (actor, companyId) => {
  const companyKey = String(companyId);
  return getOrSetCache(`recruiter-dash-${companyKey}`, async () => {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const [
      activeJobs,
      draftJobs,
      closedJobs,
      totalApplications,
      interviewsScheduled,
      offersSent,
      candidatesHired,
      teamMembers,
      audits
    ] = await Promise.all([
      Job.countDocuments({ company: companyId, status: 'published' }),
      Job.countDocuments({ company: companyId, status: 'draft' }),
      Job.countDocuments({ company: companyId, status: 'closed' }),
      Application.countDocuments({ company: companyId }),
      InterviewSchedule.countDocuments({ company: companyId, status: { $in: ['proposed', 'confirmed'] } }),
      Offer.countDocuments({ company: companyId, status: 'sent' }),
      Application.countDocuments({ company: companyId, status: 'hired' }),
      CompanyMember.countDocuments({ company: companyId, status: 'active' }),
      AuditLog.find({ company: companyObjectId })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('actor', 'fullName email')
    ]);

    const recentActivity = audits.map((log) => ({
      id: log._id,
      type: log.action,
      description: `${log.actor?.fullName || 'System'} performed ${log.action.replaceAll('_', ' ').replaceAll('.', ' · ')}`,
      timestamp: log.timestamp,
      user: log.actor?.fullName || 'System'
    }));

    const quickActions = [
      { label: 'Create Job', to: '/org/jobs/new', permission: 'jobs.create' },
      { label: 'Invite Recruiter', to: '/org/team', permission: 'team.manage' },
      { label: 'View Candidates', to: '/org/candidates', permission: 'applications.view' },
      { label: 'Schedule Interview', to: '/org/interviews', permission: 'interviews.schedule' },
      { label: 'Company Settings', to: '/org/company', permission: 'company.manage' }
    ];

    return {
      metrics: {
        activeJobs,
        draftJobs,
        closedJobs,
        totalApplications,
        interviewsScheduled,
        offersSent,
        candidatesHired,
        teamMembers
      },
      recentActivity,
      quickActions
    };
  });
};

export const fetchCompanyDashboard = async (companyId) => {
  const companyKey = String(companyId);
  return getOrSetCache(`company-dash-${companyKey}`, async () => {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);
    const company = await Company.findById(companyId);
    if (!company) throw new AppError('Company not found', 404);

    // Calculate Company Score
    let score = 50;
    if (company.description) score += 15;
    if (company.website) score += 15;
    if (company.industry) score += 10;
    if (company.companySize) score += 5;
    if (company.headquarters?.city) score += 5;

    const [
      recruiterCount,
      activeJobsCount,
      teamMembersList,
      totalApplications,
      interviewsCompleted,
      offersAccepted,
      offersTotal,
      hiredApps
    ] = await Promise.all([
      CompanyMember.countDocuments({ company: companyId, status: 'active' }),
      Job.countDocuments({ company: companyId, status: 'published' }),
      CompanyMember.find({ company: companyId, status: 'active' }).populate('recruiter', 'fullName email'),
      Application.countDocuments({ company: companyId }),
      InterviewRound.countDocuments({ company: companyId, status: 'completed' }),
      Offer.countDocuments({ company: companyId, status: 'accepted' }),
      Offer.countDocuments({ company: companyId }),
      Application.aggregate([
        { $match: { company: companyObjectId, status: 'hired' } },
        { $project: {
            durationDays: {
              $divide: [
                { $subtract: ["$updatedAt", "$submittedAt"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $group: { _id: null, avgDays: { $avg: "$durationDays" } } }
      ])
    ]);

    const teamSummary = {
      primary_admin: teamMembersList.filter(m => m.role === 'primary_admin').map(m => m.recruiter),
      hr_admin: teamMembersList.filter(m => m.role === 'hr_admin').map(m => m.recruiter),
      recruiter: teamMembersList.filter(m => m.role === 'recruiter').map(m => m.recruiter),
      hiring_manager: teamMembersList.filter(m => m.role === 'hiring_manager').map(m => m.recruiter)
    };

    const successRate = offersTotal > 0 ? Math.round((offersAccepted / offersTotal) * 100) : 0;
    const timeToHire = hiredApps[0]?.avgDays ? Math.round(hiredApps[0].avgDays * 10) / 10 : 0;

    return {
      overview: {
        name: company.name,
        verificationStatus: company.verificationStatus,
        companyScore: score,
        industry: company.industry || 'Not provided',
        companySize: company.companySize || 'Not provided',
        recruiterCount,
        activeJobs: activeJobsCount,
        hiringProgress: offersAccepted
      },
      teamSummary,
      statistics: {
        applicationsReceived: totalApplications,
        interviewsCompleted,
        offersAccepted,
        hiringSuccessRate: successRate,
        averageTimeToHire: timeToHire
      }
    };
  });
};

export const fetchRecruiterAnalytics = async (companyId) => {
  const companyKey = String(companyId);
  return getOrSetCache(`recruiter-analytics-${companyKey}`, async () => {
    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const [
      funnelStages,
      jobsPublishedCount,
      totalJobsCount,
      hiredApps,
      offersTotal,
      offersAccepted,
      interviewsCount,
      interviewFeedbacks,
      mostViewedJobs,
      mostAppliedJobs,
      noApplicantJobs,
      expiringJobs,
      totalAttempts,
      completedAttempts,
      passedAttempts,
      avgScoreResult,
      matchDistribution
    ] = await Promise.all([
      Application.aggregate([
        { $match: { company: companyObjectId } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Job.countDocuments({ company: companyId, status: 'published' }),
      Job.countDocuments({ company: companyId }),
      Application.aggregate([
        { $match: { company: companyObjectId, status: 'hired' } },
        { $project: {
            durationDays: {
              $divide: [
                { $subtract: ["$updatedAt", "$submittedAt"] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        { $group: { _id: null, avgDays: { $avg: "$durationDays" } } }
      ]),
      Offer.countDocuments({ company: companyId }),
      Offer.countDocuments({ company: companyId, status: 'accepted' }),
      InterviewSchedule.countDocuments({ company: companyId }),
      InterviewRound.aggregate([
        { $match: { company: companyObjectId, status: 'completed', roundRecommendation: { $exists: true } } },
        { $group: { _id: "$roundRecommendation", count: { $sum: 1 } } }
      ]),
      Job.find({ company: companyId }).sort({ viewsCount: -1 }).limit(5).select('title status viewsCount applicationsCount'),
      Job.find({ company: companyId }).sort({ applicationsCount: -1 }).limit(5).select('title status viewsCount applicationsCount'),
      Job.find({ company: companyId, applicationsCount: 0 }).limit(5).select('title status viewsCount applicationsCount'),
      Job.find({
        company: companyId,
        applicationDeadline: {
          $gt: new Date(),
          $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      }).limit(5).select('title status applicationDeadline'),
      AssessmentAttempt.countDocuments({ company: companyId }),
      AssessmentAttempt.countDocuments({ company: companyId, status: 'completed' }),
      AssessmentAttempt.countDocuments({ company: companyId, status: 'completed', 'evaluation.passed': true }),
      AssessmentAttempt.aggregate([
        { $match: { company: companyObjectId, status: 'completed' } },
        { $group: { _id: null, avgScore: { $avg: "$evaluation.percentage" } } }
      ]),
      Application.aggregate([
        { $match: { company: companyObjectId } },
        { $group: {
            _id: null,
            ninetyPlus: { $sum: { $cond: [{ $gte: ["$skillMatch.score", 90] }, 1, 0] } },
            seventyToEightyNine: { $sum: { $cond: [{ $and: [{ $gte: ["$skillMatch.score", 70] }, { $lt: ["$skillMatch.score", 90] }] }, 1, 0] } },
            fiftyToSixtyNine: { $sum: { $cond: [{ $and: [{ $gte: ["$skillMatch.score", 50] }, { $lt: ["$skillMatch.score", 70] }] }, 1, 0] } },
            underFifty: { $sum: { $cond: [{ $lt: ["$skillMatch.score", 50] }, 1, 0] } }
          }
        }
      ])
    ]);

    // Construct Funnel stages
    const stagesMap = Object.fromEntries(funnelStages.map(s => [s._id, s.count]));
    const getSum = (statuses) => statuses.reduce((sum, st) => sum + (stagesMap[st] || 0), 0);

    const applicationsCount = getSum(['submitted', 'under-review', 'shortlisted', 'assessment-pending', 'assessment-in-progress', 'assessment-completed', 'interview-scheduled', 'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted', 'offer-declined', 'hired', 'rejected', 'withdrawn']);
    const screenedCount = getSum(['shortlisted', 'assessment-pending', 'assessment-in-progress', 'assessment-completed', 'interview-scheduled', 'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted', 'offer-declined', 'hired']);
    const assessmentCompletedCount = getSum(['assessment-completed', 'interview-scheduled', 'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted', 'offer-declined', 'hired']);
    const interviewedCount = getSum(['interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted', 'offer-declined', 'hired']);
    const offersCount = getSum(['offer-sent', 'offer-accepted', 'offer-declined', 'hired']);
    const hiredCount = getSum(['hired']);

    const timeToHire = hiredApps[0]?.avgDays ? Math.round(hiredApps[0].avgDays * 10) / 10 : 0;
    const avgAppsPerJob = totalJobsCount > 0 ? Math.round((applicationsCount / totalJobsCount) * 10) / 10 : 0;
    const offerAcceptanceRate = (offersAccepted + offersTotal > 0) ? Math.round((offersAccepted / (offersAccepted + (offersTotal - offersAccepted))) * 100) : 0;

    // Interview Success Rate
    const feedbackMap = Object.fromEntries(interviewFeedbacks.map(f => [f._id, f.count]));
    const successfulInterviews = (feedbackMap['hire'] || 0) + (feedbackMap['strong-hire'] || 0);
    const totalInterviewsWithDecision = Object.values(feedbackMap).reduce((a, b) => a + b, 0);
    const interviewSuccessRate = totalInterviewsWithDecision > 0 ? Math.round((successfulInterviews / totalInterviewsWithDecision) * 100) : 0;

    // Assessment Analytics
    const completionRate = totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0;
    const averageScore = avgScoreResult[0]?.avgScore ? Math.round(avgScoreResult[0].avgScore * 10) / 10 : 0;
    const passRate = completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0;

    const skillDist = matchDistribution[0] || { ninetyPlus: 0, seventyToEightyNine: 0, fiftyToSixtyNine: 0, underFifty: 0 };
    const aiScoreDistribution = [
      { band: '90-100%', count: skillDist.ninetyPlus },
      { band: '70-89%', count: skillDist.seventyToEightyNine },
      { band: '50-69%', count: skillDist.fiftyToSixtyNine },
      { band: '<50%', count: skillDist.underFifty }
    ];

    return {
      hiringFunnel: {
        jobsPublished: jobsPublishedCount,
        applications: applicationsCount,
        screened: screenedCount,
        assessmentCompleted: assessmentCompletedCount,
        interviewed: interviewedCount,
        offers: offersCount,
        hired: hiredCount
      },
      performanceMetrics: {
        averageTimeToHire: timeToHire,
        averageApplicationsPerJob: avgAppsPerJob,
        offerAcceptanceRate,
        recruiterProductivity: interviewsCount,
        interviewSuccessRate
      },
      jobPerformance: {
        mostViewedJobs,
        mostAppliedJobs,
        jobsWithNoApplicants: noApplicantJobs,
        expiringJobs
      },
      assessmentAnalytics: {
        assessmentCompletionRate: completionRate,
        averageScores: averageScore,
        passRate,
        aiMatchScoreDistribution: aiScoreDistribution
      }
    };
  });
};

export const fetchRecruiterActivityTimeline = async (companyId, query, isOwnerOrAdmin) => {
  const companyObjectId = new mongoose.Types.ObjectId(companyId);
  const filter = { company: companyObjectId };

  if (query.user) {
    filter.actor = new mongoose.Types.ObjectId(query.user);
  }
  if (query.actionType) {
    filter.action = query.actionType;
  }
  if (query.candidate) {
    filter.targetUser = new mongoose.Types.ObjectId(query.candidate);
  }
  if (query.job) {
    const jobObjectId = new mongoose.Types.ObjectId(query.job);
    filter.$or = [
      { "newValue.job": jobObjectId },
      { "newValue.jobId": jobObjectId },
      { "newValue.newValue.jobId": jobObjectId }
    ];
  }
  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from) filter.timestamp.$gte = new Date(query.from);
    if (query.to) filter.timestamp.$lte = new Date(query.to);
  }

  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || '20', 10);
  const skip = (page - 1) * limit;

  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate('actor', 'fullName email')
      .populate('targetUser', 'fullName email')
  ]);

  const rawItems = logs.map(log => ({
    id: log._id,
    user: log.actor ? { id: log.actor._id, fullName: log.actor.fullName, email: log.actor.email } : null,
    action: log.action,
    relatedEntity: log.newValue || log.oldValue || null,
    timestamp: log.timestamp,
    device: log.userAgent || 'Unknown',
    ipAddress: isOwnerOrAdmin ? (log.ipAddress || 'Unknown') : 'Hidden'
  }));

  // Group repeated consecutive events from the same user within 10 minutes
  const items = [];
  for (const item of rawItems) {
    if (items.length === 0) {
      items.push({ ...item, count: 1, occurrences: [item] });
      continue;
    }

    const last = items[items.length - 1];
    const timeDiff = Math.abs(new Date(item.timestamp).getTime() - new Date(last.timestamp).getTime());

    const lastUserId = last.user?.id ? String(last.user.id) : null;
    const currentUserId = item.user?.id ? String(item.user.id) : null;

    if (
      last.action === item.action &&
      lastUserId === currentUserId &&
      timeDiff < 10 * 60 * 1000
    ) {
      last.count += 1;
      last.occurrences.push(item);
    } else {
      items.push({ ...item, count: 1, occurrences: [item] });
    }
  }

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};
