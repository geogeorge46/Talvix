const LEVELS = Object.freeze({ beginner: 1, intermediate: 2, advanced: 3, expert: 4 });
const normalize = (value) => value.trim().toLowerCase();

/** Calculates weighted match: 30% presence, 35% proficiency, 35% experience. */
export const calculateSkillMatch = (jobSkills, candidateSkills) => {
  const candidates = new Map(candidateSkills.map((skill) => [normalize(skill.name), skill]));
  const totalWeight = jobSkills.reduce((sum, skill) => sum + skill.weight, 0);
  const matchedSkills = []; const missingRequiredSkills = [];
  const breakdown = jobSkills.map((skill) => {
    const candidate = candidates.get(normalize(skill.name));
    if (!candidate) {
      if (skill.required) missingRequiredSkills.push(skill.name);
      return { skill: skill.name, required: skill.required, candidateProficiency: null, minimumProficiency: skill.minimumProficiency, candidateExperience: 0, minimumExperience: skill.minimumYearsOfExperience, weight: skill.weight, score: 0 };
    }
    matchedSkills.push(skill.name);
    const proficiencyRatio = Math.min((LEVELS[candidate.proficiency] ?? 0) / (LEVELS[skill.minimumProficiency] ?? 1), 1);
    const requiredExperience = skill.minimumYearsOfExperience ?? 0;
    const experienceRatio = requiredExperience === 0 ? 1 : Math.min((candidate.yearsOfExperience ?? 0) / requiredExperience, 1);
    const score = Math.round((0.3 + 0.35 * proficiencyRatio + 0.35 * experienceRatio) * 100);
    return { skill: skill.name, required: skill.required, candidateProficiency: candidate.proficiency, minimumProficiency: skill.minimumProficiency, candidateExperience: candidate.yearsOfExperience ?? 0, minimumExperience: requiredExperience, weight: skill.weight, score };
  });
  const weighted = totalWeight === 0 ? 0 : breakdown.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
  return { score: Math.round(Math.min(100, Math.max(0, weighted))), matchedSkills, missingRequiredSkills, breakdown };
};
