import { describe, expect, it } from 'vitest';
import { safeResult, toAssignment, toAttempt } from './model';

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
