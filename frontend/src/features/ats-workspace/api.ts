import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import {
  toApplicationDetail,
  toApplicationRow,
  toCandidate,
  toPage,
  type ApplicationStatus,
} from './model';
export function useApplications(query: string, enabled = true) {
  return useQuery({
    queryKey: ['ats-applications', query],
    enabled,
    retry: false,
    queryFn: () => apiRequest<unknown>(`/applications/manage?${query}`),
    select: (v) => {
      const x = v as { applications?: unknown[]; pagination?: unknown };
      return {
        items: (x.applications ?? []).map(toApplicationRow),
        page: toPage(x.pagination),
      };
    },
  });
}
export function usePipeline(jobId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['ats-pipeline', jobId],
    enabled,
    retry: false,
    queryFn: () =>
      apiRequest<{ total?: number; pipeline?: Record<string, number> }>(
        `/applications/manage/pipeline${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`,
      ),
  });
}
export function useApplication(id: string, enabled = true) {
  return useQuery({
    queryKey: ['ats-application', id],
    enabled,
    retry: false,
    queryFn: () =>
      apiRequest<{ application?: unknown }>(`/applications/manage/${id}`),
    select: (v) => toApplicationDetail(v.application),
  });
}
export function useCandidates(query: string, enabled = true) {
  return useQuery({
    queryKey: ['ats-candidates', query],
    enabled,
    retry: false,
    queryFn: () => apiRequest<unknown>(`/candidates?${query}`),
    select: (v) => {
      const x = v as { candidates?: unknown[]; pagination?: unknown };
      return {
        items: (x.candidates ?? []).map(toCandidate),
        page: toPage(x.pagination),
      };
    },
  });
}
export function useCandidate(id: string, enabled = true) {
  return useQuery({
    queryKey: ['ats-candidate', id],
    enabled,
    retry: false,
    queryFn: () => apiRequest<{ profile?: unknown }>(`/candidates/${id}`),
    select: (v) => toCandidate(v.profile),
  });
}
export function useMoveApplication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      status: ApplicationStatus;
      reason?: string;
      rejectionCategory?: string;
    }) =>
      apiRequest(`/applications/manage/${id}/status`, {
        method: 'PATCH',
        body,
      }),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ats-applications'] }),
        qc.invalidateQueries({ queryKey: ['ats-pipeline'] }),
        qc.invalidateQueries({ queryKey: ['ats-application', id] }),
      ]);
    },
  });
}
