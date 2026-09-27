import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, tokenStore } from '../../api/client';
import {
  toAssessment,
  toAssignment,
  toAttempt,
  toQuestion,
  toEligibilityCheckResult,
  toBulkAssignResult,
  safeResult,
  type EligibilityCheckResult,
  type BulkAssignPayload,
  type BulkAssignResult,
  type CohortLeaderboardResult,
  type PromoteCandidatesPayload,
  type PromoteCandidatesResult,
  type GenerateQuestionsPayload,
  type GenerateQuestionsResult,
} from './model';
const page = <T>(v: unknown, key: string, mapper: (x: unknown) => T) => {
  const x = v as Record<string, unknown>;
  const p = (x.pagination ?? {}) as Record<string, number>;
  return {
    items: Array.isArray(x[key]) ? (x[key].map(mapper) as T[]) : ([] as T[]),
    page: p.page ?? 1,
    pages: p.pages ?? p.totalPages ?? 1,
    total: p.total ?? 0,
  };
};
export const useAssessments = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['assessments', q],
    enabled,
    queryFn: () => apiRequest<unknown>(`/assessments/manage?${q}`),
    select: (v) => page(v, 'assessments', toAssessment),
    retry: false,
  });
export const useQuestions = (enabled = true) =>
  useQuery({
    queryKey: ['assessment-questions'],
    enabled,
    queryFn: () =>
      apiRequest<unknown>('/assessments/questions?page=1&limit=50&sort=newest'),
    select: (v) => page(v, 'questions', toQuestion),
    retry: false,
  });
export const useQuestionSave = (id?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(
        id ? `/assessments/questions/${id}` : '/assessments/questions',
        { method: id ? 'PATCH' : 'POST', body },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['assessment-questions'] }),
  });
};
export const useGenerateQuestions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: GenerateQuestionsPayload,
    ): Promise<GenerateQuestionsResult> => {
      const response = await apiRequest<{ questions: unknown[]; count: number }>(
        '/assessments/intelligence/generate-questions',
        { method: 'POST', body },
      );
      return {
        questions: Array.isArray(response?.questions)
          ? response.questions.map(toQuestion)
          : [],
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assessment-questions'] });
    },
  });
};
export const useComposition = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      action: 'add' | 'remove' | 'reorder';
      questionId?: string;
      body?: unknown;
    }) =>
      apiRequest(
        input.action === 'remove'
          ? `/assessments/manage/${id}/questions/${input.questionId}`
          : input.action === 'reorder'
            ? `/assessments/manage/${id}/questions/reorder`
            : `/assessments/manage/${id}/questions`,
        {
          method:
            input.action === 'add'
              ? 'POST'
              : input.action === 'remove'
                ? 'DELETE'
                : 'PATCH',
          body: input.body,
        },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['assessment', id] }),
  });
};
export const useAssessment = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['assessment', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/assessments/manage/${id}`),
    select: (v) => toAssessment((v as { assessment?: unknown }).assessment),
    retry: false,
  });
export const useAssessmentSave = (id?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(id ? `/assessments/manage/${id}` : '/assessments', {
        method: id ? 'PATCH' : 'POST',
        body,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['assessments'] }),
  });
};
export const useAssessmentAction = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'publish' | 'archive' | 'clone') =>
      apiRequest(`/assessments/manage/${id}/${action}`, {
        method: action === 'clone' ? 'POST' : 'PATCH',
      }),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['assessment', id] }),
  });
};
export const useAssignments = (q: string, enabled = true, candidate = false) =>
  useQuery({
    queryKey: ['assessment-assignments', candidate, q],
    enabled,
    queryFn: () =>
      apiRequest<unknown>(
        `/assessments/assignments/${candidate ? 'me' : 'manage'}?${q}`,
      ),
    select: (v) => page(v, 'assignments', toAssignment),
    retry: false,
  });
export const useAssignment = (id: string, candidate: boolean, enabled = true) =>
  useQuery({
    queryKey: ['assessment-assignment', candidate, id],
    enabled,
    queryFn: () =>
      apiRequest<unknown>(
        `/assessments/assignments/${candidate ? 'me' : 'manage'}/${id}`,
      ),
    select: (v) => toAssignment((v as { assignment?: unknown }).assignment),
    retry: false,
  });
export const useAssignmentAction = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      action: 'cancel' | 'extend' | 'release-result';
      body?: unknown;
    }) =>
      apiRequest(`/assessments/assignments/manage/${id}/${input.action}`, {
        method: 'PATCH',
        body: input.body,
      }),
    onSettled: () =>
      void qc.invalidateQueries({
        queryKey: ['assessment-assignment', false, id],
      }),
  });
};
export const useCreateAssignment = () =>
  useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ assignment?: unknown }>('/assessments/assignments', {
        method: 'POST',
        body,
      }),
  });

export interface EligibilityCandidate {
  applicationId: string;
  candidateName?: string;
  candidateEmail?: string;
  status: 'eligible' | 'already-assigned' | 'ineligible';
  reason?: string;
  assignmentId?: string;
}

export const useStart = () =>
  useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ attempt?: unknown }>(
        `/assessments/assignments/me/${id}/start`,
        { method: 'POST' },
      ),
  });
export const useAttempt = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['assessment-attempt', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/assessments/attempts/me/${id}`),
    select: (v) => toAttempt((v as { attempt?: unknown }).attempt),
    retry: false,
  });
export const useSaveAnswer = (id: string) =>
  useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ savedAt: string }>(
        `/assessments/attempts/me/${id}/answers`,
        { method: 'PATCH', body },
      ),
  });
export const useSubmit = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/assessments/attempts/me/${id}/submit`, { method: 'POST' }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['assessment-attempt', id] }),
  });
};
export const useResult = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['assessment-result', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/assessments/attempts/me/${id}/result`),
    select: (v) => safeResult((v as { result?: unknown }).result),
    retry: false,
  });
export const useReviews = (enabled = true) =>
  useQuery({
    queryKey: ['assessment-reviews'],
    enabled,
    queryFn: () => apiRequest<{ attempts?: unknown[] }>('/assessments/reviews'),
    select: (v) => (v.attempts ?? []).map(toAttempt),
    retry: false,
  });
export const useReview = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['assessment-review', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/assessments/reviews/${id}`),
    select: (v) => toAttempt((v as { attempt?: unknown }).attempt),
    retry: false,
  });
export const useReviewAction = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      questionId?: string;
      awardedMarks?: number;
      feedback?: string;
      rubricScores?: { criterionName: string; awardedMarks: number; feedback?: string }[];
      complete?: boolean;
    }) =>
      apiRequest(
        input.complete
          ? `/assessments/reviews/${id}/complete`
          : `/assessments/reviews/${id}/questions/${input.questionId}`,
        {
          method: 'PATCH',
          body: input.complete
            ? {}
            : {
                awardedMarks: input.awardedMarks,
                feedback: input.feedback,
                rubricScores: input.rubricScores,
              },
        },
      ),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['assessment-review', id] }),
  });
};
export const useAttemptDocuments = (
  attemptId: string,
  enabled = true,
  isRecruiter = false,
) =>
  useQuery({
    queryKey: ['attempt-documents', attemptId, isRecruiter],
    enabled: Boolean(attemptId) && enabled,
    queryFn: () =>
      apiRequest<{ documents?: unknown[] }>(
        isRecruiter
          ? `/documents/manage/assessments/attempts/${attemptId}`
          : `/documents/assessments/attempts/${attemptId}`,
      ),
    select: (v) => (v.documents ?? []) as Record<string, unknown>[],
    retry: false,
  });

export const downloadAttemptDocument = async (
  attemptId: string,
  documentId: string,
  isRecruiter = false,
) => {
  const res = await apiRequest<{ url: string }>(
    isRecruiter
      ? `/documents/manage/assessments/attempts/${attemptId}/${documentId}/download`
      : `/documents/assessments/attempts/${attemptId}/${documentId}/download`,
  );
  return res.url;
};

export const uploadAttemptDeliverable = async (
  attemptId: string,
  file: File,
  purpose = 'Work sample deliverable',
  onProgress?: (pct: number) => void,
) => {
  const sessionRes = await apiRequest<{ uploadSession?: { id?: string } }>(
    '/documents/upload-session',
    {
      method: 'POST',
      body: {
        category: 'assessment-attachment',
        entityType: 'assessment-attempt',
        entityId: attemptId,
        purpose,
      },
    },
  );
  const sessionId = sessionRes.uploadSession?.id;
  if (!sessionId) throw new Error('Failed to establish upload session');

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const data = new FormData();
    data.append('uploadSessionId', sessionId);
    data.append('purpose', purpose);
    data.append('file', file);

    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';
    xhr.open('POST', `${baseUrl}/documents/assessments/attempts/${attemptId}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res.data?.document || res);
        } catch {
          resolve({});
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || 'File upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };
    xhr.send(data);
  });
};
export const useGenerateAIAssessment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobDescription: string) =>
      apiRequest<{ assessment?: unknown }>('/assessments/intelligence/generate', {
        method: 'POST',
        body: { jobDescription },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['assessments'] });
      void qc.invalidateQueries({ queryKey: ['questions'] });
    },
  });
};

export const useCheckEligibility = () => {
  return useMutation({
    mutationFn: async (body: { assessmentId: string; applicationIds: string[] }) => {
      const res = await apiRequest<unknown>('/assessments/assignments/check-eligibility', {
        method: 'POST',
        body,
      });
      return toEligibilityCheckResult(res);
    },
  });
};

export const useBulkAssignAssessment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: BulkAssignPayload) => {
      const res = await apiRequest<unknown>('/assessments/assignments/bulk', {
        method: 'POST',
        body,
      });
      return toBulkAssignResult(res);
    },
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ats-applications'] }),
        qc.invalidateQueries({ queryKey: ['ats-pipeline'] }),
        qc.invalidateQueries({ queryKey: ['assessments'] }),
        qc.invalidateQueries({ queryKey: ['assessment-assignments'] }),
      ]);
    },
  });
};

export const useCohortLeaderboard = (
  assessmentId: string,
  params?:
    | {
        jobId?: string;
        status?: string;
        category?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      }
    | string,
  enabled = true,
) => {
  let queryStr = '';
  if (typeof params === 'string') {
    queryStr = params.startsWith('?') ? params.slice(1) : params;
  } else if (params) {
    const q = new URLSearchParams();
    if (params.jobId) q.set('jobId', params.jobId);
    if (params.status) q.set('status', params.status);
    if (params.category) q.set('category', params.category);
    if (params.sortBy) q.set('sortBy', params.sortBy);
    if (params.sortOrder) q.set('sortOrder', params.sortOrder);
    queryStr = q.toString();
  }

  return useQuery({
    queryKey: ['cohort-leaderboard', assessmentId, queryStr],
    enabled: enabled && Boolean(assessmentId),
    queryFn: () =>
      apiRequest<CohortLeaderboardResult>(
        `/assessments/manage/${assessmentId}/cohort-leaderboard${queryStr ? `?${queryStr}` : ''}`,
      ),
    retry: false,
  });
};

export const usePromoteCandidates = (assessmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PromoteCandidatesPayload) =>
      apiRequest<PromoteCandidatesResult>(
        `/assessments/manage/${assessmentId}/promote`,
        {
          method: 'POST',
          body,
        },
      ),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cohort-leaderboard', assessmentId] }),
        qc.invalidateQueries({ queryKey: ['ats-applications'] }),
        qc.invalidateQueries({ queryKey: ['ats-pipeline'] }),
      ]);
    },
  });
};
