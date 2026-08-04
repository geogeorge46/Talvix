import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Application } from '../models/Application.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Company } from '../models/Company.js';
import { Document } from '../models/Document.js';
import { EmailLog } from '../models/EmailLog.js';
import { InterviewProcess } from '../models/InterviewProcess.js';
import { InterviewSchedule } from '../models/InterviewSchedule.js';
import { Job } from '../models/Job.js';
import { Notification } from '../models/Notification.js';
import { NotificationOutbox } from '../models/NotificationOutbox.js';
import { Offer } from '../models/Offer.js';
import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { StorageReservation } from '../models/StorageReservation.js';
import { User } from '../models/User.js';
import { UserStorageUsage } from '../models/UserStorageUsage.js';
import { BackgroundJob } from '../models/BackgroundJob.js';
import { resolveAnalyticsRange, fillTimeSeriesBuckets } from '../utils/analyticsDateRange.js';
import { analyticsResponse, calculateAverage, calculateRate, comparison } from '../utils/analyticsSerializer.js';

const dateFilter = (range, field = 'createdAt') => ({ [field]: { $gte: range.from, $lte: range.to } });
const oid = (value) => value ? new mongoose.Types.ObjectId(value) : undefined;
const breakdown = async (Model, field, match = {}) => Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: 1 } }, { $sort: { count: -1 } }]);
const counts = async (Model, filters) => Promise.all(filters.map((filter) => Model.countDocuments(filter)));
const series = async (Model, range, match = {}, field = 'createdAt') => { const unit = range.interval; const rows = await Model.aggregate([{ $match: { ...match, ...dateFilter(range, field) } }, { $group: { _id: { $dateTrunc: { date: `$${field}`, unit, ...(unit === 'week' && { startOfWeek: 'monday' }) } }, value: { $sum: 1 } } }, { $project: { _id: 0, date: '$_id', value: 1 } }, { $sort: { date: 1 } }]); return fillTimeSeriesBuckets({ data: rows, from: range.from, to: range.to, interval: range.interval }); };
const base = (query) => resolveAnalyticsRange(query);
const scoped = (query) => ({ ...(query.companyId && { company: oid(query.companyId) }), ...(query.jobId && { job: oid(query.jobId) }), ...(query.status && { status: query.status }), ...(query.recruiterId && { createdBy: oid(query.recruiterId) }), ...(query.assessmentId && { assessment: oid(query.assessmentId) }), ...(query.department && { department: query.department }), ...(query.university && { 'education.institution': query.university }) });

export const users = async (query) => { const range = base(query); const filter = { ...(query.role && { role: query.role }) }; const [total, registrations, active, inactive, verified, previous] = await counts(User, [filter, { ...filter, ...dateFilter(range) }, { ...filter, isActive: true }, { ...filter, isActive: false }, { ...filter, isVerified: true }, { ...filter, createdAt: { $gte: range.previous.from, $lte: range.previous.to } }]); return analyticsResponse(range, { total, registrations: comparison(registrations, previous), active, suspendedOrDeactivated: inactive, verifiedEmail: verified, unverifiedEmail: total - verified }, await series(User, range, filter), { roles: await breakdown(User, 'role', filter), status: [{ key: 'active', count: active }, { key: 'inactive', count: inactive }], emailVerification: [{ key: 'verified', count: verified }, { key: 'unverified', count: total - verified }] }); };

export const candidates = async (query) => {
  const range = base(query);
  const filter = {
    ...(query.university && { 'education.institution': query.university }),
    ...(query.department && { 'education.fieldOfStudy': query.department })
  };
  if (query.search) {
    const matchedUsers = await User.find({
      role: 'candidate',
      fullName: { $regex: query.search, $options: 'i' }
    }).select('_id').lean();
    filter.user = { $in: matchedUsers.map(u => u._id) };
  }
  const [total, completed, resumes, candidateUsers, applicants, hired] = await Promise.all([
    CandidateProfile.countDocuments(filter),
    CandidateProfile.countDocuments({ ...filter, profileCompletion: { $gte: 80 } }),
    CandidateProfile.countDocuments({ ...filter, resumeDocument: { $ne: null } }),
    User.countDocuments({ role: 'candidate', isActive: true }),
    Application.distinct('candidate'),
    Application.distinct('candidate', { status: 'hired' })
  ]);
  const totalApps = await Application.countDocuments();
  const hiredApps = await Application.countDocuments({ status: 'hired' });
  const totalInterviews = await InterviewSchedule.countDocuments();
  const completedInterviews = await InterviewSchedule.countDocuments({ status: 'completed' });
  const totalOffers = await Offer.countDocuments();
  const acceptedOffers = await Offer.countDocuments({ status: 'accepted' });
  
  const experiencePipeline = [
    { $match: filter },
    {
      $project: {
        totalExperienceDays: {
          $reduce: {
            input: { $ifNull: ['$experience', []] },
            initialValue: 0,
            in: {
              $add: [
                '$$value',
                {
                  $divide: [
                    {
                      $subtract: [
                        { $ifNull: ['$$this.endDate', new Date()] },
                        '$$this.startDate'
                      ]
                    },
                    1000 * 60 * 60 * 24
                  ]
                }
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        level: {
          $cond: [
            { $lt: ['$totalExperienceDays', 365 * 2] },
            'Entry Level (0-2y)',
            {
              $cond: [
                { $lt: ['$totalExperienceDays', 365 * 5] },
                'Mid Level (2-5y)',
                'Senior Level (5y+)'
              ]
            }
          ]
        }
      }
    },
    {
      $group: {
        _id: '$level',
        count: { $sum: 1 }
      }
    },
    { $project: { _id: 0, key: '$_id', count: 1 } }
  ];
  
  const experienceLevels = await CandidateProfile.aggregate(experiencePipeline);
  const topUniversities = await CandidateProfile.aggregate([
    { $match: filter },
    { $unwind: '$education' },
    { $group: { _id: '$education.institution', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, key: '$_id', count: 1 } }
  ]);
  const topSkills = await CandidateProfile.aggregate([
    { $match: filter },
    { $unwind: '$skills' },
    { $group: { _id: '$skills.name', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    { $project: { _id: 0, key: '$_id', count: 1 } }
  ]);
  
  const pipelineDistribution = await Application.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, key: '$_id', count: 1 } }
  ]);

  return analyticsResponse(
    range,
    {
      totalProfiles: total,
      completedProfiles: completed,
      incompleteProfiles: total - completed,
      activeCandidates: candidateUsers,
      withResumes: resumes,
      withoutResumes: total - resumes,
      withApplications: applicants.length,
      withoutApplications: Math.max(0, total - applicants.length),
      hiredCandidates: hired.length,
      applicationSuccessRate: calculateRate(hiredApps, totalApps),
      interviewConversionRate: calculateRate(completedInterviews, totalInterviews),
      offerConversionRate: calculateRate(acceptedOffers, totalOffers),
      hiringConversionRate: calculateRate(hired.length, total || 1)
    },
    await series(CandidateProfile, range, filter),
    {
      completionBands: await CandidateProfile.aggregate([
        { $match: filter },
        { $bucket: { groupBy: '$profileCompletion', boundaries: [0, 25, 50, 75, 101], default: 'unknown', output: { count: { $sum: 1 } } } }
      ]),
      topUniversities,
      topSkills,
      experienceLevels,
      pipelineDistribution
    }
  );
};

export const recruiters = async (query) => {
  const range = base(query);
  const [total, approved, pending, activeMembership, withoutCompany, added] = await counts(RecruiterProfile, [
    {},
    { isApproved: true },
    { isApproved: false },
    { company: { $ne: null }, isApproved: true },
    { company: null },
    dateFilter(range)
  ]);
  const [jobs, interviews, offers] = await Promise.all([
    Job.countDocuments(),
    InterviewSchedule.countDocuments(),
    Offer.countDocuments()
  ]);
  
  const recruiterQuery = { role: 'recruiter', isActive: true };
  if (query.companyId) {
    const profiles = await RecruiterProfile.find({ company: oid(query.companyId) }).select('user').lean();
    recruiterQuery._id = { $in: profiles.map(p => p.user) };
  }
  if (query.search) {
    recruiterQuery.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } }
    ];
  }
  
  const totalLeaderboard = await User.countDocuments(recruiterQuery);
  const page = query.page || 1;
  const limit = query.limit || 20;
  const sortField = query.sortBy || 'productivityScore';
  const sortDir = query.sortOrder === 'asc' ? 1 : -1;
  
  const leaderboardPipeline = [
    { $match: recruiterQuery },
    {
      $lookup: {
        from: 'jobs',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$createdBy', '$$userId'] } } },
          { $group: {
              _id: null,
              created: { $sum: 1 },
              published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } }
            }
          }
        ],
        as: 'jobStats'
      }
    },
    { $unwind: { path: '$jobStats', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'interviewschedules',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$scheduledBy', '$$userId'] } } },
          { $count: 'count' }
        ],
        as: 'interviewStats'
      }
    },
    { $unwind: { path: '$interviewStats', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'offers',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$createdBy', '$$userId'] } } },
          { $group: {
              _id: null,
              sent: { $sum: { $cond: [{ $ne: ['$sentAt', null] }, 1, 0] } },
              accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }
            }
          }
        ],
        as: 'offerStats'
      }
    },
    { $unwind: { path: '$offerStats', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'applications',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $in: ['$$userId', '$statusHistory.changedBy'] } } },
          { $count: 'count' }
        ],
        as: 'appStats'
      }
    },
    { $unwind: { path: '$appStats', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'applications',
        let: { userId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$status', 'hired'] } } },
          { $unwind: '$statusHistory' },
          { $match: { $expr: { $and: [{ $eq: ['$statusHistory.to', 'hired'] }, { $eq: ['$statusHistory.changedBy', '$$userId'] }] } } },
          { $project: {
              duration: { $subtract: ['$statusHistory.changedAt', '$submittedAt'] }
            }
          },
          { $group: {
              _id: null,
              hiredCount: { $sum: 1 },
              totalDuration: { $sum: '$duration' }
            }
          }
        ],
        as: 'hireStats'
      }
    },
    { $unwind: { path: '$hireStats', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        fullName: 1,
        email: 1,
        jobsCreated: { $ifNull: ['$jobStats.created', 0] },
        jobsPublished: { $ifNull: ['$jobStats.published', 0] },
        applicationsProcessed: { $ifNull: ['$appStats.count', 0] },
        interviewsScheduled: { $ifNull: ['$interviewStats.count', 0] },
        offersSent: { $ifNull: ['$offerStats.sent', 0] },
        offersAccepted: { $ifNull: ['$offerStats.accepted', 0] },
        candidatesHired: { $ifNull: ['$hireStats.hiredCount', 0] },
        averageTimeToHireDays: {
          $cond: [
            { $gt: [{ $ifNull: ['$hireStats.hiredCount', 0] }, 0] },
            { $round: [{ $divide: [{ $ifNull: ['$hireStats.totalDuration', 0] }, 1000 * 60 * 60 * 24] }, 1] },
            0
          ]
        }
      }
    },
    {
      $addFields: {
        productivityScore: {
          $add: [
            { $multiply: ['$jobsPublished', 5] },
            { $multiply: ['$applicationsProcessed', 2] },
            { $multiply: ['$interviewsScheduled', 3] },
            { $multiply: ['$offersSent', 4] },
            { $multiply: ['$candidatesHired', 10] }
          ]
        }
      }
    },
    { $sort: { [sortField]: sortDir } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ];
  
  const leaderboard = await User.aggregate(leaderboardPipeline);
  
  const overallHires = leaderboard.filter(r => r.candidatesHired > 0);
  const averageTimeToHire = overallHires.length
    ? Math.round(overallHires.reduce((acc, curr) => acc + curr.averageTimeToHireDays, 0) / overallHires.length * 10) / 10
    : 0;
  const avgProductivityScore = leaderboard.length
    ? Math.round(leaderboard.reduce((acc, curr) => acc + curr.productivityScore, 0) / leaderboard.length)
    : 0;
  
  return analyticsResponse(
    range,
    {
      total,
      approved,
      pending,
      rejectedOrSuspended: Math.max(0, total - approved - pending),
      activeMembership,
      withoutCompanies: withoutCompany,
      addedInRange: added,
      jobsCreated: jobs,
      interviewsScheduled: interviews,
      offersCreated: offers,
      averageTimeToHireDays: averageTimeToHire,
      averageProductivityScore: avgProductivityScore
    },
    await series(RecruiterProfile, range),
    {
      approval: [{ key: 'approved', count: approved }, { key: 'pending', count: pending }],
      leaderboard,
      pagination: {
        total: totalLeaderboard,
        page,
        limit,
        pages: Math.ceil(totalLeaderboard / limit)
      }
    }
  );
};

export const companies = async (query) => { const range = base(query); const filter = { ...(query.industry && { industry: query.industry }) }; const [total, verified, pending, rejected, suspended, newCompanies] = await counts(Company, [filter, { ...filter, verificationStatus: 'verified' }, { ...filter, verificationStatus: 'pending' }, { ...filter, verificationStatus: 'rejected' }, { ...filter, verificationStatus: 'suspended' }, { ...filter, ...dateFilter(range) }]); const [companiesWithJobs, companiesWithHires, jobs, applications, hires] = await Promise.all([Job.distinct('company'), Application.distinct('company', { status: 'hired' }), Job.countDocuments(), Application.countDocuments(), Application.countDocuments({ status: 'hired' })]); return analyticsResponse(range, { total, verified, pending, rejected, suspended, newInRange: newCompanies, withActiveJobs: (await Job.distinct('company', { status: 'published' })).length, withoutJobs: Math.max(0, total - companiesWithJobs.length), withHires: companiesWithHires.length, averageJobs: calculateAverage(jobs, total), averageApplications: calculateAverage(applications, total), averageHires: calculateAverage(hires, total) }, await series(Company, range, filter), { verificationStatus: await breakdown(Company, 'verificationStatus', filter), industry: await breakdown(Company, 'industry', filter), companySize: await breakdown(Company, 'companySize', filter) }); };

export const jobs = async (query) => {
  const range = base(query);
  const filter = {
    ...scoped(query),
    ...(query.workMode && { workMode: query.workMode }),
    ...(query.employmentType && { employmentType: query.employmentType })
  };
  if (query.search) {
    filter.title = { $regex: query.search, $options: 'i' };
  }
  
  const total = await Job.countDocuments(filter);
  const status = await breakdown(Job, 'status', filter);
  const applications = await Application.countDocuments(query.companyId ? { company: oid(query.companyId) } : {});
  const zeroApplications = await Job.countDocuments({ ...filter, applicationsCount: 0 });
  const created = await Job.countDocuments({ ...filter, ...dateFilter(range) });
  
  const jobsData = await Job.aggregate([
    { $match: filter },
    { $group: {
        _id: null,
        views: { $sum: '$viewsCount' },
        appCount: { $sum: '$applicationsCount' }
      }
    }
  ]);
  
  const totalViews = jobsData[0]?.views ?? 0;
  const totalApps = jobsData[0]?.appCount ?? 0;
  const applyConversionRate = calculateRate(totalApps, totalViews);
  
  const topJobs = await Job.find(filter).sort({ applicationsCount: -1 }).limit(5).select('title department status applicationsCount viewsCount').lean();
  const lowJobs = await Job.find(filter).sort({ applicationsCount: 1 }).limit(5).select('title department status applicationsCount viewsCount').lean();
  
  const deptPerformance = await Job.aggregate([
    { $match: filter },
    { $group: { _id: '$department', jobsCount: { $sum: 1 }, applications: { $sum: '$applicationsCount' }, views: { $sum: '$viewsCount' } } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: '$applications', jobsCount: 1, views: 1 } }
  ]);
  
  const locPerformance = await Job.aggregate([
    { $match: filter },
    { $group: { _id: '$location.city', count: { $sum: '$applicationsCount' } } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: 1 } }
  ]);
  
  const durationStats = await Application.aggregate([
    { $match: { ...filter, status: 'hired' } },
    { $unwind: '$statusHistory' },
    { $match: { 'statusHistory.to': 'hired' } },
    { $project: { duration: { $subtract: ['$statusHistory.changedAt', '$submittedAt'] } } },
    { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
  ]);
  const averageHiringDurationDays = durationStats[0] ? Math.round(durationStats[0].avgDuration / (1000 * 60 * 60 * 24) * 10) / 10 : 0;

  return analyticsResponse(
    range,
    {
      total,
      createdInRange: created,
      active: await Job.countDocuments({ ...filter, status: 'published' }),
      draft: await Job.countDocuments({ ...filter, status: 'draft' }),
      pendingApproval: await Job.countDocuments({ ...filter, status: 'pending-review' }),
      rejected: await Job.countDocuments({ ...filter, status: 'rejected' }),
      closed: await Job.countDocuments({ ...filter, status: 'closed' }),
      expired: await Job.countDocuments({ ...filter, applicationDeadline: { $lt: new Date() } }),
      averageApplications: calculateAverage(applications, total),
      zeroApplications,
      jobsWithHires: (await Application.distinct('job', { status: 'hired' })).length,
      totalViews,
      totalApplications: totalApps,
      applyConversionRate,
      averageHiringDurationDays
    },
    await series(Job, range, filter),
    {
      status,
      employmentType: await breakdown(Job, 'employmentType', filter),
      workMode: await breakdown(Job, 'workMode', filter),
      topJobs,
      lowJobs,
      departmentPerformance: deptPerformance,
      locationPerformance: locPerformance
    }
  );
};

const funnelStages = [{ stage: 'submitted', statuses: ['submitted'] }, { stage: 'reviewed', statuses: ['under-review'] }, { stage: 'shortlisted', statuses: ['shortlisted'] }, { stage: 'assessed', statuses: ['assessment-pending', 'assessment-in-progress', 'assessment-completed'] }, { stage: 'interviewed', statuses: ['interview-scheduled', 'interview-completed'] }, { stage: 'offered', statuses: ['offer-pending', 'offer-sent', 'offer-accepted', 'offer-declined'] }, { stage: 'hired', statuses: ['hired'] }];
export const applications = async (query) => { const range = base(query); const filter = scoped(query); const records = await Application.find(filter).select('status statusHistory submittedAt').lean(); const reached = (record, statuses) => statuses.some((status) => record.status === status || record.statusHistory.some((entry) => entry.to === status)); const funnel = funnelStages.map((definition, index) => { const count = records.filter((record) => reached(record, definition.statuses)).length; const previous = index ? records.filter((record) => reached(record, funnelStages[index - 1].statuses)).length : count; return { stage: definition.stage, count, conversionFromPrevious: calculateRate(count, previous), conversionFromSubmitted: calculateRate(count, records.length) }; }); const rejected = records.filter((row) => row.status === 'rejected').length; const withdrawn = records.filter((row) => row.status === 'withdrawn').length; return analyticsResponse(range, { total: records.length, submittedInRange: await Application.countDocuments({ ...filter, submittedAt: { $gte: range.from, $lte: range.to } }), hired: records.filter((row) => row.status === 'hired').length, rejected, withdrawn, rejectionRate: calculateRate(rejected, records.length), withdrawalRate: calculateRate(withdrawn, records.length) }, await series(Application, range, filter, 'submittedAt'), { currentStatus: await breakdown(Application, 'status', filter), funnel }); };

export const assessments = async (query) => {
  const range = base(query);
  const filter = scoped(query);
  const attempts = await AssessmentAttempt.countDocuments(filter);
  const completed = await AssessmentAttempt.countDocuments({ ...filter, status: 'completed' });
  const expired = await AssessmentAttempt.countDocuments({ ...filter, status: 'expired' });
  const reviewed = await AssessmentAttempt.countDocuments({ ...filter, 'questionResults.requiresManualReview': true });
  
  const scores = await AssessmentAttempt.aggregate([
    { $match: { ...filter, status: 'completed' } },
    { $group: { _id: null, average: { $avg: '$evaluation.percentage' }, passed: { $sum: { $cond: ['$evaluation.passed', 1, 0] } } } }
  ]);
  
  const languageUsage = await AssessmentAttempt.aggregate([
    { $match: filter },
    { $unwind: '$answers' },
    { $match: { 'answers.language': { $ne: null } } },
    { $group: { _id: '$answers.language', count: { $sum: 1 } } },
    { $project: { _id: 0, key: '$_id', count: 1 } }
  ]);
  
  const codingBenchmarks = await AssessmentAttempt.aggregate([
    { $match: filter },
    { $unwind: '$questionResults' },
    { $match: { 'questionResults.codingResult': { $ne: null } } },
    { $group: {
        _id: null,
        avgTime: { $avg: { $toDouble: '$questionResults.codingResult.time' } },
        avgMemory: { $avg: { $toDouble: '$questionResults.codingResult.memory' } }
      }
    }
  ]);
  const averageExecutionTimeMs = codingBenchmarks[0] ? Math.round(codingBenchmarks[0].avgTime * 1000) : 0;
  const averageMemoryUsageKb = codingBenchmarks[0] ? Math.round(codingBenchmarks[0].avgMemory) : 0;
  
  const testPassStats = await AssessmentAttempt.aggregate([
    { $match: filter },
    { $unwind: '$questionResults' },
    { $group: {
        _id: null,
        total: { $sum: 1 },
        correct: { $sum: { $cond: ['$questionResults.isCorrect', 1, 0] } }
      }
    }
  ]);
  const testPassRate = testPassStats[0] ? calculateRate(testPassStats[0].correct, testPassStats[0].total) : 0;
  
  const cheatingIncidents = await AssessmentAttempt.countDocuments({
    ...filter,
    $or: [
      { 'integrity.cheatingRiskScore': { $gt: 50 } },
      { 'integrity.suspiciousEvents.0': { $exists: true } }
    ]
  });
  
  const riskDistribution = await AssessmentAttempt.aggregate([
    { $match: filter },
    { $bucket: { groupBy: '$integrity.cheatingRiskScore', boundaries: [0, 25, 50, 75, 101], default: 'unknown', output: { count: { $sum: 1 } } } }
  ]);

  return analyticsResponse(
    range,
    {
      created: await Assessment.countDocuments({ ...filter, ...dateFilter(range) }),
      active: await Assessment.countDocuments({ ...filter, status: 'published' }),
      assignments: await AssessmentAssignment.countDocuments(filter),
      attempts,
      started: await AssessmentAttempt.countDocuments({ ...filter, startedAt: { $ne: null } }),
      submitted: await AssessmentAttempt.countDocuments({ ...filter, submittedAt: { $ne: null } }),
      completed,
      expired,
      cancelled: await AssessmentAttempt.countDocuments({ ...filter, status: 'cancelled' }),
      reviewRequired: reviewed,
      completionRate: calculateRate(completed, attempts),
      expiryRate: calculateRate(expired, attempts),
      reviewRequiredRate: calculateRate(reviewed, attempts),
      averageScore: Math.round((scores[0]?.average ?? 0) * 100) / 100,
      passRate: calculateRate(scores[0]?.passed ?? 0, completed),
      averageExecutionTimeMs,
      averageMemoryUsageKb,
      testPassRate,
      cheatingIncidents
    },
    await series(AssessmentAttempt, range, filter),
    {
      status: await breakdown(AssessmentAttempt, 'status', filter),
      scoreBands: await AssessmentAttempt.aggregate([
        { $match: filter },
        { $bucket: { groupBy: '$evaluation.percentage', boundaries: [0, 21, 41, 61, 81, 101], default: 'unknown', output: { count: { $sum: 1 } } } }
      ]),
      languageUsage,
      riskDistribution
    }
  );
};

export const interviews = async (query) => { const range = base(query); const filter = scoped(query); const total = await InterviewSchedule.countDocuments(filter); const completed = await InterviewSchedule.countDocuments({ ...filter, status: 'completed' }); const cancelled = await InterviewSchedule.countDocuments({ ...filter, status: 'cancelled' }); const durations = await InterviewSchedule.aggregate([{ $match: filter }, { $group: { _id: null, average: { $avg: '$durationMinutes' } } }]); return analyticsResponse(range, { scheduled: total, accepted: await InterviewSchedule.countDocuments({ ...filter, candidateResponse: 'accepted' }), rescheduleRequests: await InterviewSchedule.countDocuments({ ...filter, status: 'reschedule-requested' }), rescheduled: await InterviewSchedule.countDocuments({ ...filter, status: 'rescheduled' }), cancelled, completed, upcoming: await InterviewSchedule.countDocuments({ ...filter, startTime: { $gt: new Date() } }), averageDurationMinutes: Math.round((durations[0]?.average ?? 0) * 100) / 100, completionRate: calculateRate(completed, total), cancellationRate: calculateRate(cancelled, total) }, await series(InterviewSchedule, range, filter, 'startTime'), { status: await breakdown(InterviewSchedule, 'status', filter), mode: await breakdown(InterviewSchedule, 'mode', filter) }); };

export const offers = async (query) => {
  const range = base(query);
  const filter = scoped(query);
  const total = await Offer.countDocuments(filter);
  const accepted = await Offer.countDocuments({ ...filter, status: 'accepted' });
  const declined = await Offer.countDocuments({ ...filter, status: 'declined' });
  const expired = await Offer.countDocuments({ ...filter, status: 'expired' });
  const sent = await Offer.countDocuments({ ...filter, sentAt: { $ne: null } });
  const revisions = await Offer.aggregate([
    { $match: filter },
    { $group: { _id: null, average: { $avg: '$revision' } } }
  ]);
  
  const salaryStats = await Offer.aggregate([
    { $match: filter },
    { $group: { _id: null, avgBase: { $avg: '$compensation.base' } } }
  ]);
  const averageSalary = salaryStats[0] ? Math.round(salaryStats[0].avgBase) : 0;
  
  const salaryDistribution = await Offer.aggregate([
    { $match: filter },
    { $bucket: { groupBy: '$compensation.base', boundaries: [0, 300000, 600000, 1200000, 2500000, 5000000], default: 'unknown', output: { count: { $sum: 1 } } } }
  ]);
  
  const salaryByDept = await Offer.aggregate([
    { $match: filter },
    { $group: { _id: '$department', avgSalary: { $avg: '$compensation.base' } } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: { $round: ['$avgSalary'] } } }
  ]);
  
  const salaryByCompanySize = await Offer.aggregate([
    { $match: filter },
    { $lookup: { from: 'companies', localField: 'company', foreignField: '_id', as: 'companyDoc' } },
    { $unwind: '$companyDoc' },
    { $group: { _id: '$companyDoc.companySize', avgSalary: { $avg: '$compensation.base' } } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: { $round: ['$avgSalary'] } } }
  ]);
  
  const negotiatedCount = await Offer.countDocuments({
    ...filter,
    status: 'negotiation-requested'
  });
  const offerNegotiationRate = calculateRate(negotiatedCount, total);
  
  const delayStats = await Offer.aggregate([
    { $match: { ...filter, status: 'accepted', sentAt: { $ne: null }, 'candidateResponse.respondedAt': { $ne: null } } },
    { $project: { delay: { $subtract: ['$candidateResponse.respondedAt', '$sentAt'] } } },
    { $group: { _id: null, avgDelay: { $avg: '$delay' } } }
  ]);
  const averageAcceptanceDelayDays = delayStats[0] ? Math.round(delayStats[0].avgDelay / (1000 * 60 * 60 * 24) * 10) / 10 : 0;
  
  const declineReasons = await Offer.aggregate([
    { $match: { ...filter, status: 'declined' } },
    { $group: { _id: '$decline.category', count: { $sum: 1 } } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', 'unknown'] }, count: 1 } }
  ]);

  return analyticsResponse(
    range,
    {
      total,
      drafted: await Offer.countDocuments({ ...filter, status: 'draft' }),
      pendingApproval: await Offer.countDocuments({ ...filter, status: 'pending-approval' }),
      approved: await Offer.countDocuments({ ...filter, status: 'approved' }),
      sent,
      viewed: await Offer.countDocuments({ ...filter, status: 'viewed' }),
      negotiationRequested: await Offer.countDocuments({ ...filter, status: 'negotiation-requested' }),
      accepted,
      declined,
      expired,
      withdrawn: await Offer.countDocuments({ ...filter, status: 'withdrawn' }),
      hiresConfirmed: await Application.countDocuments({ status: 'hired', ...(query.companyId && { company: oid(query.companyId) }) }),
      acceptanceRate: calculateRate(accepted, sent),
      declineRate: calculateRate(declined, sent),
      expiryRate: calculateRate(expired, sent),
      averageRevisions: Math.round((revisions[0]?.average ?? 0) * 100) / 100,
      averageSalary,
      offerNegotiationRate,
      averageAcceptanceDelayDays
    },
    await series(Offer, range, filter),
    {
      status: await breakdown(Offer, 'status', filter),
      salaryDistribution,
      salaryByDept,
      salaryByCompanySize,
      declineReasons
    }
  );
};

export const documents = async (query) => { const range = base(query); const filter = { ...scoped(query), ...(query.category && { category: query.category }) }; const total = await Document.countDocuments(filter); const [storage] = await Document.aggregate([{ $match: { ...filter, status: { $in: ['active', 'archived', 'replaced', 'quarantined'] } } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]); const [reserved] = await UserStorageUsage.aggregate([{ $group: { _id: null, bytes: { $sum: '$reservedBytes' } } }]); const warning = env.FILE_MAX_USER_STORAGE_MB * 1024 * 1024 * 0.8; return analyticsResponse(range, { total, active: await Document.countDocuments({ ...filter, status: 'active' }), archived: await Document.countDocuments({ ...filter, status: 'archived' }), replaced: await Document.countDocuments({ ...filter, status: 'replaced' }), deleted: await Document.countDocuments({ ...filter, status: 'deleted' }), quarantined: await Document.countDocuments({ ...filter, status: 'quarantined' }), suspicious: await Document.countDocuments({ ...filter, 'malwareScan.status': 'suspicious' }), infected: await Document.countDocuments({ ...filter, 'malwareScan.status': 'infected' }), pendingVerification: await Document.countDocuments({ ...filter, 'verification.status': 'pending' }), verified: await Document.countDocuments({ ...filter, 'verification.status': 'verified' }), rejected: await Document.countDocuments({ ...filter, 'verification.status': 'rejected' }), uploadsInRange: await Document.countDocuments({ ...filter, ...dateFilter(range) }), logicalStorage: { bytes: storage?.bytes ?? 0, megabytes: calculateAverage(storage?.bytes ?? 0, 1048576) }, reservedStorage: { bytes: reserved?.bytes ?? 0, megabytes: calculateAverage(reserved?.bytes ?? 0, 1048576) }, usersNearQuota: await UserStorageUsage.countDocuments({ $expr: { $gte: [{ $add: ['$usedBytes', '$reservedBytes'] }, warning] } }), pendingCleanup: await Document.countDocuments({ 'metadata.providerCleanup.status': 'pending' }), staleReservations: await StorageReservation.countDocuments({ status: 'reserved', expiresAt: { $lte: new Date() } }) }, await series(Document, range, filter), { category: await breakdown(Document, 'category', filter), entityType: await breakdown(Document, 'entityType', filter), status: await breakdown(Document, 'status', filter), scanStatus: await breakdown(Document, 'malwareScan.status', filter), verificationStatus: await breakdown(Document, 'verification.status', filter), storageProvider: await breakdown(Document, 'storage.provider', filter) }); };

export const notifications = async (query) => { const range = base(query); const filter = { ...(query.eventType && { eventType: query.eventType }) }; const events = await NotificationOutbox.countDocuments(filter); const failed = await NotificationOutbox.countDocuments({ ...filter, status: 'failed' }); const emailAttempts = await EmailLog.countDocuments(); const emailFailed = await EmailLog.countDocuments({ status: 'failed' }); return analyticsResponse(range, { domainEvents: events, notifications: await Notification.countDocuments(), unread: await Notification.countDocuments({ read: false }), read: await Notification.countDocuments({ read: true }), outboxPending: await NotificationOutbox.countDocuments({ ...filter, status: 'pending' }), outboxProcessing: await NotificationOutbox.countDocuments({ ...filter, status: 'processing' }), outboxCompleted: await NotificationOutbox.countDocuments({ ...filter, status: 'completed' }), outboxFailed: failed, emailAttempts, emailDelivered: await EmailLog.countDocuments({ status: { $in: ['sent', 'delivered'] } }), emailFailures: emailFailed, retryRate: calculateRate(await NotificationOutbox.countDocuments({ ...filter, attempts: { $gt: 1 } }), events), terminalFailureRate: calculateRate(failed, events) }, await series(NotificationOutbox, range, filter), { eventType: await breakdown(NotificationOutbox, 'eventType', filter), outboxStatus: await breakdown(NotificationOutbox, 'status', filter), recipientRole: await breakdown(Notification, 'recipientRole') }); };

export const overview = async (query) => { const range = base(query); const userReport = await users(query); const [companiesTotal, verifiedCompanies, activeJobs, closedJobs, applicationsTotal, hires, assessmentsActive, interviewsScheduled, offersActive] = await Promise.all([Company.countDocuments(), Company.countDocuments({ verificationStatus: 'verified' }), Job.countDocuments({ status: 'published' }), Job.countDocuments({ status: 'closed' }), Application.countDocuments(), Application.countDocuments({ status: 'hired' }), Assessment.countDocuments({ status: 'published' }), InterviewSchedule.countDocuments({ status: { $in: ['proposed', 'confirmed', 'rescheduled'] } }), Offer.countDocuments({ status: { $in: ['draft', 'pending-approval', 'approved', 'sent', 'viewed', 'negotiation-requested', 'accepted'] } })]); const shortlisted = await Application.countDocuments({ statusHistory: { $elemMatch: { to: 'shortlisted' } } }); const interviewed = await Application.countDocuments({ statusHistory: { $elemMatch: { to: 'interview-scheduled' } } }); const offered = await Application.countDocuments({ statusHistory: { $elemMatch: { to: 'offer-sent' } } }); return analyticsResponse(range, { users: userReport.summary, business: { companies: companiesTotal, verifiedCompanies, pendingCompanies: await Company.countDocuments({ verificationStatus: 'pending' }), activeJobs, closedJobs, applications: applicationsTotal, hires, activeAssessments: assessmentsActive, scheduledInterviews: interviewsScheduled, activeOffers: offersActive }, conversion: { applicationToShortlist: calculateRate(shortlisted, applicationsTotal), shortlistToInterview: calculateRate(interviewed, shortlisted), interviewToOffer: calculateRate(offered, interviewed), offerToHire: calculateRate(hires, offered), applicationToHire: calculateRate(hires, applicationsTotal) } }, userReport.series, { roles: userReport.breakdowns.roles }); };

export const health = async (query) => {
  const range = base(query);
  const oldest = await NotificationOutbox.findOne({ status: 'pending' }).sort({ availableAt: 1 }).select('availableAt').lean();
  
  const startMongo = Date.now();
  await mongoose.connection.db.admin().ping();
  const mongoDbLatencyMs = Date.now() - startMongo;
  
  const cpuUsage = process.cpuUsage();
  const cpuPercent = Math.round((cpuUsage.user + cpuUsage.system) / 1000000) % 100 || 2;
  
  const queueSizes = await BackgroundJob.countDocuments({ status: 'pending' });
  const runningJobs = await BackgroundJob.countDocuments({ status: 'processing' });
  const failedJobs = await BackgroundJob.countDocuments({ status: 'failed' });
  const retryCounts = await BackgroundJob.countDocuments({ attempts: { $gt: 1 } });
  
  const recentJob = await BackgroundJob.findOne({
    $or: [
      { status: 'processing' },
      { processedAt: { $gte: new Date(Date.now() - 3600000) } }
    ]
  });
  const backgroundWorkerStatus = recentJob ? 'active' : 'idle';
  
  let judge0Connectivity = 'unknown';
  try {
    const url = env.JUDGE0_URL || 'http://localhost:2358';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const res = await fetch(`${url}/languages`, { signal: controller.signal });
    clearTimeout(timeoutId);
    judge0Connectivity = res.ok ? 'connected' : 'degraded';
  } catch (err) {
    judge0Connectivity = 'failed';
  }
  
  let aiConnectivity = 'unknown';
  try {
    if (env.GEMINI_API_KEY || env.OPENAI_API_KEY) {
      aiConnectivity = 'connected';
    } else {
      aiConnectivity = 'failed';
    }
  } catch (err) {
    aiConnectivity = 'failed';
  }

  let cloudinaryStatus = 'unknown';
  try {
    if (env.CLOUDINARY_URL || (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY)) {
      cloudinaryStatus = 'connected';
    } else {
      cloudinaryStatus = 'failed';
    }
  } catch (err) {
    cloudinaryStatus = 'failed';
  }

  return analyticsResponse(
    range,
    {
      databaseState: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
      mongoDbLatencyMs,
      cpuUsagePercent: cpuPercent,
      backgroundWorkerStatus,
      queueSizes,
      runningJobs,
      failedJobs,
      retryCounts,
      judge0Connectivity,
      aiConnectivity,
      cloudinaryStatus,
      storageProvider: env.FILE_STORAGE_PROVIDER,
      uploadsEnabled: env.FILE_UPLOADS_ENABLED,
      outboxBacklog: await NotificationOutbox.countDocuments({ status: 'pending' }),
      oldestPendingOutboxAgeSeconds: oldest ? Math.max(0, Math.floor((Date.now() - oldest.availableAt) / 1000)) : 0,
      failedOutbox: await NotificationOutbox.countDocuments({ status: 'failed' }),
      staleReservations: await StorageReservation.countDocuments({ status: 'reserved', expiresAt: { $lte: new Date() } }),
      pendingProviderCleanups: await Document.countDocuments({ 'metadata.providerCleanup.status': 'pending' }),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMegabytes: {
        rss: calculateAverage(process.memoryUsage().rss, 1048576),
        heapUsed: calculateAverage(process.memoryUsage().heapUsed, 1048576)
      },
      nodeVersion: process.version
    },
    [],
    {}
  );
};

export const reports = { overview, users, candidates, recruiters, companies, jobs, applications, assessments, interviews, offers, documents, notifications };
