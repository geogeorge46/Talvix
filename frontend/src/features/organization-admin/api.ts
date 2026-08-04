import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client';
import type { RecruiterPermission } from '../../auth/types';
import { toCompany, type CompanyDraft, serializeCompany } from './model';
export const companyKey = ['organization-company'] as const;
const clearTeamCache = (qc: ReturnType<typeof useQueryClient>) => {
  qc.removeQueries({ queryKey: [...companyKey, 'team'], exact: true });
};
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
    onMutate: () => clearTeamCache(qc),
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
    onMutate: () => clearTeamCache(qc),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}
export function useRemoveMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/companies/me/team/${id}`, { method: 'DELETE' }),
    onMutate: () => clearTeamCache(qc),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}

// Invitations API
export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: string; permissions: string[] }) =>
      apiRequest<{ token: string }>('/companies/me/invitations', { method: 'POST', body }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) =>
      apiRequest(`/companies/invitations/${token}/accept`, { method: 'POST' }),
  });
}

export function useGetInvitationDetails(token: string | null) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: () =>
      apiRequest<{ invitation: { company: { name: string }; email: string; role: string } }>(
        `/companies/invitations/${token}`,
        { auth: false }
      ).then((r) => r.invitation),
    enabled: !!token,
  });
}

// Join Requests API
export function useJoinRequest() {
  return useMutation({
    mutationFn: (companyId: string) =>
      apiRequest(`/companies/${companyId}/join-request`, { method: 'POST' }),
  });
}

export function useGetJoinRequests() {
  return useQuery({
    queryKey: [...companyKey, 'join-requests'],
    queryFn: () => apiRequest<{ data: { requests: any[] } }>('/companies/me/join-requests').then(r => r.data.requests),
  });
}

export function useReviewJoinRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, action, notes }: { requestId: string; action: 'approve' | 'reject'; notes?: string }) =>
      apiRequest(`/companies/me/join-requests/${requestId}`, { method: 'PATCH', body: { action, notes } }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...companyKey, 'join-requests'] });
      qc.invalidateQueries({ queryKey: companyKey });
    },
  });
}

// Claims API
export function useClaimOwnership() {
  return useMutation({
    mutationFn: ({ companyId, officialEmail, linkedinUrl, proofUrl }: { companyId: string; officialEmail: string; linkedinUrl: string; proofUrl?: string }) =>
      apiRequest(`/companies/${companyId}/claims`, { method: 'POST', body: { officialEmail, linkedinUrl, proofUrl } }),
  });
}

// Platform Admin Overrides API
export function useGetAdminClaims() {
  return useQuery({
    queryKey: ['admin-claims'],
    queryFn: () => apiRequest<{ claims: any[] }>('/admin/claims').then(r => r.claims),
  });
}

export function useResolveClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ claimId, action, notes }: { claimId: string; action: 'approve' | 'reject'; notes?: string }) =>
      apiRequest(`/admin/claims/${claimId}`, { method: 'PATCH', body: { action, notes } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['admin-claims'] }),
  });
}

export function useTransferOwnership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, newOwnerId }: { companyId: string; newOwnerId: string }) =>
      apiRequest(`/admin/companies/${companyId}/transfer-ownership`, { method: 'PATCH', body: { newOwnerId } }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}

export function useAdminRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, memberId }: { companyId: string; memberId: string }) =>
      apiRequest(`/admin/companies/${companyId}/members/${memberId}`, { method: 'DELETE' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}

export function useRestoreCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      apiRequest(`/admin/companies/${companyId}/restore`, { method: 'PATCH' }),
    onSettled: () => void qc.invalidateQueries({ queryKey: companyKey }),
  });
}

export function useRestoreRecruiter() {
  return useMutation({
    mutationFn: (recruiterId: string) =>
      apiRequest(`/admin/recruiters/admin/${recruiterId}/restore`, { method: 'PATCH' }),
  });
}

