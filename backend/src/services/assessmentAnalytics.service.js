import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { AssessmentAssignment } from '../models/AssessmentAssignment.js';
import { Application } from '../models/Application.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { Assessment } from '../models/Assessment.js';
import { AppError } from '../shared/errors/AppError.js';

export const getLeaderboard = async (company, assessmentId, filters = {}) => {
  const assessment = await Assessment.findOne({ _id: assessmentId, company });
  if (!assessment) throw new AppError('Assessment not found', 404);

  const query = { assessment: assessment._id, company, status: 'completed' };
  if (filters.fromDate || filters.toDate) {
    query.completedAt = {};
    if (filters.fromDate) query.completedAt.$gte = new Date(filters.fromDate);
    if (filters.toDate) query.completedAt.$lte = new Date(filters.toDate);
  }

  // Get completed attempts
  const attempts = await AssessmentAttempt.find(query)
    .populate('candidate', 'fullName email')
    .lean();

  // Find candidate profiles for university / department lookup
  const candidateIds = attempts.map((a) => a.candidate?._id);
  const profiles = await CandidateProfile.find({ user: { $in: candidateIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  // Find highest score per candidate
  const candidateBest = {};
  for (const attempt of attempts) {
    const candidateId = attempt.candidate?._id?.toString();
    if (!candidateId) continue;

    const score = attempt.evaluation?.percentage || 0;
    const duration = attempt.completedAt && attempt.startedAt 
      ? (new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000
      : 0;

    const profile = profileMap.get(candidateId);
    const university = profile?.education?.[0]?.institution || 'N/A';
    const department = profile?.education?.[0]?.fieldOfStudy || 'N/A';

    if (!candidateBest[candidateId] || score > candidateBest[candidateId].score) {
      candidateBest[candidateId] = {
        candidateId,
        fullName: attempt.candidate.fullName,
        email: attempt.candidate.email,
        score,
        duration,
        university,
        department,
        attemptId: attempt._id
      };
    }
  }

  let list = Object.values(candidateBest);

  // Apply filters
  if (filters.university) {
    list = list.filter((item) => item.university.toLowerCase().includes(filters.university.toLowerCase()));
  }
  if (filters.department) {
    list = list.filter((item) => item.department.toLowerCase().includes(filters.department.toLowerCase()));
  }

  // Sort descending by score, ascending by duration
  list.sort((a, b) => b.score - a.score || a.duration - b.duration);

  // Calculate percentiles and ranks
  const total = list.length;
  const ranked = list.map((item, index) => {
    // Percentile = ((Total - rank) / Total) * 100
    const percentile = total > 0 ? Math.round(((total - index) / total) * 100) : 0;
    return {
      rank: index + 1,
      ...item,
      percentile
    };
  });

  return ranked;
};

export const getBenchmarking = async (company, filters = {}) => {
  const query = { company, status: 'completed' };
  
  if (filters.assessmentId) {
    query.assessment = filters.assessmentId;
  }
  if (filters.fromDate || filters.toDate) {
    query.completedAt = {};
    if (filters.fromDate) query.completedAt.$gte = new Date(filters.fromDate);
    if (filters.toDate) query.completedAt.$lte = new Date(filters.toDate);
  }

  const attempts = await AssessmentAttempt.find(query).populate('candidate').lean();
  const candidateIds = attempts.map((a) => a.candidate?._id);
  const profiles = await CandidateProfile.find({ user: { $in: candidateIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  const universityStats = {};
  const departmentStats = {};
  const skillScores = {};

  for (const attempt of attempts) {
    const candidateId = attempt.candidate?._id?.toString();
    if (!candidateId) continue;

    const score = attempt.evaluation?.percentage || 0;
    const passed = attempt.evaluation?.passed || false;

    const profile = profileMap.get(candidateId);
    const university = profile?.education?.[0]?.institution || 'Other/Unknown';
    const department = profile?.education?.[0]?.fieldOfStudy || 'Other/Unknown';

    // University aggregation
    if (!universityStats[university]) {
      universityStats[university] = { total: 0, passedCount: 0, totalScore: 0 };
    }
    universityStats[university].total += 1;
    if (passed) universityStats[university].passedCount += 1;
    universityStats[university].totalScore += score;

    // Department aggregation
    if (!departmentStats[department]) {
      departmentStats[department] = { total: 0, totalScore: 0 };
    }
    departmentStats[department].total += 1;
    departmentStats[department].totalScore += score;

    // Skill score aggregation
    if (attempt.questionResults?.length) {
      for (const res of attempt.questionResults) {
        // Collect skill averages
        if (res.questionId) {
          // Note: attempt.questionResults might not have questions populated, so we aggregate average marks awarded
          const awarded = res.awardedMarks || 0;
          const max = res.marks || 1;
          const percentage = (awarded / max) * 100;
          
          const type = res.questionType || 'General';
          if (!skillScores[type]) {
            skillScores[type] = { total: 0, totalScore: 0 };
          }
          skillScores[type].total += 1;
          skillScores[type].totalScore += percentage;
        }
      }
    }
  }

  const formattedUniversity = Object.entries(universityStats).map(([name, stat]) => ({
    name,
    candidateCount: stat.total,
    passRate: stat.total > 0 ? Math.round((stat.passedCount / stat.total) * 100) : 0,
    averageScore: stat.total > 0 ? Math.round((stat.totalScore / stat.total) * 10) / 10 : 0
  })).sort((a, b) => b.averageScore - a.averageScore);

  const formattedDepartment = Object.entries(departmentStats).map(([name, stat]) => ({
    name,
    candidateCount: stat.total,
    averageScore: stat.total > 0 ? Math.round((stat.totalScore / stat.total) * 10) / 10 : 0
  })).sort((a, b) => b.averageScore - a.averageScore);

  const formattedSkills = Object.entries(skillScores).map(([name, stat]) => ({
    skill: name,
    averagePercentage: stat.total > 0 ? Math.round((stat.totalScore / stat.total) * 10) / 10 : 0
  }));

  return {
    universityPerformance: formattedUniversity,
    departmentPerformance: formattedDepartment,
    skillDistribution: formattedSkills
  };
};

export const getCohortLeaderboard = async (company, assessmentId, filters = {}) => {
  const assessment = await Assessment.findOne({ _id: assessmentId, company });
  if (!assessment) throw new AppError('Assessment not found', 404);

  // Match assignments for this assessment & company
  const assignmentMatch = { assessment: assessment._id, company };
  if (filters.jobId) {
    const jobAppIds = await Application.find({ job: filters.jobId, company }).distinct('_id');
    assignmentMatch.application = { $in: jobAppIds };
  }

  const assignments = await AssessmentAssignment.find(assignmentMatch)
    .populate('candidate', 'fullName email')
    .populate('application', 'job status applicationNumber')
    .populate('latestAttempt')
    .populate('bestAttempt')
    .lean();

  const candidateIds = assignments.map((a) => a.candidate?._id).filter(Boolean);
  const profiles = await CandidateProfile.find({ user: { $in: candidateIds } }).lean();
  const profileMap = new Map(profiles.map((p) => [p.user.toString(), p]));

  const now = new Date();

  // Process each assigned candidate
  const rows = assignments.map((assignment) => {
    const candidateId = assignment.candidate?._id?.toString() || '';
    const profile = profileMap.get(candidateId);
    const university = profile?.education?.[0]?.institution || 'N/A';
    const department = profile?.education?.[0]?.fieldOfStudy || 'N/A';

    // Derive display status
    let displayStatus = 'not-started';
    if (assignment.status === 'cancelled') {
      displayStatus = 'cancelled';
    } else if (assignment.resultReleasedAt) {
      displayStatus = 'result-released';
    } else if (assignment.status === 'completed') {
      displayStatus = 'completed';
    } else if (assignment.status === 'evaluating') {
      displayStatus = 'under-review';
    } else if (assignment.status === 'in-progress') {
      displayStatus = 'in-progress';
    } else if (assignment.expiresAt < now) {
      displayStatus = 'overdue';
    } else if (['assigned', 'available'].includes(assignment.status)) {
      displayStatus = 'not-started';
    }

    // Attempt selection policy:
    // When completed, prioritize bestAttempt (highest scored).
    // Otherwise, inspect latestAttempt (in-progress or pending-review attempt).
    const chosenAttempt = assignment.bestAttempt || assignment.latestAttempt || null;

    let score = null;
    let percentage = null;
    let passed = null;
    let isProvisional = false;
    let durationSeconds = 0;
    const categoryScores = [];

    if (chosenAttempt) {
      if (chosenAttempt.status === 'review-pending') {
        displayStatus = 'under-review';
      }

      if (['completed', 'review-pending'].includes(chosenAttempt.status)) {
        score = chosenAttempt.evaluation?.totalScore ?? null;
        percentage = chosenAttempt.evaluation?.percentage ?? null;
        passed = chosenAttempt.evaluation?.passed ?? null;

        if (chosenAttempt.startedAt && chosenAttempt.completedAt) {
          durationSeconds = Math.round((new Date(chosenAttempt.completedAt).getTime() - new Date(chosenAttempt.startedAt).getTime()) / 1000);
        } else if (chosenAttempt.startedAt && chosenAttempt.submittedAt) {
          durationSeconds = Math.round((new Date(chosenAttempt.submittedAt).getTime() - new Date(chosenAttempt.startedAt).getTime()) / 1000);
        }

        // Check if any subjective question still requires manual review
        const hasPendingReview = chosenAttempt.questionResults?.some((qr) => qr.requiresManualReview);
        if (hasPendingReview || chosenAttempt.status === 'review-pending') {
          isProvisional = true;
        }

        // Calculate category breakdown from the immutable snapshot
        const snapshotQuestions = assignment.assessmentSnapshot?.questions || [];
        const categoryMap = new Map();

        // Map questionId -> questionResult
        const qrMap = new Map((chosenAttempt.questionResults || []).map((qr) => [qr.questionId.toString(), qr]));

        for (const sq of snapshotQuestions) {
          const catName = sq.category || sq.type || 'General';
          if (!categoryMap.has(catName)) {
            categoryMap.set(catName, { category: catName, totalMarks: 0, awardedMarks: 0, questionCount: 0, pendingReview: false });
          }
          const cat = categoryMap.get(catName);
          cat.totalMarks += (sq.marks || 0);
          cat.questionCount += 1;

          const qr = qrMap.get(sq.questionId.toString());
          if (qr) {
            cat.awardedMarks += (qr.awardedMarks || 0);
            if (qr.requiresManualReview) cat.pendingReview = true;
          }
        }

        for (const cat of categoryMap.values()) {
          const catPct = cat.totalMarks > 0 ? Math.round((cat.awardedMarks / cat.totalMarks) * 1000) / 10 : 0;
          categoryScores.push({
            category: cat.category,
            totalMarks: cat.totalMarks,
            awardedMarks: Math.round(cat.awardedMarks * 100) / 100,
            percentage: catPct,
            isProvisional: cat.pendingReview,
          });
        }
      }
    }

    return {
      assignmentId: assignment._id,
      attemptId: chosenAttempt?._id?.toString() || null,
      applicationId: assignment.application?._id,
      applicationNumber: assignment.application?.applicationNumber,
      candidateId,
      candidateName: assignment.candidate?.fullName || 'Unknown Candidate',
      candidateEmail: assignment.candidate?.email || '',
      status: displayStatus,
      rawStatus: assignment.status,
      attemptStatus: chosenAttempt?.status || null,
      attemptNumber: chosenAttempt?.attemptNumber || 0,
      attemptsUsed: assignment.attemptsUsed || 0,
      maximumAttempts: assignment.assessmentSnapshot?.maximumAttempts || 1,
      score,
      percentage,
      passed,
      isProvisional,
      durationSeconds,
      submittedAt: chosenAttempt?.submittedAt || null,
      resultReleasedAt: assignment.resultReleasedAt || null,
      categoryScores,
      university,
      department,
    };
  });

  // Filter by display status if specified
  let filtered = rows;
  if (filters.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }

  // Filter by category presence if specified
  if (filters.category) {
    filtered = filtered.filter((r) => r.categoryScores.some((cs) => cs.category.toLowerCase().includes(filters.category.toLowerCase())));
  }

  // Ranking & Tie-breaking policy:
  // 1. Final evaluated scores rank ahead of provisional scores.
  // 2. Provisional scores rank ahead of unsubmitted candidates.
  // 3. For evaluated scores: Highest percentage first.
  // 4. Tie-breaker 1: Lower durationSeconds (faster completion).
  // 5. Tie-breaker 2: Earlier submittedAt timestamp.
  const rankable = [];
  const unranked = [];

  for (const row of filtered) {
    if (row.percentage !== null) {
      rankable.push(row);
    } else {
      unranked.push({ ...row, rank: null });
    }
  }

  rankable.sort((a, b) => {
    // 1. Non-provisional (final) ahead of provisional
    if (a.isProvisional !== b.isProvisional) {
      return a.isProvisional ? 1 : -1;
    }
    // 2. Highest percentage
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    // 3. Tie-breaker 1: Duration (faster first, non-zero)
    if (a.durationSeconds && b.durationSeconds && a.durationSeconds !== b.durationSeconds) {
      return a.durationSeconds - b.durationSeconds;
    }
    // 4. Tie-breaker 2: Earlier submission
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return aTime - bTime;
  });

  // Assign ranks
  const ranked = rankable.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  const allCohort = [...ranked, ...unranked];

  // Secondary sort by request query if not default 'rank'
  if (filters.sortBy === 'candidateName') {
    allCohort.sort((a, b) => {
      const cmp = a.candidateName.localeCompare(b.candidateName);
      return filters.sortOrder === 'desc' ? -cmp : cmp;
    });
  } else if (filters.sortBy === 'score') {
    allCohort.sort((a, b) => {
      const aScore = a.percentage ?? -1;
      const bScore = b.percentage ?? -1;
      return filters.sortOrder === 'asc' ? aScore - bScore : bScore - aScore;
    });
  } else if (filters.sortBy === 'submittedAt') {
    allCohort.sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return filters.sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });
  }

  const summary = {
    totalAssigned: assignments.length,
    notStarted: rows.filter((r) => r.status === 'not-started').length,
    inProgress: rows.filter((r) => r.status === 'in-progress').length,
    underReview: rows.filter((r) => r.status === 'under-review').length,
    completed: rows.filter((r) => r.status === 'completed').length,
    resultReleased: rows.filter((r) => r.status === 'result-released').length,
    overdue: rows.filter((r) => r.status === 'overdue').length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
  };

  return { summary, candidates: allCohort };
};
