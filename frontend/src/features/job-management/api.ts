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
export function useCloneJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ job?: unknown }>(`/jobs/manage/${id}/clone`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['managed-jobs'] });
    },
  });
}

const isRealObjectId = (id?: string) => Boolean(id && id !== 'new' && /^[0-9a-fA-F]{24}$/.test(id));

export function useJobIntelligence(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['job-intelligence', jobId],
    enabled: isRealObjectId(jobId) && enabled,
    queryFn: () => apiRequest<{ data?: { intelligence?: unknown } }>(`/jobs/manage/${jobId}/intelligence`),
    select: (res) => (res as any)?.data?.intelligence ?? null,
    retry: false,
  });
}

export function useExtractJobIntelligence(jobId?: string) {
  const qc = useQueryClient();
  const isReal = isRealObjectId(jobId);
  return useMutation({
    mutationFn: (payload?: { forceRefresh?: boolean; title?: string; description?: string }) => {
      if (isReal) {
        return apiRequest<{ data?: { intelligence?: unknown } }>(`/jobs/manage/${jobId}/intelligence/extract`, {
          method: 'POST',
          body: { forceRefresh: payload?.forceRefresh ?? true },
        });
      }
      return apiRequest<{ data?: { intelligence?: unknown } }>('/jobs/ai/extract-intelligence', {
        method: 'POST',
        body: {
          title: payload?.title ?? '',
          description: payload?.description?.trim() || payload?.title || ''
        },
      });
    },
    onSuccess: () => {
      if (isReal) {
        void qc.invalidateQueries({ queryKey: ['job-intelligence', jobId] });
        void qc.invalidateQueries({ queryKey: ['managed-job', jobId] });
      }
    },
  });
}

export function useJobQuality(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['job-quality', jobId],
    enabled: isRealObjectId(jobId) && enabled,
    queryFn: () => apiRequest<{ data?: { quality?: unknown } }>(`/jobs/manage/${jobId}/quality`),
    select: (res) => (res as any)?.data?.quality ?? null,
    retry: false,
  });
}

export function useAnalyzeJobQuality(jobId?: string) {
  const qc = useQueryClient();
  const isReal = isRealObjectId(jobId);
  return useMutation({
    mutationFn: (payload?: { forceRefresh?: boolean; title?: string; description?: string }) => {
      if (isReal) {
        return apiRequest<{ data?: { quality?: unknown } }>(`/jobs/manage/${jobId}/quality/analyze`, {
          method: 'POST',
          body: { forceRefresh: payload?.forceRefresh ?? true },
        });
      }
      return apiRequest<{ data?: { quality?: unknown } }>('/jobs/ai/analyze-quality', {
        method: 'POST',
        body: {
          title: payload?.title ?? '',
          description: payload?.description?.trim() || payload?.title || ''
        },
      });
    },
    onSuccess: () => {
      if (isReal) {
        void qc.invalidateQueries({ queryKey: ['job-quality', jobId] });
        void qc.invalidateQueries({ queryKey: ['managed-job', jobId] });
      }
    },
  });
}

export function useJobBlueprint(jobId: string, enabled = true) {
  return useQuery({
    queryKey: ['job-blueprint', jobId],
    enabled: isRealObjectId(jobId) && enabled,
    queryFn: () => apiRequest<{ data?: { blueprint?: unknown } }>(`/jobs/manage/${jobId}/blueprint`),
    select: (res) => (res as any)?.data?.blueprint ?? null,
    retry: false,
  });
}

export function useGenerateJobBlueprint(jobId?: string) {
  const qc = useQueryClient();
  const isReal = isRealObjectId(jobId);
  return useMutation({
    mutationFn: (payload?: { forceRefresh?: boolean; title?: string; description?: string }) => {
      if (isReal) {
        return apiRequest<{ data?: { blueprint?: unknown } }>(`/jobs/manage/${jobId}/blueprint/generate`, {
          method: 'POST',
          body: { forceRefresh: payload?.forceRefresh ?? true },
        });
      }
      return apiRequest<{ data?: { blueprint?: unknown } }>('/jobs/ai/generate-blueprint', {
        method: 'POST',
        body: {
          title: payload?.title ?? '',
          description: payload?.description?.trim() || payload?.title || ''
        },
      });
    },
    onSuccess: () => {
      if (isReal) {
        void qc.invalidateQueries({ queryKey: ['job-blueprint', jobId] });
        void qc.invalidateQueries({ queryKey: ['managed-job', jobId] });
      }
    },
  });
}

export function useRegenerateBlueprintSection(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { sectionId: string; feedback?: string; customInstructions?: string }) => {
      return apiRequest<{ data?: { blueprint?: unknown } }>(`/jobs/manage/${jobId}/blueprint/regenerate-section`, {
        method: 'POST',
        body: payload,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-blueprint', jobId] });
    },
  });
}

export function useUpdateJobBlueprint(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      return apiRequest<{ data?: { blueprint?: unknown } }>(`/jobs/manage/${jobId}/blueprint`, {
        method: 'PATCH',
        body: { data },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-blueprint', jobId] });
    },
  });
}

export function useApproveJobBlueprint(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return apiRequest<{ data?: { blueprint?: unknown } }>(`/jobs/manage/${jobId}/blueprint/approve`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-blueprint', jobId] });
      void qc.invalidateQueries({ queryKey: ['managed-job', jobId] });
    },
  });
}

export function useConvertBlueprintToAssessment(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return apiRequest<{ data?: { assessmentId?: string } }>(`/jobs/manage/${jobId}/blueprint/convert`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['job-blueprint', jobId] });
      void qc.invalidateQueries({ queryKey: ['managed-job', jobId] });
    },
  });
}



