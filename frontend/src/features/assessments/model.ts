export type QuestionType =
  | 'single-choice'
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'long-answer'
  | 'coding'
  | 'sql'
  | 'debugging'
  | 'output-prediction'
  | 'file-upload'
  | 'work-sample';
export type DeliverableType = 'file' | 'url' | 'text' | 'mixed';
export interface ReferenceAsset {
  name: string;
  url: string;
  description: string;
}
export interface Deliverable {
  type: DeliverableType;
  instructions: string;
  allowedFormats: string[];
  maxFiles: number;
  maxFileSizeBytes: number;
  referenceAssets: ReferenceAsset[];
}
export interface RubricCriterion {
  name: string;
  maxMarks: number;
  weight: number;
}
export interface RubricScore {
  criterionName: string;
  awardedMarks: number;
  maxMarks: number;
}
export type AssessmentStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus =
  | 'assigned'
  | 'available'
  | 'in-progress'
  | 'submitted'
  | 'evaluating'
  | 'completed'
  | 'expired'
  | 'cancelled';
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const text = (v: unknown, fallback = '') =>
  typeof v === 'string' ? v : fallback;
const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  title: string;
  marks: number;
  required: boolean;
  options: { id: string; text: string }[];
  languages: string[];
  starterCode: Record<string, string>;
  deliverable?: Deliverable;
  rubricCriteria?: RubricCriterion[];
  category?: string;
  difficulty?: string;
  skills?: string[];
}
export interface Assessment {
  id: string;
  title: string;
  description: string;
  instructions: string;
  type: string;
  status: AssessmentStatus;
  durationMinutes: number;
  passingPercentage: number;
  allowBackNavigation: boolean;
  showResultImmediately: boolean;
  questionCount: number;
  questions: Question[];
  createdAt?: string;
  skills?: string[];
  totalMarks?: number;
}
export interface AssignmentAttemptSummary {
  _id?: string;
  status?: string;
  evaluation?: {
    objectiveScore?: number;
    codingScore?: number;
    subjectiveScore?: number;
    totalScore?: number;
    percentage?: number;
    passed?: boolean;
  };
}
export interface Assignment {
  id: string;
  title: string;
  status: AssignmentStatus;
  availableFrom: string;
  expiresAt: string;
  attemptId?: string;
  candidateName: string;
  applicationId: string;
  resultReleased: boolean;
  attemptsUsed?: number;
  bestPercentage?: number;
  passed?: boolean;
  latestAttempt?: AssignmentAttemptSummary;
  bestAttempt?: AssignmentAttemptSummary;
  totalMarks?: number;
}
export interface Attempt {
  id: string;
  assignmentId: string;
  title: string;
  status: string;
  expiresAt: string;
  allowBackNavigation: boolean;
  currentQuestion: number;
  questions: Question[];
  answers: Record<string, unknown>;
  evaluation?: {
    objectiveScore: number;
    subjectiveScore: number;
    codingScore: number;
    totalScore: number;
    percentage: number;
    passed: boolean;
    reviewedAt?: string;
    reviewedBy?: string;
  };
  questionResults?: {
    questionId: string;
    questionType: string;
    marks: number;
    awardedMarks: number;
    isCorrect: boolean;
    requiresManualReview: boolean;
    feedback: string;
    codingResult?: unknown;
    rubricScores?: RubricScore[];
  }[];
}
export const label = (v: string) =>
  v.replaceAll('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const formatDate = (v: string) =>
  v
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(v))
    : 'Not provided';
export function toQuestion(v: unknown): Question {
  const x = record(v),
    coding = record(x.coding),
    deliv = record(x.deliverable);
  const deliverable: Deliverable | undefined = x.deliverable
    ? {
        type: text(deliv.type, 'file') as DeliverableType,
        instructions: text(deliv.instructions),
        allowedFormats: arr(deliv.allowedFormats).map((f) => String(f)),
        maxFiles: num(deliv.maxFiles, 1),
        maxFileSizeBytes: num(deliv.maxFileSizeBytes, 10 * 1024 * 1024),
        referenceAssets: arr(deliv.referenceAssets).map((ra) => {
          const r = record(ra);
          return {
            name: text(r.name),
            url: text(r.url),
            description: text(r.description),
          };
        }),
      }
    : undefined;
  const rubricCriteria: RubricCriterion[] | undefined = Array.isArray(x.rubricCriteria)
    ? x.rubricCriteria.map((rc) => {
        const r = record(rc);
        return {
          name: text(r.name),
          maxMarks: num(r.maxMarks),
          weight: num(r.weight),
        };
      })
    : undefined;

  return {
    id: text(x.questionId, text(x._id, text(x.id))),
    type: text(x.type, 'short-answer') as QuestionType,
    prompt: text(x.prompt),
    title: text(x.title),
    marks: num(x.marks, num(x.defaultMarks)),
    required: x.isRequired !== false,
    options: arr(x.options).map((o) => {
      const z = record(o);
      return { id: text(z.id), text: text(z.text) };
    }),
    languages: arr(coding.languageSupport).filter(
      (s): s is string => typeof s === 'string',
    ),
    starterCode: record(coding.starterCode) as Record<string, string>,
    ...(text(x.category) ? { category: text(x.category) } : {}),
    ...(text(x.difficulty) ? { difficulty: text(x.difficulty) } : {}),
    skills: arr(x.skills).filter((s): s is string => typeof s === 'string'),
    ...(deliverable ? { deliverable } : {}),
    ...(rubricCriteria ? { rubricCriteria } : {}),
  };
}
export function toAssessment(v: unknown): Assessment {
  const x = record(v);
  const qs = arr(x.questions).map((q) => {
    const r = record(q);
    const rawQuestion = r.questionSnapshot ?? r.question ?? q;
    let qObj: Record<string, unknown>;
    if (typeof rawQuestion === 'string') {
      qObj = { id: rawQuestion, _id: rawQuestion, questionId: rawQuestion, marks: num(r.marks) };
    } else if (typeof rawQuestion === 'object' && rawQuestion !== null) {
      qObj = { ...record(rawQuestion), marks: num(r.marks, num(record(rawQuestion).marks)) };
    } else {
      qObj = record(q);
    }
    return toQuestion(qObj);
  });
  return {
    id: text(x._id, text(x.id)),
    title: text(x.title, 'Untitled assessment'),
    description: text(x.description),
    instructions: text(x.instructions),
    type: text(x.type, 'general'),
    status: text(x.status, 'draft') as AssessmentStatus,
    durationMinutes: num(x.durationMinutes),
    passingPercentage: num(x.passingPercentage),
    allowBackNavigation: x.allowBackNavigation !== false,
    showResultImmediately: x.showResultImmediately === true,
    questionCount: num(x.questionCount, qs.length),
    questions: qs,
    createdAt: text(x.createdAt),
    skills: arr(x.skills).filter((s): s is string => typeof s === 'string'),
    totalMarks: num(x.totalMarks),
  };
}
export function toAssignment(v: unknown): Assignment {
  const x = record(v),
    a = record(x.assessmentSnapshot ?? x.assessment),
    c = record(x.candidate);
  const rawBestAttempt = x.bestAttempt;
  const bestAttemptId = typeof rawBestAttempt === 'string' && rawBestAttempt
    ? rawBestAttempt
    : (rawBestAttempt && typeof rawBestAttempt === 'object')
      ? text(record(rawBestAttempt)._id, text(record(rawBestAttempt).id))
      : undefined;
  const rawLatestAttempt = x.latestAttempt;
  const latestAttemptId = typeof rawLatestAttempt === 'string' && rawLatestAttempt
    ? rawLatestAttempt
    : (rawLatestAttempt && typeof rawLatestAttempt === 'object')
      ? text(record(rawLatestAttempt)._id, text(record(rawLatestAttempt).id))
      : undefined;
  const rawAttempt = x.attempt;
  const attemptIdVal = typeof rawAttempt === 'string' && rawAttempt
    ? rawAttempt
    : (rawAttempt && typeof rawAttempt === 'object')
      ? text(record(rawAttempt)._id, text(record(rawAttempt).id))
      : undefined;
  const attemptId = text(bestAttemptId, text(latestAttemptId, text(attemptIdVal, text(x.attemptId))));
  return {
    id: text(x._id, text(x.id)),
    title: text(a.title, text(x.assessmentTitle, 'Assessment')),
    status: text(x.status, 'assigned') as AssignmentStatus,
    availableFrom: text(x.availableFrom),
    expiresAt: text(x.expiresAt),
    ...(attemptId ? { attemptId } : {}),
    candidateName: text(c.fullName, text(x.candidateName, 'Candidate')),
    applicationId: text(record(x.application)._id, text(x.applicationId)),
    resultReleased: x.resultReleasedAt != null || x.resultReleased === true,
    attemptsUsed: num(x.attemptsUsed),
    bestPercentage: x.bestPercentage !== undefined ? num(x.bestPercentage) : undefined,
    passed: typeof x.passed === 'boolean' ? x.passed : undefined,
    latestAttempt: x.latestAttempt && typeof x.latestAttempt === 'object' ? record(x.latestAttempt) : undefined,
    bestAttempt: x.bestAttempt && typeof x.bestAttempt === 'object' ? record(x.bestAttempt) : undefined,
    totalMarks: num(a.totalMarks),
  } as Assignment;
}
export function toAttempt(v: unknown): Attempt {
  const x = record(v),
    snapshot = record(x.assessmentSnapshot ?? record(x.assignment).assessmentSnapshot),
    questions = arr(x.questions || snapshot.questions).map((q) =>
      toQuestion(record(q).questionSnapshot ?? q),
    );
  const answers: Record<string, unknown> = {};
  arr(x.answers).forEach((a) => {
    const z = record(a);
    answers[text(z.questionId)] = z.code ?? z.answer;
  });
  const evalRec = record(x.evaluation);
  return {
    id: text(x._id, text(x.id)),
    assignmentId: text(x.assignmentId, text(record(x.assignment)._id)),
    title: text(snapshot.title, text(x.title, 'Assessment attempt')),
    status: text(x.status, 'in-progress'),
    expiresAt: text(x.expiresAt, text(x.deadlineAt)),
    allowBackNavigation: snapshot.allowBackNavigation !== false,
    currentQuestion: num(x.currentQuestion),
    questions,
    answers,
    evaluation: x.evaluation
      ? {
          objectiveScore: num(evalRec.objectiveScore),
          subjectiveScore: num(evalRec.subjectiveScore),
          codingScore: num(evalRec.codingScore),
          totalScore: num(evalRec.totalScore),
          percentage: num(evalRec.percentage),
          passed: Boolean(evalRec.passed),
          reviewedAt: text(evalRec.reviewedAt),
          reviewedBy: text(evalRec.reviewedBy),
        }
      : undefined,
    questionResults: x.questionResults
      ? arr(x.questionResults).map((qr) => {
          const item = record(qr);
          return {
            questionId: text(item.questionId),
            questionType: text(item.questionType),
            marks: num(item.marks),
            awardedMarks: num(item.awardedMarks),
            isCorrect: Boolean(item.isCorrect),
            requiresManualReview: Boolean(item.requiresManualReview),
            feedback: text(item.feedback),
            codingResult: item.codingResult,
            rubricScores: Array.isArray(item.rubricScores)
              ? item.rubricScores.map((rs) => {
                  const r = record(rs);
                  return {
                    criterionName: text(r.criterionName),
                    awardedMarks: num(r.awardedMarks),
                    maxMarks: num(r.maxMarks),
                  };
                })
              : undefined,
          };
        })
      : undefined,
  } as Attempt;
}
export interface ResultRubricScore {
  criterionName: string;
  awardedMarks: number;
  maxMarks: number;
}

export interface ResultQuestion {
  questionId: string;
  questionType: string;
  marks: number;
  awardedMarks: number;
  feedback?: string | undefined;
  rubricScores?: ResultRubricScore[] | undefined;
}

export interface CandidateResult {
  title: string;
  score: number;
  percentage?: number | undefined;
  totalMarks?: number | undefined;
  passed?: boolean | undefined;
  status: string;
  feedback: string;
  completedAt?: string | undefined;
  questionResults?: ResultQuestion[] | undefined;
}

export const safeResult = (v: unknown): CandidateResult => {
  const x = record(v);
  const res: CandidateResult = {
    title: text(record(x.assessment).title, text(x.title, 'Assessment result')),
    score: num(x.score, num(x.percentage)),
    status: text(x.status, 'completed'),
    feedback: text(x.feedback),
  };

  if (typeof x.passed === 'boolean') res.passed = x.passed;
  if (x.totalMarks !== undefined) res.totalMarks = num(x.totalMarks);
  if (x.completedAt !== undefined) res.completedAt = text(x.completedAt);
  if (Array.isArray(x.questionResults)) {
    res.questionResults = x.questionResults.map((qr) => {
      const r = record(qr);
      const rubricScores = Array.isArray(r.rubricScores)
        ? r.rubricScores.map((rs) => {
            const s = record(rs);
            return {
              criterionName: text(s.criterionName),
              awardedMarks: num(s.awardedMarks),
              maxMarks: num(s.maxMarks),
            };
          })
        : undefined;
      const feedbackStr = text(r.feedback);
      const qResult: ResultQuestion = {
        questionId: text(r.questionId),
        questionType: text(r.questionType),
        marks: num(r.marks),
        awardedMarks: num(r.awardedMarks),
      };
      if (feedbackStr) qResult.feedback = feedbackStr;
      if (rubricScores) qResult.rubricScores = rubricScores;
      return qResult;
    });
  }

  return res;
};

export interface EligibilityCandidate {
  applicationId: string;
  candidateId?: string;
  candidateName: string;
  email: string;
  stage?: string;
  jobId?: string;
  jobTitle?: string;
  reason?: string;
  existingAssignmentId?: string;
  existingStatus?: string;
  existingVersion?: number;
}

export interface EligibilityCheckResult {
  eligible: EligibilityCandidate[];
  alreadyAssigned: EligibilityCandidate[];
  ineligible: EligibilityCandidate[];
  summary: {
    total: number;
    eligibleCount: number;
    alreadyAssignedCount: number;
    ineligibleCount: number;
  };
}

export interface BulkAssignPayload {
  assessmentId: string;
  applicationIds: string[];
  availableFrom?: string;
  expiresAt?: string;
}

export interface BulkAssignResult {
  assigned: {
    applicationId: string;
    candidateId?: string;
    candidateName: string;
    email?: string;
    assignmentId: string;
    status: string;
  }[];
  alreadyAssigned: EligibilityCandidate[];
  ineligible: EligibilityCandidate[];
  failed: {
    applicationId: string;
    candidateId?: string;
    candidateName?: string;
    reason: string;
  }[];
  summary: {
    requested: number;
    assignedCount: number;
    alreadyAssignedCount: number;
    ineligibleCount: number;
    failedCount: number;
  };
}

export function toEligibilityCandidate(v: unknown): EligibilityCandidate {
  const c = record(v);
  return {
    applicationId: text(c.applicationId),
    candidateId: text(c.candidateId) || undefined,
    candidateName: text(c.candidateName, text(c.fullName, text(c.applicationId, 'Candidate'))),
    email: text(c.email, text(c.candidateEmail)),
    stage: text(c.stage),
    jobId: text(c.jobId) || undefined,
    jobTitle: text(c.jobTitle) || undefined,
    reason: text(c.reason) || undefined,
    existingAssignmentId: text(c.existingAssignmentId, text(c.assignmentId)) || undefined,
    existingStatus: text(c.existingStatus) || undefined,
    existingVersion: num(c.existingVersion) || undefined,
  };
}

export function toEligibilityCheckResult(v: unknown): EligibilityCheckResult {
  const x = record(v);

  if (Array.isArray(x.eligible) && Array.isArray(x.alreadyAssigned) && Array.isArray(x.ineligible)) {
    const s = record(x.summary);
    const eligible = (x.eligible as unknown[]).map(toEligibilityCandidate);
    const alreadyAssigned = (x.alreadyAssigned as unknown[]).map(toEligibilityCandidate);
    const ineligible = (x.ineligible as unknown[]).map(toEligibilityCandidate);
    return {
      eligible,
      alreadyAssigned,
      ineligible,
      summary: {
        total: num(s.total, eligible.length + alreadyAssigned.length + ineligible.length),
        eligibleCount: num(s.eligibleCount, num(s.eligible, eligible.length)),
        alreadyAssignedCount: num(s.alreadyAssignedCount, num(s.alreadyAssigned, alreadyAssigned.length)),
        ineligibleCount: num(s.ineligibleCount, num(s.ineligible, ineligible.length)),
      },
    };
  }

  const candidates = arr(x.candidates);
  const eligible: EligibilityCandidate[] = [];
  const alreadyAssigned: EligibilityCandidate[] = [];
  const ineligible: EligibilityCandidate[] = [];

  for (const item of candidates) {
    const c = record(item);
    const candObj = toEligibilityCandidate(c);
    const status = text(c.status);
    if (status === 'eligible') {
      eligible.push(candObj);
    } else if (status === 'already-assigned' || status === 'already_assigned') {
      alreadyAssigned.push(candObj);
    } else {
      ineligible.push(candObj);
    }
  }

  const s = record(x.summary);
  return {
    eligible,
    alreadyAssigned,
    ineligible,
    summary: {
      total: num(s.total, candidates.length),
      eligibleCount: num(s.eligibleCount, num(s.eligible, eligible.length)),
      alreadyAssignedCount: num(s.alreadyAssignedCount, num(s.alreadyAssigned, alreadyAssigned.length)),
      ineligibleCount: num(s.ineligibleCount, num(s.ineligible, ineligible.length)),
    },
  };
}

export function toBulkAssignResult(v: unknown): BulkAssignResult {
  const x = record(v);

  if (Array.isArray(x.assigned) && Array.isArray(x.alreadyAssigned) && Array.isArray(x.ineligible) && Array.isArray(x.failed)) {
    const s = record(x.summary);
    return {
      assigned: (x.assigned as unknown[]).map((i) => {
        const c = record(i);
        return {
          applicationId: text(c.applicationId),
          candidateId: text(c.candidateId) || undefined,
          candidateName: text(c.candidateName, text(c.applicationId, 'Candidate')),
          email: text(c.email, text(c.candidateEmail)),
          assignmentId: text(c.assignmentId),
          status: text(c.status, 'assigned'),
        };
      }),
      alreadyAssigned: (x.alreadyAssigned as unknown[]).map(toEligibilityCandidate),
      ineligible: (x.ineligible as unknown[]).map(toEligibilityCandidate),
      failed: (x.failed as unknown[]).map((i) => {
        const c = record(i);
        return {
          applicationId: text(c.applicationId),
          candidateId: text(c.candidateId) || undefined,
          candidateName: text(c.candidateName, text(c.applicationId, 'Candidate')),
          reason: text(c.reason, 'Assignment creation failed'),
        };
      }),
      summary: {
        requested: num(s.requested),
        assignedCount: num(s.assignedCount),
        alreadyAssignedCount: num(s.alreadyAssignedCount),
        ineligibleCount: num(s.ineligibleCount),
        failedCount: num(s.failedCount),
      },
    };
  }

  const details = arr(x.details);
  const assigned: BulkAssignResult['assigned'] = [];
  const alreadyAssigned: EligibilityCandidate[] = [];
  const ineligible: EligibilityCandidate[] = [];
  const failed: BulkAssignResult['failed'] = [];

  for (const item of details) {
    const c = record(item);
    const status = text(c.status);
    if (status === 'assigned') {
      assigned.push({
        applicationId: text(c.applicationId),
        candidateId: text(c.candidateId) || undefined,
        candidateName: text(c.candidateName, text(c.applicationId, 'Candidate')),
        email: text(c.email, text(c.candidateEmail)),
        assignmentId: text(c.assignmentId),
        status: 'assigned',
      });
    } else if (status === 'already-assigned' || status === 'already_assigned') {
      alreadyAssigned.push(toEligibilityCandidate(c));
    } else if (status === 'ineligible') {
      ineligible.push(toEligibilityCandidate(c));
    } else {
      failed.push({
        applicationId: text(c.applicationId),
        candidateId: text(c.candidateId) || undefined,
        candidateName: text(c.candidateName, text(c.applicationId, 'Candidate')),
        reason: text(c.reason, 'Assignment creation failed'),
      });
    }
  }

  const s = record(x.summary);
  return {
    assigned,
    alreadyAssigned,
    ineligible,
    failed,
    summary: {
      requested: num(s.requested, details.length),
      assignedCount: num(s.assignedCount, assigned.length),
      alreadyAssignedCount: num(s.alreadyAssignedCount, num(s.alreadyAssigned, alreadyAssigned.length)),
      ineligibleCount: num(s.ineligibleCount, num(s.ineligible, ineligible.length)),
      failedCount: num(s.failedCount, num(s.failed, failed.length)),
    },
  };
}

export interface CohortCategoryScore {
  category: string;
  totalMarks: number;
  awardedMarks: number;
  percentage: number;
  isProvisional: boolean;
}

export interface CohortCandidate {
  assignmentId: string;
  attemptId?: string | null;
  applicationId: string;
  applicationNumber?: string;
  candidateId?: string;
  candidateName: string;
  candidateEmail?: string;
  status: string;
  rawStatus?: string;
  attemptsUsed?: number;
  score?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
  isProvisional: boolean;
  submittedAt?: string | null;
  durationSeconds?: number;
  categoryScores: CohortCategoryScore[];
  university?: string;
  department?: string;
  rank: number;
}

export interface CohortLeaderboardSummary {
  totalAssigned: number;
  notStarted: number;
  inProgress: number;
  underReview: number;
  completed: number;
  resultReleased: number;
  overdue: number;
  cancelled: number;
}

export interface CohortLeaderboardResult {
  candidates: CohortCandidate[];
  summary: CohortLeaderboardSummary;
}

export interface PromoteCandidatesPayload {
  applicationIds: string[];
  targetStage: 'shortlisted' | 'interview-scheduled' | 'under-review' | string;
  reason?: string | undefined;
  allowProvisional?: boolean | undefined;
}

export interface PromotionDetail {
  applicationId: string;
  candidateName?: string;
  candidateEmail?: string;
  status: 'promoted' | 'already-in-stage' | 'failed';
  previousStage?: string;
  currentStage?: string;
  reason?: string;
}

export interface PromoteCandidatesResult {
  summary: {
    requested: number;
    promoted: number;
    alreadyInStage: number;
    failed: number;
    targetStage: string;
    note?: string;
  };
  details: PromotionDetail[];
}

export interface GenerateQuestionsPayload {
  topic: string;
  skills?: string[] | undefined;
  difficulty?: ('easy' | 'medium' | 'hard') | undefined;
  type?:
    | ('single-choice' | 'multiple-choice' | 'coding' | 'work-sample' | 'mixed')
    | undefined;
  count?: number | undefined;
}

export interface GenerateQuestionsResult {
  questions: Question[];
}

