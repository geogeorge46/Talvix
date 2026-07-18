/** Builds privacy-limited application-time snapshots detached from live documents. */
export const buildCandidateSnapshot = (user, profile) => ({
  fullName: user.fullName, email: user.email, headline: profile.headline, phone: profile.phone,
  location: profile.location?.toObject?.() ?? profile.location, skills: profile.skills.map((item) => item.toObject()),
  education: profile.education.map((item) => item.toObject()), experience: profile.experience.map((item) => item.toObject()),
  projects: profile.projects.map((item) => item.toObject()), socialLinks: profile.socialLinks?.toObject?.() ?? profile.socialLinks,
});
export const buildJobSnapshot = (job, company) => ({ title: job.title, companyName: company.name, employmentType: job.employmentType, workMode: job.workMode, location: job.location?.toObject?.() ?? job.location, skills: job.skills.map((item) => item.toObject()), applicationDeadline: job.applicationDeadline });
