import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import type { RecruiterPermission } from '../../auth/types';
import { toCompany, type CompanyDraft, serializeCompany } from './model';
export const companyKey = ['organization-company'] as const;
export async function loadCompany(includeTeam = false) {
  const response = await apiRequest<{ company?: unknown }>('/companies/me');
  return toCompany(response.company, includeTeam);
}
export function saveCompany(mode: 'create' | 'edit', draft: CompanyDraft) {
  return apiRequest(mode === 'create' ? '/companies' : '/companies/me', {
    method: mode === 'create' ? 'POST' : 'PATCH',
    body: serializeCompany(draft),
  });
}
export function useCompany(enabled = true, includeTeam = false) {
  return useQuery({
    queryKey: [...companyKey, includeTeam ? 'team' : 'profile'],
    enabled,
    queryFn: () => loadCompany(includeTeam),
    retry: false,
  });
}
export function useSaveCompany(mode: 'create' | 'edit') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: CompanyDraft) => saveCompany(mode, d),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}
export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      recruiterId: string;
      role: string;
      permissions: RecruiterPermission[];
    }) => apiRequest('/companies/me/team', { method: 'POST', body }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}
export function useUpdateMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      role?: string;
      permissions?: RecruiterPermission[];
      status?: 'active' | 'removed';
    }) => apiRequest(`/companies/me/team/${id}`, { method: 'PATCH', body }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}
export function useRemoveMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/companies/me/team/${id}`, { method: 'DELETE' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}
