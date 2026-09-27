import { describe, expect, it } from 'vitest';
import { safeResult, toAssignment, toAttempt, toQuestion, toEligibilityCheckResult, toBulkAssignResult } from './model';

describe('assessment candidate privacy adapters', () => {
  it('excludes answer keys, hidden tests, audit data, and private recruiter feedback', () => {
    const attempt = toAttempt({
      _id: 'attempt-1',
      status: 'in-progress',
      expiresAt: '2030-01-01T00:00:00.000Z',
      assessmentSnapshot: {
        title: 'Frontend assessment',
        questions: [
          {
            questionSnapshot: {
              _id: 'q1',
              type: 'coding',
              prompt: 'Write a function',
              correctAnswer: 'secret-answer',
              explanation: 'secret-explanation',
              coding: {
                languageSupport: ['javascript'],
                starterCode: { javascript: '' },
                testCases: [
                  { isHidden: true, expectedOutput: 'secret-output' },
                ],
              },
            },
          },
        ],
      },
      auditLog: 'secret-audit',
    });
    const serialized = JSON.stringify(attempt);
    [
      'secret-answer',
      'secret-explanation',
      'secret-output',
      'secret-audit',
    ].forEach((secret) => expect(serialized).not.toContain(secret));
    expect(attempt.questions[0]?.languages).toEqual(['javascript']);
  });

  it('shows only released result summary fields', () => {
    const result = safeResult({
      title: 'Result',
      percentage: 82,
      passed: true,
      feedback: 'Candidate feedback',
      privateFeedback: 'secret-private',
      correctAnswers: 'secret-key',
    });
    expect(result).toEqual({
      title: 'Result',
      score: 82,
      passed: true,
      status: 'completed',
      feedback: 'Candidate feedback',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('assessment restoration states', () => {
  it('restores locally saved answer values from an interrupted attempt payload', () => {
    const attempt = toAttempt({
      _id: 'a',
      status: 'in-progress',
      assessmentSnapshot: { questions: [] },
      answers: [{ questionId: 'q1', answer: 'preserved response' }],
    });
    expect(attempt.answers.q1).toBe('preserved response');
  });

  it('does not synthesize an attempt id for an unstarted assignment', () => {
    expect(
      toAssignment({ _id: 'x', status: 'expired', expiresAt: '2020-01-01' }),
    ).not.toHaveProperty('attemptId');
  });
});

describe('question model adapters', () => {
  it('maps category, difficulty, skills, and coding properties correctly', () => {
    const q = toQuestion({
      _id: 'q-react-1',
      type: 'coding',
      title: 'Debounce Function',
      prompt: 'Implement debounce with delayMs',
      defaultMarks: 15,
      category: 'Frontend',
      difficulty: 'medium',
      skills: ['React', 'JavaScript', 'Async'],
      coding: {
        languageSupport: ['javascript'],
        starterCode: { javascript: 'function debounce() {}' },
      },
    });

    expect(q.id).toBe('q-react-1');
    expect(q.type).toBe('coding');
    expect(q.title).toBe('Debounce Function');
    expect(q.marks).toBe(15);
    expect(q.category).toBe('Frontend');
    expect(q.difficulty).toBe('medium');
    expect(q.skills).toEqual(['React', 'JavaScript', 'Async']);
    expect(q.languages).toEqual(['javascript']);
    expect(q.starterCode.javascript).toBe('function debounce() {}');
  });
});

describe('eligibility and bulk assign adapters', () => {
  it('adapts backend check-eligibility payload to frontend EligibilityCheckResult', () => {
    const backendData = {
      summary: { total: 3, eligible: 1, alreadyAssigned: 1, ineligible: 1 },
      candidates: [
        {
          applicationId: 'app1',
          candidateName: 'Alice',
          candidateEmail: 'alice@example.com',
          status: 'eligible',
        },
        {
          applicationId: 'app2',
          candidateName: 'Bob',
          candidateEmail: 'bob@example.com',
          status: 'already-assigned',
          reason: 'Active assignment already exists',
        },
        {
          applicationId: 'app3',
          candidateName: 'Charlie',
          candidateEmail: 'charlie@example.com',
          status: 'ineligible',
          reason: 'Application has been withdrawn',
        },
      ],
    };

    const result = toEligibilityCheckResult(backendData);
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0].candidateName).toBe('Alice');
    expect(result.alreadyAssigned).toHaveLength(1);
    expect(result.alreadyAssigned[0].candidateName).toBe('Bob');
    expect(result.ineligible).toHaveLength(1);
    expect(result.ineligible[0].candidateName).toBe('Charlie');
    expect(result.summary.total).toBe(3);
    expect(result.summary.eligibleCount).toBe(1);
    expect(result.summary.alreadyAssignedCount).toBe(1);
    expect(result.summary.ineligibleCount).toBe(1);
  });

  it('adapts backend bulk-assign payload to frontend BulkAssignResult', () => {
    const backendData = {
      summary: { requested: 2, assignedCount: 1, alreadyAssignedCount: 0, ineligibleCount: 0, failedCount: 1 },
      details: [
        {
          applicationId: 'app1',
          candidateName: 'Alice',
          candidateEmail: 'alice@example.com',
          status: 'assigned',
          assignmentId: 'asg1',
        },
        {
          applicationId: 'app4',
          candidateName: 'Dave',
          status: 'failed',
          reason: 'Database error',
        },
      ],
    };

    const result = toBulkAssignResult(backendData);
    expect(result.assigned).toHaveLength(1);
    expect(result.assigned[0].assignmentId).toBe('asg1');
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toBe('Database error');
    expect(result.summary.requested).toBe(2);
  });
});


