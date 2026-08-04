import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
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
