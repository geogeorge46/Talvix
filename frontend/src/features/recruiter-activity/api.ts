import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

export function useRecruiterActivityTimelineQuery(queryString = '') {
  return useQuery({
    queryKey: ['recruiter-activity-timeline', queryString],
    queryFn: () => apiRequest<any>(`/analytics/recruiter/activity-timeline?${queryString}`),
    retry: false,
  });
}
