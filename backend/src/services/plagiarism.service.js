import { AssessmentPlagiarism } from '../models/AssessmentPlagiarism.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { Assessment } from '../models/Assessment.js';
import { AppError } from '../shared/errors/AppError.js';
import { AuditLog } from '../models/AuditLog.js';

/**
 * Clean comments and whitespace from code strings.
 */
export const normalizeCode = (code, language) => {
  if (!code) return '';
  let cleaned = code;
  
  if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php'].includes(language?.toLowerCase())) {
    // Remove multi-line comments: /* ... */
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove single-line comments: // ...
    cleaned = cleaned.split('\n').map(line => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    }).join('\n');
  } else if (language?.toLowerCase() === 'python') {
    // Remove docstrings: """ ... """ and ''' ... '''
    cleaned = cleaned.replace(/"""[\s\S]*?"""/g, '').replace(/'''[\s\S]*?'''/g, '');
    // Remove single-line comments: # ...
    cleaned = cleaned.split('\n').map(line => {
      const idx = line.indexOf('#');
      return idx >= 0 ? line.slice(0, idx) : line;
    }).join('\n');
  } else if (language?.toLowerCase() === 'sql') {
    // Remove single-line comments: -- ...
    cleaned = cleaned.split('\n').map(line => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    }).join('\n');
  }

  // Remove all whitespace, tabs, and newlines
  return cleaned.replace(/\s+/g, '').toLowerCase();
};

/**
 * Simple tokenization of normalized code.
 */
export const tokenizeCode = (normalized) => {
  if (!normalized) return [];
  // Split into tokens of length 5 (sliding window / n-grams) for robust fingerprinting
  const ngrams = [];
  const n = 5;
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.substring(i, i + n));
  }
  return ngrams;
};

/**
 * Calculates similarity coefficient (0-100) between two code snippets.
 */
export const calculateSimilarity = (codeA, codeB, language) => {
  const normA = normalizeCode(codeA, language);
  const normB = normalizeCode(codeB, language);
  
  if (!normA || !normB) return 0;
  if (normA === normB) return 100;

  const tokensA = tokenizeCode(normA);
  const tokensB = tokenizeCode(normB);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const score = (intersection.size / union.size) * 100;
  return Math.round(score);
};

/**
 * Runs a cross-candidate plagiarism scan across all submissions of a published assessment.
 */
export const runPlagiarismScanForAssessment = async (company, assessmentId, actor = null) => {
  const assessment = await Assessment.findOne({ _id: assessmentId, company });
  if (!assessment) throw new AppError('Assessment not found', 404);

  // 1. Fetch all completed/review-pending attempts for this assessment
  const attempts = await AssessmentAttempt.find({
    assessment: assessmentId,
    company,
    status: { $in: ['completed', 'review-pending'] }
  });

  if (attempts.length < 2) return [];

  // Delete previous plagiarism logs for this assessment
  await AssessmentPlagiarism.deleteMany({ assessment: assessmentId, company });

  const plagiarismResults = [];

  // 2. Perform pairwise cross-candidate comparisons for each question
  for (let i = 0; i < attempts.length; i++) {
    const attemptA = attempts[i];
    for (let j = i + 1; j < attempts.length; j++) {
      const attemptB = attempts[j];
      
      // Prevent comparing same candidate attempts (if multi-attempt is allowed)
      if (String(attemptA.candidate) === String(attemptB.candidate)) continue;

      // Find overlapping questions inside attempt answers
      for (const ansA of attemptA.answers) {
        if (!ansA.code) continue; // Only compare coding/sql/debugging answers containing code
        
        const ansB = attemptB.answers.find(x => String(x.questionId) === String(ansA.questionId));
        if (!ansB || !ansB.code) continue;

        const score = calculateSimilarity(ansA.code, ansB.code, ansA.language);

        // Flag if similarity is high (e.g. >= 50%)
        if (score >= 50) {
          const plagiarism = await AssessmentPlagiarism.create({
            company,
            assessment: assessmentId,
            question: ansA.questionId,
            candidateA: attemptA.candidate,
            candidateB: attemptB.candidate,
            similarityScore: score,
            detectionMethod: 'normalized',
            suspiciousSegments: [{
              candidateACode: ansA.code,
              candidateBCode: ansB.code,
              startLineA: 1,
              endLineA: ansA.code.split('\n').length,
              startLineB: 1,
              endLineB: ansB.code.split('\n').length
            }]
          });
          plagiarismResults.push(plagiarism);
        }
      }
    }
  }

  if (actor) {
    await AuditLog.create({
      action: 'PLAGIARISM_SCAN_COMPLETED',
      actor,
      company,
      entityType: 'assessment',
      entityId: assessmentId,
      details: { foundPairs: plagiarismResults.length }
    });
  }

  return plagiarismResults;
};

/**
 * Expose recruiter APIs to view plagiarism.
 */
export const getPlagiarismReport = async (company, assessmentId) => {
  return AssessmentPlagiarism.find({ assessment: assessmentId, company })
    .populate('candidateA', 'fullName email')
    .populate('candidateB', 'fullName email')
    .populate('question', 'title prompt type')
    .sort({ similarityScore: -1 });
};

export const getCandidatePlagiarismReport = async (company, assessmentId, candidateId) => {
  return AssessmentPlagiarism.find({
    assessment: assessmentId,
    company,
    $or: [{ candidateA: candidateId }, { candidateB: candidateId }]
  })
    .populate('candidateA', 'fullName email')
    .populate('candidateB', 'fullName email')
    .populate('question', 'title prompt type')
    .sort({ similarityScore: -1 });
};
