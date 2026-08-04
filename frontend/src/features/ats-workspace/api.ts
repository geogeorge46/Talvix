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

export function useBulkApplications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      applicationIds: string[];
      action: 'move-stage' | 'reject' | 'assign-recruiter' | 'add-tags' | 'archive';
      payload?: {
        status?: string;
        reason?: string;
        rejectionCategory?: string;
        recruiterIds?: string[];
        tags?: string[];
      };
    }) =>
      apiRequest(`/applications/manage/bulk`, {
        method: 'POST',
        body,
      }),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['ats-applications'] }),
        qc.invalidateQueries({ queryKey: ['ats-pipeline'] }),
      ]);
    },
  });
}

export interface TimelineItem {
  type: 'status_change' | 'note' | 'comment' | 'audit_event';
  id?: string;
  from?: string;
  to?: string;
  reason?: string;
  content?: string;
  isPrivate?: boolean;
  action?: string;
  actor?: { fullName: string; email: string };
  timestamp: string;
  newValue?: any;
  oldValue?: any;
}

export interface CommentItem {
  _id: string;
  application: string;
  author: { _id: string; fullName: string; email: string; avatar?: string };
  content: string;
  parentId: string | null;
  mentions: string[];
  attachments: string[];
  createdAt: string;
}

export function useApplicationTimeline(applicationId: string) {
  return useQuery({
    queryKey: ['ats-application-timeline', applicationId],
    queryFn: () =>
      apiRequest<{ timeline: TimelineItem[] }>(`/applications/manage/${applicationId}/timeline`),
    select: (v) => v.timeline,
  });
}

export function useApplicationComments(applicationId: string) {
  return useQuery({
    queryKey: ['ats-application-comments', applicationId],
    queryFn: () =>
      apiRequest<{ comments: CommentItem[] }>(`/applications/manage/${applicationId}/comments`),
    select: (v) => v.comments,
  });
}

export function useAddApplicationComment(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { content: string; parentId?: string | null }) =>
      apiRequest<{ comment: CommentItem }>(`/applications/manage/${applicationId}/comments`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-application-comments', applicationId] });
      qc.invalidateQueries({ queryKey: ['ats-application-timeline', applicationId] });
    },
  });
}

export function useDeleteApplicationComment(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiRequest(`/applications/manage/${applicationId}/comments/${commentId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-application-comments', applicationId] });
      qc.invalidateQueries({ queryKey: ['ats-application-timeline', applicationId] });
    },
  });
}

export function useAddApplicationNote(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { note: string; isPrivate?: boolean }) =>
      apiRequest(`/applications/manage/${applicationId}/notes`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-application', applicationId] });
      qc.invalidateQueries({ queryKey: ['ats-application-timeline', applicationId] });
    },
  });
}

export function useUpdateApplicationNote(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: { note: string; isPrivate?: boolean } }) =>
      apiRequest(`/applications/manage/${applicationId}/notes/${noteId}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-application', applicationId] });
      qc.invalidateQueries({ queryKey: ['ats-application-timeline', applicationId] });
    },
  });
}

export function useDeleteApplicationNote(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/applications/manage/${applicationId}/notes/${noteId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ats-application', applicationId] });
      qc.invalidateQueries({ queryKey: ['ats-application-timeline', applicationId] });
    },
  });
}
