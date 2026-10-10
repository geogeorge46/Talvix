/**
 * Deterministic skill canonicalization and deduplication.
 */

const CANONICAL_MAP = new Map([
  ['react.js', 'React'],
  ['reactjs', 'React'],
  ['react js', 'React'],
  ['react', 'React'],
  ['node.js', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['node js', 'Node.js'],
  ['node', 'Node.js'],
  ['vue.js', 'Vue.js'],
  ['vuejs', 'Vue.js'],
  ['vue', 'Vue.js'],
  ['angularjs', 'Angular'],
  ['angular.js', 'Angular'],
  ['angular', 'Angular'],
  ['typescript', 'TypeScript'],
  ['ts', 'TypeScript'],
  ['javascript', 'JavaScript'],
  ['js', 'JavaScript'],
  ['python', 'Python'],
  ['py', 'Python'],
  ['mongodb', 'MongoDB'],
  ['mongo', 'MongoDB'],
  ['postgres', 'PostgreSQL'],
  ['postgresql', 'PostgreSQL'],
  ['express.js', 'Express.js'],
  ['expressjs', 'Express.js'],
  ['express', 'Express.js'],
  ['docker', 'Docker'],
  ['kubernetes', 'Kubernetes'],
  ['k8s', 'Kubernetes'],
  ['aws', 'AWS'],
  ['amazon web services', 'AWS'],
  ['gcp', 'GCP'],
  ['google cloud platform', 'GCP'],
  ['azure', 'Azure'],
  ['graphql', 'GraphQL'],
  ['rest', 'REST API'],
  ['rest api', 'REST API'],
  ['restful', 'REST API'],
  ['tailwindcss', 'Tailwind CSS'],
  ['tailwind css', 'Tailwind CSS'],
  ['tailwind', 'Tailwind CSS'],
  ['next.js', 'Next.js'],
  ['nextjs', 'Next.js'],
  ['redis', 'Redis'],
  ['git', 'Git'],
  ['github', 'GitHub'],
  ['ci/cd', 'CI/CD'],
  ['cicd', 'CI/CD']
]);

const IMPORTANCE_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

/**
 * Normalize a single skill name.
 * @param {string} rawName 
 * @returns {string}
 */
export const normalizeSkillName = (rawName) => {
  if (!rawName || typeof rawName !== 'string') return 'Unknown Skill';
  const clean = rawName.trim().replaceAll(/\s+/g, ' ');
  const lower = clean.toLowerCase();
  
  if (CANONICAL_MAP.has(lower)) {
    return CANONICAL_MAP.get(lower);
  }

  // Capitalize first letter of each word if not mapped
  return clean.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * Deduplicate and standardize array of skill objects.
 * @param {Array<Object>} skills 
 * @returns {Array<Object>}
 */
export const normalizeSkills = (skills = []) => {
  if (!Array.isArray(skills)) return [];

  const skillMap = new Map();

  for (const item of skills) {
    if (!item || typeof item !== 'object') continue;
    
    const canonicalName = normalizeSkillName(item.name || item.skill);
    const key = canonicalName.toLowerCase();

    const normalizedItem = {
      name: canonicalName,
      category: (item.category || 'general').toLowerCase().trim(),
      requirementType: item.requirementType === 'preferred' ? 'preferred' : 'required',
      importance: ['critical', 'high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium',
      evidence: typeof item.evidence === 'string' ? item.evidence.trim() : '',
      source: item.source === 'inferred' ? 'inferred' : 'explicit'
    };

    if (!skillMap.has(key)) {
      skillMap.set(key, normalizedItem);
    } else {
      // Merge with existing skill
      const existing = skillMap.get(key);

      // Prefer 'required' over 'preferred'
      if (normalizedItem.requirementType === 'required') {
        existing.requirementType = 'required';
      }

      // Prefer 'explicit' source over 'inferred'
      if (normalizedItem.source === 'explicit') {
        existing.source = 'explicit';
      }

      // Higher importance takes precedence
      if (IMPORTANCE_WEIGHTS[normalizedItem.importance] > IMPORTANCE_WEIGHTS[existing.importance]) {
        existing.importance = normalizedItem.importance;
      }

      // Keep longer evidence phrase if present
      if (normalizedItem.evidence.length > existing.evidence.length) {
        existing.evidence = normalizedItem.evidence;
      }
    }
  }

  return Array.from(skillMap.values());
};
