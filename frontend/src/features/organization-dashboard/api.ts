import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiRequest } from '../../api/client';
import type { RecruiterPermission } from '../../auth/types';
import {
  currentWeekRange,
  dashboardDateRange,
  upcomingDateRange,
  readJobs,
  readNumber,
  toCandidatesEnvelope,
  toInterviews,
  toPipeline,
  type DashboardFilters,
} from './model';

const params = (values: Record<string, string | number | undefined>) => {
  const result = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') result.set(key, String(value));
  });
  return result.toString();
};
export const can = (
  permissions: readonly string[],
  _owner: boolean,
  permission: RecruiterPermission,
) => permissions.includes(permission);

export function useDashboardQueries(input: {
  filters: DashboardFilters;
  actorId: string;
  companyId: string;
  permissions: readonly string[];
  owner: boolean;
}) {
  const { filters, actorId, companyId, permissions, owner } = input;
  const applicationsAllowed = can(permissions, owner, 'applications.view');
  const interviewsAllowed = can(permissions, owner, 'interviews.view');
  const now = useMemo(() => new Date(), []);
  const range = useMemo(
    () => dashboardDateRange(filters.range, now),
    [filters.range, now],
  );
  const upcoming = useMemo(
    () => upcomingDateRange(filters.range, now),
    [filters.range, now],
  );
  const week = useMemo(() => currentWeekRange(now), [now]);
  const identity = [actorId, companyId];
  const request = (path: string, signal: AbortSignal) =>
    apiRequest<unknown>(path, { signal });
  const jobs = useQuery({
    queryKey: ['org-dashboard', ...identity, 'jobs'],
    enabled: can(permissions, owner, 'jobs.update'),
    queryFn: ({ signal }) => request('/jobs/manage?page=1&limit=50', signal),
    select: readJobs,
    retry: false,
  });
  const applications = useQuery({
    queryKey: ['org-dashboard', ...identity, 'applications', filters],
    enabled: applicationsAllowed,
    queryFn: ({ signal }) =>
      request(
        `/applications/manage?${params({ submittedFrom: range.from, submittedTo: range.to, search: filters.q || undefined, status: filters.stage || undefined, page: filters.page, limit: 10, sort: 'newest' })}`,
        signal,
      ),
    select: toCandidatesEnvelope,
    retry: false,
  });
  const newApplications = useQuery({
    queryKey: ['org-dashboard', ...identity, 'new-applications', filters.range],
    enabled: applicationsAllowed,
    queryFn: ({ signal }) =>
      request(
        `/applications/manage?${params({ submittedFrom: range.from, submittedTo: range.to, page: 1, limit: 1, sort: 'newest' })}`,
        signal,
      ),
    select: (value) => toCandidatesEnvelope(value).pagination.total,
    retry: false,
  });
  const pipeline = useQuery({
    queryKey: ['org-dashboard', ...identity, 'pipeline'],
    enabled: applicationsAllowed,
    queryFn: ({ signal }) => request('/applications/manage/pipeline', signal),
    select: toPipeline,
    retry: false,
  });
  const interviews = useQuery({
    queryKey: ['org-dashboard', ...identity, 'interviews', upcoming],
    enabled: interviewsAllowed,
    queryFn: ({ signal }) =>
      request(
        `/interviews/calendar?${params({ from: upcoming.from, to: upcoming.to })}`,
        signal,
      ),
    select: toInterviews,
    retry: false,
  });
  const weekInterviews = useQuery({
    queryKey: ['org-dashboard', ...identity, 'interviews-week', week],
    enabled: interviewsAllowed,
    queryFn: ({ signal }) =>
      request(
        `/interviews/calendar?${params({ from: week.from, to: week.to })}`,
        signal,
      ),
    select: toInterviews,
    retry: false,
  });
  const offers = useQuery({
    queryKey: ['org-dashboard', ...identity, 'offers'],
    enabled: can(permissions, owner, 'offers.view'),
    queryFn: ({ signal }) => request('/offers/analytics', signal),
    select: (value) =>
      readNumber(
        (value as { analytics?: unknown })?.analytics,
        'pendingApprovals',
      ) ?? 0,
    retry: false,
  });
  return {
    jobs,
    applications,
    newApplications,
    pipeline,
    interviews,
    weekInterviews,
    offers,
  };
}
