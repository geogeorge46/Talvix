import { apiRequest } from '../../../api/client';

export interface TechnicalDraftData {
  type: 'coding' | 'debugging' | 'sql';
  language?: string;
  sourceCode?: string;
  sqlQuery?: string;
}

export interface TechnicalDraftResponse {
  type: string;
  language: string;
  sourceCode: string;
  sqlQuery: string;
  status: 'draft' | 'submitted';
  savedAt: string | null;
}

export interface CodeExecutionResult {
  status: 'unavailable' | 'completed' | 'error' | 'timeout' | 'compile_error';
  message?: string;
  passedTests?: number;
  totalTests?: number;
  executionTimeMs?: number;
  testResults?: { passed: boolean; weight: number; input?: unknown; expectedOutput?: unknown; actualOutput?: string; status?: string }[];
}

export const technicalAssessmentApi = {
  getTechnicalDraft: async (attemptId: string, questionId: string) => {
    const res = await apiRequest<{ draft: TechnicalDraftResponse }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/technical`
    );
    return res.draft;
  },

  saveTechnicalDraft: async (attemptId: string, questionId: string, data: TechnicalDraftData) => {
    const res = await apiRequest<{ submission: unknown }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/technical/draft`,
      {
        method: 'PUT',
        body: data,
      }
    );
    return res.submission;
  },

  submitTechnicalResponse: async (attemptId: string, questionId: string, data: TechnicalDraftData) => {
    const res = await apiRequest<{ submission: unknown }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/technical/submit`,
      {
        method: 'POST',
        body: data,
      }
    );
    return res.submission;
  },

  runCodingQuestion: async (
    attemptId: string,
    questionId: string,
    data: { code: string; language: string }
  ): Promise<CodeExecutionResult> => {
    const res = await apiRequest<{
      execution: {
        status: string;
        summary: { passed: number; total: number };
        runtimeMs: number;
        tests: { index: number; status: string; error?: string; input?: unknown; expectedOutput?: unknown; actualOutput?: string }[];
      };
    }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/coding/run`,
      {
        method: 'POST',
        body: { sourceCode: data.code, language: data.language },
      }
    );
    const exec = res.execution;
    return {
      status: exec.status as any,
      passedTests: exec.summary?.passed ?? 0,
      totalTests: exec.summary?.total ?? 0,
      executionTimeMs: exec.runtimeMs ?? 0,
      testResults: (exec.tests || []).map((t) => ({
        passed: t.status === 'passed',
        weight: 1,
        status: t.status,
        input: t.input,
        expectedOutput: t.expectedOutput,
        actualOutput: t.actualOutput,
        error: t.error,
      })),
    };
  },

  submitCodingQuestion: async (
    attemptId: string,
    questionId: string,
    data: { code: string; language: string }
  ) => {
    const res = await apiRequest<{ submission: unknown }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/coding/submit`,
      {
        method: 'POST',
        body: { sourceCode: data.code, language: data.language },
      }
    );
    return res.submission;
  },

  getSQLSchema: async (attemptId: string, questionId: string) => {
    const res = await apiRequest<{ schema: { schemaDDL: string; tables: { tableName: string; columns: { name: string; type: string; isPrimaryKey?: boolean; isForeignKey?: boolean }[]; sampleRows?: Record<string, unknown>[] }[] } }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/sql/schema`
    );
    return res.schema;
  },

  runSQLQuestion: async (attemptId: string, questionId: string, sqlQuery: string) => {
    const res = await apiRequest<{ result: { status: string; columns: string[]; rows: Record<string, unknown>[]; rowCount: number; executionTimeMs: number; error: string | null } }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/sql/run`,
      {
        method: 'POST',
        body: { sqlQuery },
      }
    );
    return res.result;
  },

  submitSQLQuestion: async (attemptId: string, questionId: string, sqlQuery: string) => {
    const res = await apiRequest<{ submission: { status: string; passed: boolean; reason: string; grading: { finalScore: number } } }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/sql/submit`,
      {
        method: 'POST',
        body: { sqlQuery },
      }
    );
    return res.submission;
  },

  runDebuggingQuestion: async (
    attemptId: string,
    questionId: string,
    data: { code: string; language: string }
  ): Promise<CodeExecutionResult> => {
    const res = await apiRequest<{
      execution: {
        status: string;
        summary: { passed: number; total: number };
        runtimeMs: number;
        tests: { index: number; status: string; error?: string; input?: unknown; expectedOutput?: unknown; actualOutput?: string }[];
      };
    }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/debugging/run`,
      {
        method: 'POST',
        body: { sourceCode: data.code, language: data.language },
      }
    );
    const exec = res.execution;
    return {
      status: exec.status as any,
      passedTests: exec.summary?.passed ?? 0,
      totalTests: exec.summary?.total ?? 0,
      executionTimeMs: exec.runtimeMs ?? 0,
      testResults: (exec.tests || []).map((t) => ({
        passed: t.status === 'passed',
        weight: 1,
        status: t.status,
        input: t.input,
        expectedOutput: t.expectedOutput,
        actualOutput: t.actualOutput,
        error: t.error,
      })),
    };
  },

  submitDebuggingQuestion: async (
    attemptId: string,
    questionId: string,
    data: { code: string; language: string }
  ) => {
    const res = await apiRequest<{ submission: unknown }>(
      `/assessments/attempts/me/${attemptId}/questions/${questionId}/debugging/submit`,
      {
        method: 'POST',
        body: { sourceCode: data.code, language: data.language },
      }
    );
    return res.submission;
  },
};


