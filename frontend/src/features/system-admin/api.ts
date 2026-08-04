import { apiRequest } from '../../api/client';
import { tokenStore } from '../../api/client';
import { collectionFrom, compactQuery, detailFrom, type AdminRecord } from './model';

export const adminApi = {
  analytics: (domain: string, query: Record<string, string | undefined> = {}) =>
    apiRequest<unknown>(`/admin/analytics/${domain}${compactQuery(query)}`),
  list: async (path: string, query: Record<string, string | number | undefined> = {}) =>
    collectionFrom(await apiRequest<unknown>(`${path}${compactQuery(query)}`)),
  detail: async (path: string) => detailFrom(await apiRequest<AdminRecord>(path)),
  mutate: (path: string, method: 'PATCH' | 'POST' | 'DELETE', body?: unknown) =>
    apiRequest<unknown>(path, { method, body }),
};

export async function downloadAnalyticsCsv(query: Record<string, string>) {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';
  const response = await fetch(`${base}/admin/analytics/export${compactQuery(query)}`, {
    headers: { Accept: 'text/csv', ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}) },
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  return response.blob();
}

export const adminPaths = {
  recruiterQueue: '/recruiters/admin/pending',
  companyQueue: '/companies/admin/pending',
  jobQueue: '/jobs/admin/pending',
  applications: '/applications/admin',
  assignments: '/assessments/admin/assignments',
  interviews: '/interviews/admin/processes',
  offers: '/offers/admin',
  documents: '/documents/admin',
  notifications: '/notifications/admin',
  templates: '/notifications/admin/templates',
  outbox: '/notifications/admin/outbox',
  emailLogs: '/notifications/admin/email-logs',
  users: '/admin/management/users',
  recruiters: '/admin/management/recruiters',
  companies: '/admin/management/companies',
  jobs: '/admin/management/jobs',
  questions: '/admin/management/questions',
  audits: '/admin/management/audits',
} as const;

export function approvalAction(
  kind: 'recruiters' | 'companies' | 'jobs',
  id: string,
  action: string,
) {
  const verbs: Record<string, string> = {
    approve: kind === 'companies' ? 'verify' : 'approve',
    reject: 'reject', suspend: 'suspend', feature: 'feature', unfeature: 'unfeature',
  };
  return `/${kind}/admin/${id}/${verbs[action] ?? action}`;
}
