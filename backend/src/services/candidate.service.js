import { USER_ROLES } from '../constants/roles.js';
import { CandidateProfile } from '../models/CandidateProfile.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { calculateProfileCompletion } from '../utils/profileCompletion.js';

const SELF_PROFILE_POPULATE = { path: 'user', select: 'fullName email role avatar' };
const COLLECTION_LIMITS = Object.freeze({
  education: 30,
  skills: 50,
  experience: 50,
  projects: 50,
  certifications: 50,
});

const getOwnProfileDocument = async (userId) => {
  const profile = await CandidateProfile.findOne({ user: userId });
  if (!profile) throw new AppError('Candidate profile not found', 404);
  return profile;
};

/** Finds a trusted nested subdocument or returns a consistent 404. */
export const findNestedSubdocument = (profile, collectionName, subdocumentId) => {
  const subdocument = profile[collectionName].id(subdocumentId);
  if (!subdocument) throw new AppError(`${collectionName.slice(0, -1)} entry not found`, 404);
  return subdocument;
};

/** Rejects duplicate skill names using normalized case-insensitive comparison. */
export const preventDuplicateSkills = (existingSkills, incomingSkills, excludedId) => {
  const names = new Set(
    existingSkills
      .filter((skill) => skill.id !== excludedId)
      .map((skill) => skill.name.trim().toLowerCase()),
  );

  for (const skill of incomingSkills) {
    const normalizedName = skill.name.trim().toLowerCase();
    if (names.has(normalizedName)) throw new AppError(`Skill '${skill.name}' already exists`, 409);
    names.add(normalizedName);
  }
};

/** Recalculates and persists profile completion on the active document. */
export const recalculateProfileCompletion = (profile) => {
  profile.profileCompletion = calculateProfileCompletion(profile);
};

/** Creates the one-to-one candidate profile, optionally inside a transaction. */
export const createCandidateProfileForUser = async (userId, session) => {
  const [profile] = await CandidateProfile.create([{ user: userId }], { session });
  return profile;
};

/** Returns whether a profile is visible to a requesting recruiter or administrator. */
export const canViewCandidateProfile = (profile, viewerRole) =>
  profile.profileVisibility !== 'private' &&
  [USER_ROLES.RECRUITER, USER_ROLES.ADMIN].includes(viewerRole);

/** Retrieves the authenticated candidate's complete profile. */
export const getOwnCandidateProfile = async (userId) => {
  const profile = await CandidateProfile.findOne({ user: userId }).populate(SELF_PROFILE_POPULATE);
  if (!profile) throw new AppError('Candidate profile not found', 404);
  return profile;
};

/** Updates only validated self-service profile fields. */
export const updateOwnCandidateProfile = async (userId, input) => {
  const profile = await getOwnProfileDocument(userId);
  const nestedFields = ['location', 'profilePhoto', 'resume', 'socialLinks', 'expectedSalary'];

  for (const [key, value] of Object.entries(input)) {
    if (nestedFields.includes(key) && value && typeof value === 'object') {
      profile.set(key, { ...(profile.get(key)?.toObject?.() ?? profile.get(key) ?? {}), ...value });
    } else {
      profile.set(key, value);
    }
  }

  if (profile.availability !== 'notice-period') profile.noticePeriodDays = 0;
  recalculateProfileCompletion(profile);
  await profile.save();
  await profile.populate(SELF_PROFILE_POPULATE);
  return profile;
};

const validateNestedDates = (collectionName, entry) => {
  if (collectionName === 'education') {
    if (entry.currentlyStudying && entry.endYear) throw new AppError('Current education cannot have an end year', 400);
    if (entry.endYear && entry.endYear < entry.startYear) throw new AppError('End year cannot precede start year', 400);
  }
  if (collectionName === 'experience') {
    if (entry.currentlyWorking && entry.endDate) throw new AppError('Current experience cannot have an end date', 400);
    if (entry.endDate && entry.startDate && entry.endDate < entry.startDate) throw new AppError('End date cannot precede start date', 400);
  }
  if (collectionName === 'projects' && entry.endDate && entry.startDate && entry.endDate < entry.startDate) {
    throw new AppError('End date cannot precede start date', 400);
  }
  if (collectionName === 'certifications' && entry.expirationDate && entry.issueDate && entry.expirationDate < entry.issueDate) {
    throw new AppError('Expiration date cannot precede issue date', 400);
  }
};

/** Adds validated nested candidate data and updates completion. */
export const addCandidateEntries = async (userId, collectionName, entries) => {
  const profile = await getOwnProfileDocument(userId);
  const normalizedEntries = Array.isArray(entries) ? entries : [entries];
  const limit = COLLECTION_LIMITS[collectionName];
  if (profile[collectionName].length + normalizedEntries.length > limit) {
    throw new AppError(`${collectionName} cannot contain more than ${limit} entries`, 400);
  }
  if (collectionName === 'skills') preventDuplicateSkills(profile.skills, normalizedEntries);
  normalizedEntries.forEach((entry) => validateNestedDates(collectionName, entry));
  profile[collectionName].push(...normalizedEntries);
  recalculateProfileCompletion(profile);
  await profile.save();
  return profile[collectionName].slice(-normalizedEntries.length);
};

/** Updates one trusted nested candidate entry. */
export const updateCandidateEntry = async (userId, collectionName, entryId, input) => {
  const profile = await getOwnProfileDocument(userId);
  const entry = findNestedSubdocument(profile, collectionName, entryId);
  if (collectionName === 'skills' && input.name) {
    preventDuplicateSkills(profile.skills, [input], entry.id);
  }
  entry.set(input);
  validateNestedDates(collectionName, entry);
  recalculateProfileCompletion(profile);
  await profile.save();
  return entry;
};

/** Deletes one trusted nested candidate entry. */
export const deleteCandidateEntry = async (userId, collectionName, entryId) => {
  const profile = await getOwnProfileDocument(userId);
  const entry = findNestedSubdocument(profile, collectionName, entryId);
  entry.deleteOne();
  recalculateProfileCompletion(profile);
  await profile.save();
};

/** Retrieves a non-private candidate profile for recruiter/admin review. */
export const getCandidateProfileById = async (candidateId, viewerRole) => {
  const profile = await CandidateProfile.findById(candidateId).populate(SELF_PROFILE_POPULATE);
  if (!profile || !canViewCandidateProfile(profile, viewerRole)) {
    throw new AppError('Candidate profile not found', 404);
  }
  return profile;
};

const SEARCH_SORTS = Object.freeze({
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  'completion-desc': { profileCompletion: -1, createdAt: -1 },
  'completion-asc': { profileCompletion: 1, createdAt: -1 },
});

/** Searches visible candidate profiles with bounded filters and pagination. */
export const searchCandidateProfiles = async (query) => {
  const { page, limit } = query;
  const match = { profileVisibility: { $in: ['public', 'recruiters-only'] } };
  if (query.skills?.length) match['skills.name'] = { $all: query.skills.map(createSafeRegex) };
  if (query.location) {
    const regex = createSafeRegex(query.location);
    match.$or = [{ 'location.city': regex }, { 'location.state': regex }, { 'location.country': regex }];
  }
  if (query.preferredRole) match.preferredRoles = createSafeRegex(query.preferredRole);
  if (query.jobType) match.preferredJobTypes = query.jobType;
  if (query.availability) match.availability = query.availability;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        let: { userId: '$user' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$userId'] }, role: USER_ROLES.CANDIDATE } },
          { $project: { fullName: 1, email: 1, avatar: 1, role: 1 } },
        ],
        as: 'user',
      },
    },
    { $unwind: '$user' },
  ];

  if (query.search) {
    const regex = createSafeRegex(query.search);
    pipeline.push({
      $match: {
        $or: [
          { 'user.fullName': regex },
          { headline: regex },
          { bio: regex },
          { 'skills.name': regex },
          { preferredRoles: regex },
        ],
      },
    });
  }

  if (query.minimumExperience !== undefined) {
    pipeline.push(
      {
        $set: {
          totalExperienceYears: {
            $sum: {
              $map: {
                input: '$experience',
                as: 'entry',
                in: {
                  $divide: [
                    { $subtract: [{ $ifNull: ['$$entry.endDate', '$$NOW'] }, '$$entry.startDate'] },
                    31_556_952_000,
                  ],
                },
              },
            },
          },
        },
      },
      { $match: { totalExperienceYears: { $gte: query.minimumExperience } } },
    );
  }

  pipeline.push({
    $facet: {
      candidates: [
        { $sort: SEARCH_SORTS[query.sort] },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $unset: 'totalExperienceYears' },
      ],
      metadata: [{ $count: 'total' }],
    },
  });

  const [result] = await CandidateProfile.aggregate(pipeline);
  const total = result.metadata[0]?.total ?? 0;
  return { candidates: result.candidates, pagination: buildPagination(page, limit, total) };
};
