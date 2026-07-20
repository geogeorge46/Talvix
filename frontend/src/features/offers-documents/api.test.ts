import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUploadSession, safeDownload } from './api';
import { useCandidateOffer } from './api';
import { tokenStore } from '../../api/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
describe('Phase 10 secure transport boundaries', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.restoreAllMocks();
  });
  it('uses server-provided upload constraints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              uploadSession: {
                id: '1'.repeat(24),
                maximumBytes: 4096,
                allowedMimeTypes: ['application/pdf'],
                expiresAt: '2026-01-01',
              },
            },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    await expect(
      createUploadSession({
        category: 'other',
        entityType: 'user',
        purpose: 'Resume',
      }),
    ).resolves.toMatchObject({
      maximumBytes: 4096,
      allowedMimeTypes: ['application/pdf'],
    });
  });
  it('opens a signed URL only at download time without returning it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              url: 'https://private.example/download?token=secret',
              expiresAt: 'soon',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    await expect(
      safeDownload('/documents/abc/download'),
    ).resolves.toBeUndefined();
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('private.example'),
      '_blank',
      'noopener,noreferrer',
    );
  });
  it('rejects unsafe download schemes', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { url: 'javascript:alert(1)' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );
    await expect(safeDownload('/documents/abc/download')).rejects.toThrow(
      /secure download/i,
    );
  });
  it('stores only allowlisted candidate data in the query cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              offer: {
                _id: '1'.repeat(24),
                title: 'Safe role',
                status: 'sent',
                approval: { privateNotes: 'secret' },
                document: { url: 'https://signed.example' },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      wrapper = ({ children }: { children: ReactNode }) =>
        createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useCandidateOffer('1'.repeat(24)), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = JSON.stringify(
      client.getQueryData(['offers', 'candidate', '1'.repeat(24)]),
    );
    expect(cached).not.toContain('privateNotes');
    expect(cached).not.toContain('signed.example');
  });
});
