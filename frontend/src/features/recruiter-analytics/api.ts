import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';

export function useRecruiterAnalyticsQuery() {
  return useQuery({
    queryKey: ['recruiter-analytics'],
    queryFn: () => apiRequest<any>('/analytics/recruiter/analytics'),
    retry: false,
  });
}
