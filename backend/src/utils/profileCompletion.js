const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasItems = (value) => Array.isArray(value) && value.length > 0;

/** Calculates the weighted candidate profile completion score. */
export const calculateProfileCompletion = (profile) => {
  const basicFields = [
    profile.phone,
    profile.location?.city,
    profile.location?.country,
    profile.dateOfBirth,
    profile.profilePhoto?.url,
  ];
  const basicScore =
    (basicFields.filter((value) => (value instanceof Date ? true : hasText(value))).length /
      basicFields.length) *
    20;
  const headlineAndBioScore = (Number(hasText(profile.headline)) + Number(hasText(profile.bio))) * 5;
  const socialLinksScore = ['github', 'linkedin', 'portfolio'].some((key) =>
    hasText(profile.socialLinks?.[key]),
  )
    ? 5
    : 0;

  const score =
    basicScore +
    headlineAndBioScore +
    (hasItems(profile.education) ? 15 : 0) +
    (hasItems(profile.skills) ? 20 : 0) +
    (hasItems(profile.experience) ? 10 : 0) +
    (hasItems(profile.projects) ? 10 : 0) +
    (hasText(profile.resume?.url) ? 10 : 0) +
    socialLinksScore;

  return Math.min(100, Math.max(0, Math.round(score)));
};
