import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { executeLocalHarness } from '../src/services/codeHarness.service.js';
import { executePublicCodingTests, executeAllCodingTests } from '../src/services/codingExecution.service.js';
import { serializeActiveAttempt } from '../src/utils/assessmentSerializer.js';

describe('Coding Harness & 5-Question Technical Assessment Pipeline', () => {
  describe('1. Local Execution Harness', () => {
    it('evaluates correct JS function code as passed', () => {
      const code = 'function add(a, b) { return a + b; }';
      const result = executeLocalHarness({
        code,
        language: 'javascript',
        functionName: 'add',
        executionMode: 'function',
        testCases: [
          { input: [2, 3], expectedOutput: 5, weight: 1 },
          { input: [10, -2], expectedOutput: 8, weight: 1 },
        ],
      });

      expect(result.status).toBe('completed');
      expect(result.passedTests).toBe(2);
      expect(result.totalTests).toBe(2);
      expect(result.testResults[0].passed).toBe(true);
      expect(result.testResults[1].passed).toBe(true);
    });

    it('evaluates incorrect JS function code as failed (NO false positives)', () => {
      const code = 'function add(a, b) { return a - b; }';
      const result = executeLocalHarness({
        code,
        language: 'javascript',
        functionName: 'add',
        executionMode: 'function',
        testCases: [
          { input: [2, 3], expectedOutput: 5, weight: 1 },
        ],
      });

      expect(result.status).toBe('completed');
      expect(result.passedTests).toBe(0);
      expect(result.totalTests).toBe(1);
      expect(result.testResults[0].passed).toBe(false);
      expect(result.testResults[0].actualOutput).toBe('-1');
    });

    it('handles JS syntax errors properly', () => {
      const code = 'function add(a, b) { return a + ';
      const result = executeLocalHarness({
        code,
        language: 'javascript',
        functionName: 'add',
        executionMode: 'function',
        testCases: [{ input: [2, 3], expectedOutput: 5, weight: 1 }],
      });

      expect(result.status).toBe('compile_error');
      expect(result.passedTests).toBe(0);
    });

    it('handles JS infinite loop timeouts properly', () => {
      const code = 'function solution() { while(true) {} }';
      const result = executeLocalHarness({
        code,
        language: 'javascript',
        functionName: 'solution',
        executionMode: 'function',
        testCases: [{ input: [], expectedOutput: 1, weight: 1 }],
        limits: { timeLimit: 0.2 },
      });

      expect(result.status).toBe('timeout');
      expect(result.passedTests).toBe(0);
    });

    it('evaluates Python function code correctly', () => {
      const code = 'def solution(a, b):\n    return a * b';
      const result = executeLocalHarness({
        code,
        language: 'python',
        functionName: 'solution',
        executionMode: 'function',
        testCases: [
          { input: [3, 4], expectedOutput: 12, weight: 1 },
        ],
      });

      expect(result.status).toBe('completed');
      expect(result.passedTests).toBe(1);
      expect(result.testResults[0].passed).toBe(true);
    });
  });

  describe('2. Public vs All Test Cases & Language Filtering', () => {
    const mockQuestion = {
      marks: 20,
      coding: {
        languageSupport: ['javascript', 'python'],
        functionName: 'findMax',
        executionMode: 'function',
        testCases: [
          { input: [[1, 5, 3]], expectedOutput: 5, isHidden: false, weight: 1 },
          { input: [[-10, -5]], expectedOutput: -5, isHidden: true, weight: 1 },
        ],
      },
    };

    it('executePublicCodingTests runs only non-hidden test cases', async () => {
      const code = 'function findMax(arr) { return Math.max(...arr); }';
      const res = await executePublicCodingTests({
        sourceCode: code,
        language: 'javascript',
        question: mockQuestion,
      });

      expect(res.status).toBe('completed');
      expect(res.summary.total).toBe(1); // Only 1 public test case
      expect(res.summary.passed).toBe(1);
    });

    it('executeAllCodingTests runs both public and hidden test cases for final score', async () => {
      const code = 'function findMax(arr) { return Math.max(...arr); }';
      const res = await executeAllCodingTests({
        sourceCode: code,
        language: 'javascript',
        question: mockQuestion,
      });

      expect(res.status).toBe('completed');
      expect(res.totalTests).toBe(2); // Public + Hidden
      expect(res.passedTests).toBe(2);
      expect(res.functionalScore).toBe(20);
    });

    it('rejects unpermitted programming languages', async () => {
      const code = 'public class Solution {}';
      await expect(
        executePublicCodingTests({
          sourceCode: code,
          language: 'java',
          question: mockQuestion,
        })
      ).rejects.toThrow('Language "java" is not permitted');
    });
  });

  describe('3. 5-Question Assessment Serialization & Snapshot Integrity', () => {
    it('serializes all 5 questions cleanly in active attempt serializer', () => {
      const questionIds = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];

      const snapshot = {
        title: '5-Question Tech Assessment',
        allowBackNavigation: true,
        questions: questionIds.map((id, index) => ({
          questionId: id,
          type: index === 0 ? 'coding' : index === 1 ? 'sql' : index === 2 ? 'debugging' : 'single-choice',
          title: `Question ${index + 1}`,
          prompt: `Prompt for question ${index + 1}`,
          marks: 10,
          isRequired: true,
          options: index === 3 ? [{ id: 'opt1', text: 'Option A' }] : [],
          coding: index === 0 ? { languageSupport: ['javascript'], functionName: 'sol', testCases: [] } : undefined,
          sqlConfig: index === 1 ? { datasetId: 'ds1' } : undefined,
          debugging: index === 2 ? { brokenCode: 'const x = 1;' } : undefined,
        })),
      };

      const attempt = {
        id: new mongoose.Types.ObjectId().toString(),
        status: 'in-progress',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        seed: 12345,
        questionOrder: questionIds,
        optionOrders: {},
        answers: [],
      };

      const serialized = serializeActiveAttempt(attempt, snapshot);
      expect(serialized.questions).toHaveLength(5);
      expect(serialized.questions.map((q) => q.title)).toEqual([
        'Question 1',
        'Question 2',
        'Question 3',
        'Question 4',
        'Question 5',
      ]);
    });
  });
});
