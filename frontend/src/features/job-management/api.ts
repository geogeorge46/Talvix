import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import { toJob, type JobDraft, serializeDraft } from './model';
export function useManagedJobs(page: number, q: string, enabled = true) {
  return useQuery({
    queryKey: ['managed-jobs', page, q],
    enabled,
    queryFn: () =>
      apiRequest<unknown>(
        `/jobs/manage?page=${page}&limit=10${q ? `&search=${encodeURIComponent(q)}` : ''}`,
      ),
    select: (v) => {
      const x = v as {
        jobs?: unknown[];
        pagination?: { page?: number; pages?: number; total?: number };
      };
      return {
        jobs: (x.jobs ?? []).map(toJob),
        pagination: {
          page: x.pagination?.page ?? page,
          pages: x.pagination?.pages ?? 1,
          total: x.pagination?.total ?? 0,
        },
      };
    },
    retry: false,
  });
}
export function useManagedJob(id: string, enabled = true) {
  return useQuery({
    queryKey: ['managed-job', id],
    enabled,
    queryFn: () => apiRequest<unknown>(`/jobs/manage/${id}`),
    select: (v) => toJob((v as { job?: unknown }).job),
    retry: false,
  });
}
export function useSaveJob(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: JobDraft) =>
      apiRequest<{ job?: unknown }>(id ? `/jobs/manage/${id}` : '/jobs', {
        method: id ? 'PATCH' : 'POST',
        body: serializeDraft(draft),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['managed-jobs'] }),
  });
}
export function useJobAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'submit' | 'pause' | 'resume' | 'close' | 'archive') =>
      apiRequest(
        action === 'archive'
          ? `/jobs/manage/${id}`
          : `/jobs/manage/${id}/${action}`,
        { method: action === 'archive' ? 'DELETE' : 'PATCH' },
      ),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['managed-jobs'] });
      void qc.invalidateQueries({ queryKey: ['managed-job', id] });
    },
  });
}
