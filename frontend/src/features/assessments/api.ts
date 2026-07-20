import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import {
  toAssessment,
  toAssignment,
  toAttempt,
  toQuestion,
  safeResult,
} from './model';
const page = (v: unknown, key: string, mapper: (x: unknown) => unknown) => {
  const x = v as Record<string, unknown>;
  const p = (x.pagination ?? {}) as Record<string, number>;
  return {
    items: Array.isArray(x[key]) ? x[key].map(mapper) : [],
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
            : { awardedMarks: input.awardedMarks, feedback: input.feedback },
        },
      ),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['assessment-review', id] }),
  });
};
