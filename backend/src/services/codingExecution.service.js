import { executeCode } from './codeExecution.service.js';
import { AppError } from '../shared/errors/AppError.js';

const MAX_SOURCE_CODE_BYTES = 100 * 1024; // 100 KB limit

export const validateCodingPayload = (sourceCode, language, allowedLanguages = []) => {
  if (!sourceCode || typeof sourceCode !== 'string') {
    throw new AppError('Source code is required', 400);
  }
  if (Buffer.byteLength(sourceCode, 'utf8') > MAX_SOURCE_CODE_BYTES) {
    throw new AppError('Source code exceeds maximum allowed size of 100 KB', 400);
  }
  if (!language || typeof language !== 'string') {
    throw new AppError('Programming language is required', 400);
  }
  if (allowedLanguages.length > 0 && !allowedLanguages.includes(language.toLowerCase())) {
    throw new AppError(`Language "${language}" is not permitted for this question`, 400);
  }
};

export const resolveFunctionName = (question, language, sourceCode) => {
  if (question?.coding?.functionName) return question.coding.functionName;
  if (question?.functionName) return question.functionName;

  const langKey = (language || 'javascript').toLowerCase();
  const starter =
    question?.coding?.starterCode?.[langKey] ||
    question?.coding?.starterCode?.get?.(langKey) ||
    question?.starterCode?.[langKey] ||
    '';
  const starterMatch = typeof starter === 'string' ? starter.match(/(?:def|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/) : null;
  if (starterMatch?.[1]) return starterMatch[1];

  if (typeof sourceCode === 'string' && sourceCode.trim()) {
    const codeMatch = sourceCode.match(/(?:def|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
    if (codeMatch?.[1]) return codeMatch[1];
  }

  return 'solution';
};

export const executePublicCodingTests = async ({ sourceCode, language, question, adapter = null }) => {
  const allowedLangs =
    question.coding?.languageSupport ||
    question.languages ||
    ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'csharp', 'php'];

  validateCodingPayload(sourceCode, language, allowedLangs);

  const allTestCases = question.coding?.testCases || question.testCases || [];
  const publicTestCases = allTestCases.filter((tc) => !tc.isHidden);

  if (publicTestCases.length === 0) {
    return {
      status: 'completed',
      summary: { passed: 0, failed: 0, total: 0 },
      runtimeMs: 0,
      memoryKb: 0,
      tests: [],
    };
  }

  const limits = {
    timeLimit: question.coding?.timeLimit || 2.0,
    memoryLimit: question.coding?.memoryLimit || 512000,
  };

  const functionName = resolveFunctionName(question, language, sourceCode);
  const executionMode = question.coding?.executionMode || question.executionMode || 'function';

  const rawResult = await executeCode(
    { code: sourceCode, language, testCases: publicTestCases, limits, functionName, executionMode },
    adapter
  );

  const tests = (rawResult.testResults || []).map((tr, index) => {
    let testStatus = tr.passed ? 'passed' : 'failed';
    let errorMessage = null;

    if (!tr.passed) {
      if (tr.status === 'Time Limit Exceeded') {
        testStatus = 'timeout';
        errorMessage = 'Time limit exceeded';
      } else if (tr.status === 'Compile Error' || (tr.actualOutput && tr.actualOutput.includes('SyntaxError'))) {
        testStatus = 'compile_error';
        errorMessage = tr.actualOutput || 'Compilation error';
      } else if (tr.status === 'Runtime Error') {
        testStatus = 'runtime_error';
        errorMessage = 'Runtime execution error';
      } else {
        errorMessage = 'Wrong answer';
      }
    }

    return {
      index: index + 1,
      status: testStatus,
      runtimeMs: Math.round(tr.time || 0),
      error: errorMessage,
      input: tr.input,
      expectedOutput: tr.expectedOutput,
      actualOutput: tr.actualOutput,
    };
  });

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  let overallStatus = 'completed';
  let globalError = null;

  if (rawResult.status === 'compile_error' || tests.some((t) => t.status === 'compile_error')) {
    overallStatus = 'compile_error';
    const firstErr = tests.find((t) => t.status === 'compile_error');
    globalError = { type: 'compile_error', message: firstErr?.error || 'Compilation failed' };
  } else if (rawResult.status === 'timeout' || tests.some((t) => t.status === 'timeout')) {
    overallStatus = 'timeout';
    globalError = { type: 'timeout', message: 'Execution timed out' };
  } else if (rawResult.status === 'runtime_error') {
    overallStatus = 'runtime_error';
    globalError = { type: 'runtime_error', message: 'Runtime error occurred' };
  }

  return {
    status: overallStatus,
    summary: {
      passed: passedCount,
      failed: publicTestCases.length - passedCount,
      total: publicTestCases.length,
    },
    runtimeMs: Math.round(rawResult.executionTimeMs || 0),
    memoryKb: rawResult.testResults?.[0]?.memory || 0,
    error: globalError,
    tests,
  };
};

export const executeAllCodingTests = async ({ sourceCode, language, question, adapter = null }) => {
  const allowedLangs =
    question.coding?.languageSupport ||
    question.languages ||
    ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'csharp', 'php'];

  validateCodingPayload(sourceCode, language, allowedLangs);

  const allTestCases = question.coding?.testCases || question.testCases || [];
  const limits = {
    timeLimit: question.coding?.timeLimit || 2.0,
    memoryLimit: question.coding?.memoryLimit || 512000,
  };

  const functionName = resolveFunctionName(question, language, sourceCode);
  const executionMode = question.coding?.executionMode || question.executionMode || 'function';

  const rawResult = await executeCode(
    { code: sourceCode, language, testCases: allTestCases, limits, functionName, executionMode },
    adapter
  );

  const totalWeight = allTestCases.reduce((sum, tc) => sum + (tc.weight || 1), 0);
  const passedWeight = (rawResult.testResults || []).reduce(
    (sum, tr) => sum + (tr.passed ? tr.weight || 1 : 0),
    0
  );

  const questionMarks = question.marks || question.defaultMarks || 25;
  const functionalScore = totalWeight ? Math.round((questionMarks * passedWeight) / totalWeight * 100) / 100 : 0;

  return {
    status: rawResult.status || 'completed',
    passedTests: rawResult.passedTests || 0,
    totalTests: allTestCases.length,
    runtimeMs: Math.round(rawResult.executionTimeMs || 0),
    memoryKb: rawResult.testResults?.[0]?.memory || 0,
    functionalScore,
    finalScore: functionalScore,
    testResults: (rawResult.testResults || []).map((tr, index) => ({
      index: index + 1,
      passed: tr.passed,
      weight: tr.weight || 1,
      runtimeMs: Math.round(tr.time || 0),
      status: tr.status || (tr.passed ? 'Accepted' : 'Wrong Answer'),
    })),
  };
};
