import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import {
  toCandidateProfile,
  toPublicJob,
  toSafeApplication,
  toSafeNotification,
  toSafeTimeline,
  toSafeNotificationPreferences,
} from './model';
import { toAssignment } from '../assessments/model';
import { toCandidateProcess } from '../interviews/model';
import { toCandidateOffer, toDocument } from '../offers-documents/model';
const rec = (v: unknown) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const arr = (v: unknown, ...keys: string[]) => {
  let x: unknown = v;
  for (const k of keys) x = rec(x)[k];
  return Array.isArray(x) ? x : [];
};
const pagination = (v: unknown) => {
  const p = rec(rec(v).pagination);
  return {
    page: Number(p.page ?? 1),
    pages: Number(p.pages ?? p.totalPages ?? 1),
    total: Number(p.total ?? 0),
  };
};
export const useCandidateProfile = () =>
  useQuery({
    queryKey: ['candidate', 'profile'],
    queryFn: async () => {
      const value = rec(await apiRequest<unknown>('/candidates/me'));
      return toCandidateProfile(value.profile ?? value);
    },
  });
export const useCandidateProfileMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path = '/candidates/me',
      method = 'PATCH',
      body,
    }: {
      path?: string;
      method?: 'POST' | 'PATCH' | 'DELETE';
      body?: unknown;
    }) => apiRequest(path, { method, body, retry401: false }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['candidate', 'profile'] }),
  });
};
export const useJobs = (query: string) =>
  useQuery({
    queryKey: ['candidate', 'jobs', query],
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/jobs?${query}`, { auth: false });
      return { items: arr(v, 'jobs').map(toPublicJob), ...pagination(v) };
    },
  });
export const useJob = (id: string) =>
  useQuery({
    queryKey: ['candidate', 'job', id],
    queryFn: async () =>
      toPublicJob(
        rec(await apiRequest<unknown>(`/jobs/${id}`, { auth: false })).job,
      ),
  });
export const useApplications = (query = 'page=1&limit=20') =>
  useQuery({
    queryKey: ['candidate', 'applications', query],
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/applications/me?${query}`);
      return {
        items: arr(v, 'applications').map(toSafeApplication),
        ...pagination(v),
      };
    },
  });
export const useApplication = (id: string) =>
  useQuery({
    queryKey: ['candidate', 'application', id],
    queryFn: async () =>
      toSafeApplication(
        rec(await apiRequest<unknown>(`/applications/me/${id}`)).application,
      ),
  });
export const useApplicationTimeline = (id: string) =>
  useQuery({
    queryKey: ['candidate', 'application', id, 'timeline'],
    queryFn: async () =>
      arr(
        await apiRequest<unknown>(`/applications/me/${id}/timeline`),
        'timeline',
      ).map(toSafeTimeline),
  });
export const useApplicationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown }) =>
      apiRequest(path, {
        method: path === '/applications' ? 'POST' : 'PATCH',
        body,
        retry401: false,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['candidate', 'applications'] }),
  });
};
export const useNotifications = (query = 'page=1&limit=20') =>
  useQuery({
    queryKey: ['candidate', 'notifications', query],
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/notifications?${query}`);
      return {
        items: arr(v, 'notifications').map(toSafeNotification),
        ...pagination(v),
      };
    },
  });
export const useNotification = (id: string) =>
  useQuery({
    queryKey: ['candidate', 'notification', id],
    queryFn: async () => {
      const value = rec(await apiRequest<unknown>(`/notifications/${id}`));
      return toSafeNotification(value.notification ?? value);
    },
  });
export const useUnreadCount = () =>
  useQuery({
    queryKey: ['candidate', 'notifications', 'unread'],
    queryFn: async () =>
      Number(
        rec(await apiRequest<unknown>('/notifications/unread-count')).count ??
          0,
      ),
  });
export const useNotificationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = 'PATCH',
      body,
    }: {
      path: string;
      method?: 'PATCH' | 'DELETE';
      body?: unknown;
    }) => apiRequest(path, { method, body, retry401: false }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['candidate', 'notifications'] }),
  });
};
export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ['candidate', 'notification-preferences'],
    queryFn: async () => {
      const value = rec(
        await apiRequest<unknown>('/notifications/preferences'),
      );
      return toSafeNotificationPreferences(value.preferences ?? value);
    },
  });
export const useNotificationPreferenceMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      apiRequest('/notifications/preferences', {
        method: 'PUT',
        body,
        retry401: false,
      }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ['candidate', 'notification-preferences'],
      }),
  });
};
export const useSafeCandidateAssignments = () =>
  useQuery({
    queryKey: ['candidate', 'safe-assignments'],
    queryFn: async () => {
      const value = await apiRequest<unknown>(
        '/assessments/assignments/me?page=1&limit=10',
      );
      return arr(value, 'assignments').map(toAssignment);
    },
  });
export const useSafeCandidateInterviews = () =>
  useQuery({
    queryKey: ['candidate', 'safe-interviews'],
    queryFn: async () => {
      const value = await apiRequest<unknown>('/interviews/me');
      return arr(value, 'processes').map(toCandidateProcess);
    },
  });
export const useSafeCandidateOffers = () =>
  useQuery({
    queryKey: ['candidate', 'safe-offers'],
    queryFn: async () => {
      const value = await apiRequest<unknown>('/offers/me');
      return arr(value, 'offers').map(toCandidateOffer);
    },
  });
export const useCandidateProfilePhoto = () =>
  useQuery({
    queryKey: ['candidate', 'profile-photo'],
    queryFn: async () => {
      const value = rec(
        await apiRequest<unknown>('/documents/me/profile-photo'),
      );
      return value.document ? toDocument(value.document) : null;
    },
    retry: false,
  });
