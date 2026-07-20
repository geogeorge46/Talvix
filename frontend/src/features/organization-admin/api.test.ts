import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { companyKey, loadCompany, saveCompany } from './api';
import { emptyCompanyDraft } from './model';

describe('organization query privacy boundary', () => {
  afterEach(() => vi.unstubAllGlobals());
  const payload = {
    data: {
      company: {
        _id: '1'.repeat(24),
        name: 'Talvix',
        verificationStatus: 'verified',
        verificationNotes: 'PRIVATE_SENTINEL',
        verifiedBy: 'ADMIN_SENTINEL',
        logo: {
          url: 'https://example.com/logo',
          publicId: 'PROVIDER_SENTINEL',
        },
        teamMembers: [
          {
            _id: '2'.repeat(24),
            recruiter: {
              _id: '3'.repeat(24),
              fullName: 'Rae',
              email: 'MEMBER_SENTINEL@example.com',
            },
            role: 'recruiter',
            permissions: ['team.manage'],
            status: 'active',
          },
        ],
      },
    },
  };
  function stub() {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  }
  it('stores only allowlisted profile data in React Query cache', async () => {
    stub();
    const client = new QueryClient();
    await client.fetchQuery({
      queryKey: [...companyKey, 'profile'],
      queryFn: () => loadCompany(false),
    });
    const cached = JSON.stringify(
      client.getQueryData([...companyKey, 'profile']),
    );
    expect(cached).not.toContain('PRIVATE_SENTINEL');
    expect(cached).not.toContain('PROVIDER_SENTINEL');
    expect(cached).not.toContain('MEMBER_SENTINEL');
    expect(cached).not.toContain('verifiedBy');
  });
  it('includes allowlisted member email only for team.manage queries', async () => {
    stub();
    const client = new QueryClient();
    await client.fetchQuery({
      queryKey: [...companyKey, 'team'],
      queryFn: () => loadCompany(true),
    });
    const cached = JSON.stringify(client.getQueryData([...companyKey, 'team']));
    expect(cached).toContain('MEMBER_SENTINEL@example.com');
    expect(cached).not.toContain('PRIVATE_SENTINEL');
    expect(cached).not.toContain('PROVIDER_SENTINEL');
  });
  it.each([
    ['create', 'POST', '/companies'],
    ['edit', 'PATCH', '/companies/me'],
  ] as const)(
    'sends exact company-size enums for %s requests',
    async (mode, method, path) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ data: { company: {} } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );
      await saveCompany(mode, {
        ...emptyCompanyDraft,
        name: 'Talvix',
        companySize: '501-1000',
      });
      const call = vi.mocked(fetch).mock.calls[0];
      expect(String(call?.[0])).toMatch(new RegExp(`${path}$`));
      expect(call?.[1]?.method).toBe(method);
      expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
        name: 'Talvix',
        companySize: '501-1000',
      });
    },
  );
});
