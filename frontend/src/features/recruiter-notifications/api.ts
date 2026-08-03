import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import { toSafeNotification, toSafeNotificationPreferences } from './model';

const arr = (v: unknown, key: string) =>
  v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>)[key])
    ? ((v as Record<string, unknown>)[key] as unknown[])
    : [];

const rec = (v: unknown) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

const pagination = (v: unknown) => {
  const meta = rec(rec(v).meta);
  return {
    pagination: {
      page: typeof meta.page === 'number' ? meta.page : 1,
      limit: typeof meta.limit === 'number' ? meta.limit : 20,
      total: typeof meta.total === 'number' ? meta.total : 0,
      pages: typeof meta.pages === 'number' ? meta.pages : 1,
    },
  };
};

export const useNotifications = (query = 'page=1&limit=20') =>
  useQuery({
    queryKey: ['recruiter', 'notifications', query],
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/notifications?${query}`);
      return {
        items: arr(v, 'notifications').map(toSafeNotification),
        ...pagination(v),
      };
    },
  });

export const useUnreadCount = () =>
  useQuery({
    queryKey: ['recruiter', 'notifications', 'unread'],
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruiter', 'notifications'] });
    },
  });
};

export const useNotificationPreferences = () =>
  useQuery({
    queryKey: ['recruiter', 'notification-preferences'],
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
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['recruiter', 'notification-preferences'],
      });
    },
  });
};
