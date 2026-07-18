import { RecruiterProfile } from '../models/RecruiterProfile.js';
import { AppError } from '../shared/errors/AppError.js';

const USER_POPULATE = { path: 'user', select: 'fullName email role avatar' };

/** Creates the secure default recruiter profile during registration. */
export const createRecruiterProfileForUser = async (userId, session) => {
  const [profile] = await RecruiterProfile.create([{ user: userId, permissions: [], isApproved: false }], { session });
  return profile;
};

export const getOwnRecruiterProfile = async (userId) => {
  const profile = await RecruiterProfile.findOne({ user: userId }).populate(USER_POPULATE).populate('company', 'name slug verificationStatus isActive logo');
  if (!profile) throw new AppError('Recruiter profile not found', 404);
  return profile;
};

export const updateOwnRecruiterProfile = async (userId, input) => {
  const profile = await RecruiterProfile.findOne({ user: userId });
  if (!profile) throw new AppError('Recruiter profile not found', 404);
  Object.entries(input).forEach(([key, value]) => profile.set(key, value));
  await profile.save();
  return getOwnRecruiterProfile(userId);
};
