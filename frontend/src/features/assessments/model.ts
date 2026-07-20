export type QuestionType =
  | 'single-choice'
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'long-answer'
  | 'coding';
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
    coding = record(x.coding);
  return {
    id: text(x._id, text(x.id)),
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
  };
}
export function toAssessment(v: unknown): Assessment {
  const x = record(v);
  const qs = arr(x.questions).map((q) =>
    toQuestion(record(q).questionSnapshot ?? record(q).question ?? q),
  );
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
  };
}
export function toAssignment(v: unknown): Assignment {
  const x = record(v),
    a = record(x.assessmentSnapshot ?? x.assessment),
    c = record(x.candidate),
    attemptId = text(record(x.attempt)._id, text(x.attemptId));
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
  };
}
export function toAttempt(v: unknown): Attempt {
  const x = record(v),
    snapshot = record(x.assessmentSnapshot),
    questions = arr(snapshot.questions).map((q) =>
      toQuestion(record(q).questionSnapshot ?? q),
    );
  const answers: Record<string, unknown> = {};
  arr(x.answers).forEach((a) => {
    const z = record(a);
    answers[text(z.questionId)] = z.code ?? z.answer;
  });
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
  };
}
export const safeResult = (v: unknown) => {
  const x = record(v);
  return {
    title: text(record(x.assessment).title, text(x.title, 'Assessment result')),
    score: num(x.score, num(x.percentage)),
    passed: typeof x.passed === 'boolean' ? x.passed : undefined,
    status: text(x.status, 'completed'),
    feedback: text(x.feedback),
  };
};
