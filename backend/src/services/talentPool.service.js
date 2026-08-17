import { TalentPoolMember } from '../models/TalentPoolMember.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { User } from '../models/User.js';
import { Job } from '../models/Job.js';
import { calculateSkillMatch } from '../utils/skillMatch.js';
import { AppError } from '../shared/errors/AppError.js';

export const listTalentPool = async (companyId, query) => {
  const memberFilter = { company: companyId };
  if (query.status) {
    memberFilter.status = query.status;
  }

  // Find candidate user IDs matching search/skills filters
  let filteredUserIds = null;
  
  if (query.search || (query.skills && query.skills.length > 0)) {
    const profileFilter = {};
    if (query.skills && query.skills.length > 0) {
      profileFilter['skills.name'] = { 
        $in: query.skills.map(s => new RegExp(`^${s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')) 
      };
    }

    let matchingUserIds = [];
    if (query.search) {
      const users = await User.find({
        fullName: { $regex: query.search, $options: 'i' },
        role: 'candidate'
      }).select('_id');
      const userIds = users.map(u => u._id);

      const profiles = await CandidateProfile.find({
        $or: [
          { user: { $in: userIds } },
          { headline: { $regex: query.search, $options: 'i' } },
          { bio: { $regex: query.search, $options: 'i' } }
        ]
      }).select('user');
      matchingUserIds = profiles.map(p => p.user);
    } else {
      const profiles = await CandidateProfile.find(profileFilter).select('user');
      matchingUserIds = profiles.map(p => p.user);
    }

    filteredUserIds = matchingUserIds;
    memberFilter.candidate = { $in: filteredUserIds };
  }

  const members = await TalentPoolMember.find(memberFilter)
    .populate('candidate', 'fullName email')
    .populate('candidateProfile')
    .populate('tags');

  let results = members.map(m => {
    const obj = m.toObject();
    obj.id = m._id.toString();
    obj.matchScore = null;
    obj.missingRequiredSkills = [];
    return obj;
  });

  if (query.matchJobId) {
    const job = await Job.findById(query.matchJobId);
    if (job) {
      results.forEach(m => {
        const candidateSkills = m.candidateProfile?.skills || [];
        const match = calculateSkillMatch(job.skills || [], candidateSkills);
        m.matchScore = match.score;
        m.missingRequiredSkills = match.missingRequiredSkills;
      });
      // Sort descending by match score, falling back to newest created
      results.sort((a, b) => {
        const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
  } else {
    // Default sort by newest added
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = results.length;
  const paginated = results.slice((query.page - 1) * query.limit, query.page * query.limit);

  return {
    items: paginated,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      pages: Math.ceil(total / query.limit)
    }
  };
};

export const addMemberToPool = async (companyId, candidateId, status, tags, recruiterId) => {
  const existingMember = await TalentPoolMember.findOne({ company: companyId, candidate: candidateId });
  if (existingMember) {
    throw new AppError('Candidate is already in the talent pool', 409);
  }

  const profile = await CandidateProfile.findOne({ user: candidateId });
  if (!profile) {
    throw new AppError('Candidate profile not found', 404);
  }

  const member = await TalentPoolMember.create({
    company: companyId,
    candidate: candidateId,
    candidateProfile: profile._id,
    status,
    tags,
    addedBy: recruiterId
  });

  return await member.populate([
    { path: 'candidate', select: 'fullName email' },
    { path: 'candidateProfile' },
    { path: 'tags' }
  ]);
};

export const updateMember = async (companyId, id, updateData) => {
  const member = await TalentPoolMember.findOne({ _id: id, company: companyId });
  if (!member) {
    throw new AppError('Talent pool member not found', 404);
  }

  if (updateData.status !== undefined) member.status = updateData.status;
  if (updateData.tags !== undefined) member.tags = updateData.tags;

  await member.save();

  return await member.populate([
    { path: 'candidate', select: 'fullName email' },
    { path: 'candidateProfile' },
    { path: 'tags' }
  ]);
};

export const addNote = async (companyId, id, content, recruiterId) => {
  const member = await TalentPoolMember.findOne({ _id: id, company: companyId });
  if (!member) {
    throw new AppError('Talent pool member not found', 404);
  }

  member.notes.push({
    recruiter: recruiterId,
    content
  });

  await member.save();

  return await member.populate([
    { path: 'candidate', select: 'fullName email' },
    { path: 'candidateProfile' },
    { path: 'tags' }
  ]);
};

export const removeMember = async (companyId, id) => {
  const result = await TalentPoolMember.deleteOne({ _id: id, company: companyId });
  if (result.deletedCount === 0) {
    throw new AppError('Talent pool member not found', 404);
  }
  return { success: true };
};
