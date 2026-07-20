import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, tokenStore } from '../../api/client';
import {
  toCandidateOffer,
  toDocument,
  toOffer,
  toTemplate,
  toTimeline,
  type DocumentRecord,
} from './model';
const rec = (v: unknown) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const array = (v: unknown, key: string) => {
  const x = rec(v);
  return Array.isArray(x[key]) ? (x[key] as unknown[]) : [];
};
const invalidate = (qc: ReturnType<typeof useQueryClient>) =>
  Promise.all([
    qc.invalidateQueries({ queryKey: ['offers'] }),
    qc.invalidateQueries({ queryKey: ['documents'] }),
  ]);
export const useManagedOffers = (q = 'page=1&limit=20', enabled = true) =>
  useQuery({
    queryKey: ['offers', 'managed', q],
    enabled,
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/offers/manage?${q}`);
      const x = rec(v),
        p = rec(x.pagination);
      return {
        items: array(v, 'offers').map(toOffer),
        page: Number(p.page ?? 1),
        pages: Number(p.pages ?? p.totalPages ?? 1),
        total: Number(p.total ?? 0),
      };
    },
  });
export const useManagedOffer = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['offers', 'managed', id],
    enabled: enabled && Boolean(id),
    queryFn: async () =>
      toOffer(rec(await apiRequest<unknown>(`/offers/manage/${id}`)).offer),
  });
export const useOfferHistory = (id: string, enabled = true) =>
  useQuery({
    queryKey: ['offers', 'history', id],
    enabled: enabled && Boolean(id),
    queryFn: async () =>
      array(
        await apiRequest<unknown>(`/offers/manage/${id}/history`),
        'offers',
      ).map(toOffer),
  });
export const useCandidateOffers = () =>
  useQuery({
    queryKey: ['offers', 'candidate'],
    queryFn: async () =>
      array(await apiRequest<unknown>('/offers/me'), 'offers').map(
        toCandidateOffer,
      ),
  });
export const useCandidateOffer = (id: string) =>
  useQuery({
    queryKey: ['offers', 'candidate', id],
    queryFn: async () =>
      toCandidateOffer(
        rec(await apiRequest<unknown>(`/offers/me/${id}`)).offer,
      ),
  });
export const useCandidateTimeline = (id: string) =>
  useQuery({
    queryKey: ['offers', 'timeline', id],
    queryFn: async () =>
      toTimeline(
        rec(await apiRequest<unknown>(`/offers/me/${id}/timeline`)).timeline,
      ),
  });
export const useTemplates = (enabled = true) =>
  useQuery({
    queryKey: ['offers', 'templates'],
    enabled,
    queryFn: async () =>
      array(
        await apiRequest<unknown>('/offers/templates?page=1&limit=50'),
        'templates',
      ).map(toTemplate),
  });
export const useTemplate = (id: string) =>
  useQuery({
    queryKey: ['offers', 'template', id],
    queryFn: async () =>
      toTemplate(
        rec(await apiRequest<unknown>(`/offers/templates/${id}`)).template,
      ),
  });
export const useApprovals = (enabled = true) =>
  useQuery({
    queryKey: ['offers', 'approvals'],
    enabled,
    queryFn: async () =>
      array(await apiRequest<unknown>('/offers/approvals'), 'offers').map(
        toOffer,
      ),
  });
export const useApproval = (id: string) =>
  useQuery({
    queryKey: ['offers', 'approval', id],
    queryFn: async () =>
      toOffer(rec(await apiRequest<unknown>(`/offers/approvals/${id}`)).offer),
  });
export function useOfferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      path,
      method = 'PATCH',
      body,
    }: {
      path: string;
      method?: 'POST' | 'PATCH' | 'DELETE';
      body?: unknown;
    }) => apiRequest<unknown>(path, { method, body }),
    onSuccess: () => invalidate(qc),
  });
}
export const useDocuments = (q = 'page=1&limit=20') =>
  useQuery({
    queryKey: ['documents', 'mine', q],
    queryFn: async () => {
      const v = await apiRequest<unknown>(`/documents?${q}`);
      const x = rec(v),
        p = rec(x.pagination);
      return {
        items: array(v, 'documents').map(toDocument),
        page: Number(p.page ?? 1),
        pages: Number(p.pages ?? p.totalPages ?? 1),
        total: Number(p.total ?? 0),
      };
    },
  });
export const useOfferDocuments = (
  id: string,
  recruiter: boolean,
  enabled = true,
) =>
  useQuery({
    queryKey: ['documents', 'offer', id, recruiter],
    enabled,
    queryFn: async () =>
      array(
        await apiRequest<unknown>(
          `/documents/${recruiter ? 'manage/' : ''}offers/${id}`,
        ),
        'documents',
      ).map(toDocument),
  });
export const useDocument = (id: string) =>
  useQuery({
    queryKey: ['documents', 'mine', id],
    queryFn: async () =>
      toDocument(rec(await apiRequest<unknown>(`/documents/${id}`)).document),
  });
export const useApplicationDocuments = (applicationId: string) =>
  useQuery({
    queryKey: ['documents', 'application', applicationId],
    queryFn: async () =>
      array(
        await apiRequest<unknown>(`/documents/applications/${applicationId}`),
        'documents',
      ).map(toDocument),
  });
export const useVerificationQueue = (q = 'page=1&limit=20', enabled = true) =>
  useQuery({
    queryKey: ['documents', 'verification', q],
    enabled,
    queryFn: async () => {
      const v = await apiRequest<unknown>(
        `/documents/manage/verification?${q}`,
      );
      const x = rec(v),
        p = rec(x.pagination);
      return {
        items: array(v, 'documents').map(toDocument),
        page: Number(p.page ?? 1),
        pages: Number(p.pages ?? p.totalPages ?? 1),
        total: Number(p.total ?? 0),
      };
    },
  });
export const useVerification = (id: string) =>
  useQuery({
    queryKey: ['documents', 'verification', id],
    queryFn: async () =>
      toDocument(
        rec(await apiRequest<unknown>(`/documents/manage/verification/${id}`))
          .document,
      ),
  });
export function useDocumentMutation() {
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
    }) => apiRequest<unknown>(path, { method, body }),
    onSuccess: () => invalidate(qc),
  });
}
export async function safeDownload(path: string) {
  const v = await apiRequest<unknown>(path);
  const url = rec(v).url;
  if (typeof url !== 'string' || !/^https?:\/\//.test(url))
    throw new Error('A secure download is not available.');
  window.open(url, '_blank', 'noopener,noreferrer');
}
export interface UploadSession {
  id: string;
  maximumBytes: number;
  allowedMimeTypes: string[];
  expiresAt: string;
}
export async function createUploadSession(input: {
  category: string;
  entityType: string;
  entityId?: string | undefined;
  purpose: string;
}): Promise<UploadSession> {
  const v = await apiRequest<unknown>('/documents/upload-session', {
    method: 'POST',
    body: input,
  });
  const s = rec(rec(v).uploadSession);
  return {
    id: String(s.id),
    maximumBytes: Number(s.maximumBytes),
    allowedMimeTypes: Array.isArray(s.allowedMimeTypes)
      ? s.allowedMimeTypes.filter((x): x is string => typeof x === 'string')
      : [],
    expiresAt: String(s.expiresAt),
  };
}
export function xhrUpload(
  path: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (n: number) => void,
): Promise<DocumentRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(),
      data = new FormData();
    Object.entries(fields).forEach(([k, v]) => data.append(k, v));
    data.append('file', file);
    xhr.open(
      'POST',
      `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1'}${path}`,
    );
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () =>
      reject(new Error('Upload failed. Check your connection and retry.'));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = 'Upload failed.';
        try {
          const body = JSON.parse(xhr.responseText) as { message?: unknown };
          if (typeof body.message === 'string') message = body.message;
        } catch {
          /* safe generic error */
        }
        return reject(new Error(message));
      }
      try {
        const raw = JSON.parse(xhr.responseText) as {
          data?: { document?: unknown };
        };
        resolve(toDocument(raw.data?.document));
      } catch {
        reject(new Error('Upload completed with an invalid response.'));
      }
    };
    xhr.send(data);
  });
}
