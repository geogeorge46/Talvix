import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import {
  safeSchedule,
  toCandidateProcess,
  toProcess,
  toTemplate,
} from './model';
const paged = (v: unknown, key: string, map: (x: unknown) => unknown) => {
  const x = v as Record<string, unknown>,
    p = (x.pagination ?? {}) as Record<string, number>;
  return {
    items: Array.isArray(x[key]) ? x[key].map(map) : [],
    page: p.page ?? 1,
    pages: p.pages ?? p.totalPages ?? 1,
    total: p.total ?? 0,
  };
};
export const useTemplates = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-templates', q],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/templates?${q}`),
    select: (v) => paged(v, 'templates', toTemplate),
    retry: false,
  });
export const useTemplate = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-template', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/templates/${id}`),
    select: (v) => toTemplate((v as { template?: unknown }).template),
    retry: false,
  });
export const useTemplateSave = (id?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(id ? `/interviews/templates/${id}` : '/interviews/templates', {
        method: id ? 'PATCH' : 'POST',
        body,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['interview-templates'] }),
  });
};
export const useTemplateAction = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'clone' | 'delete') =>
      apiRequest(
        `/interviews/templates/${id}${action === 'clone' ? '/clone' : ''}`,
        { method: action === 'clone' ? 'POST' : 'DELETE' },
      ),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['interview-templates'] }),
  });
};
export const useProcesses = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-processes', q],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/processes/manage?${q}`),
    select: (v) => paged(v, 'processes', toProcess),
    retry: false,
  });
export const useProcess = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-process', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/processes/manage/${id}`),
    select: (v) => toProcess((v as { process?: unknown }).process),
    retry: false,
  });
export const useProcessCreate = () =>
  useMutation({
    mutationFn: (body: unknown) =>
      apiRequest('/interviews/processes', { method: 'POST', body }),
  });
export const useProcessAction = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (x: {
      action: 'cancel' | 'archive' | 'finalize' | 'release-feedback';
      body?: unknown;
    }) =>
      apiRequest(`/interviews/processes/manage/${id}/${x.action}`, {
        method: 'PATCH',
        body: x.body,
      }),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['interview-process', id] }),
  });
};
export const useCandidateProcesses = (enabled = true) =>
  useQuery({
    queryKey: ['my-interviews'],
    enabled,
    queryFn: () => apiRequest<{ processes?: unknown[] }>('/interviews/me'),
    select: (v) => (v.processes ?? []).map(toCandidateProcess),
    retry: false,
  });
export const useCandidateProcess = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['my-interview', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/me/${id}`),
    select: (v) => toCandidateProcess((v as { process?: unknown }).process),
    retry: false,
  });
export const useCandidateSchedule = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['my-schedule', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/me/schedules/${id}`),
    select: (v) => safeSchedule((v as { schedule?: unknown }).schedule),
    retry: false,
  });
export const useScheduleResponse = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`/interviews/me/schedules/${id}/respond`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['my-schedule', id] }),
  });
};
export const useAvailability = (enabled = true) =>
  useQuery({
    queryKey: ['my-interview-availability'],
    enabled,
    queryFn: () =>
      apiRequest<{ availability?: unknown[] }>(
        '/interviews/availability/me?page=1&limit=50',
      ),
    select: (v) => v.availability ?? [],
    retry: false,
  });
export const useAvailabilitySave = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest('/interviews/availability/me', { method: 'PUT', body }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['my-interview-availability'] }),
  });
};
export const useAvailabilityDelete = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/interviews/availability/me/${id}`, { method: 'DELETE' }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['my-interview-availability'] }),
  });
};
export const useFeedback = (enabled = true) =>
  useQuery({
    queryKey: ['interview-feedback'],
    enabled,
    queryFn: () => apiRequest<{ feedback?: unknown[] }>('/interviews/feedback'),
    select: (v) => v.feedback ?? [],
    retry: false,
  });
export const useRoundFeedback = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-feedback', id],
    enabled,
    queryFn: () =>
      apiRequest<{ feedback?: unknown[] }>(`/interviews/feedback/${id}`),
    select: (v) => v.feedback ?? [],
    retry: false,
  });
export const useFeedbackAction = (roundId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (x: { submit?: boolean; body?: unknown }) =>
      apiRequest(
        `/interviews/feedback/${roundId}/me${x.submit ? '/submit' : ''}`,
        { method: x.submit ? 'POST' : 'PUT', body: x.body },
      ),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['interview-feedback', roundId] }),
  });
};
export const useCalendar = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-calendar', q],
    enabled,
    queryFn: () =>
      apiRequest<{ schedules?: unknown[] }>(`/interviews/calendar?${q}`),
    select: (v) => (v.schedules ?? []).map(safeSchedule),
    retry: false,
  });
export const useAnalytics = (enabled = true) =>
  useQuery({
    queryKey: ['interview-analytics'],
    enabled,
    queryFn: () =>
      apiRequest<{ analytics?: Record<string, unknown> }>(
        '/interviews/analytics',
      ),
    select: (v) => v.analytics ?? {},
    retry: false,
  });
export const useTeamAvailability = (q: string, enabled = true) =>
  useQuery({
    queryKey: ['interview-team-availability', q],
    enabled,
    queryFn: () => apiRequest<unknown>(`/interviews/availability/team?${q}`),
    select: (v) => paged(v, 'availability', (x) => x),
    retry: false,
  });
export const useRoundAction = (processId: string, roundId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (x: {
      action:
        'schedule' | 'reschedule' | 'cancel' | 'no-show' | 'start' | 'complete';
      body?: unknown;
    }) =>
      apiRequest(
        `/interviews/processes/manage/${processId}/rounds/${roundId}/${x.action}`,
        { method: x.action === 'schedule' ? 'POST' : 'PATCH', body: x.body },
      ),
    onSettled: () =>
      void qc.invalidateQueries({ queryKey: ['interview-process', processId] }),
  });
};
