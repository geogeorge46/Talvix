import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStore } from '../../api/client';
import { adminApi, approvalAction, downloadAnalyticsCsv } from './api';
import { APPLICATION_ADMIN_STATUSES } from './model';

describe('system admin API contracts', () => {
  beforeEach(() => {
    tokenStore.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { profile: { _id: 'abc' } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )));
  });

  it('uses the company verify route and PATCH body', async () => {
    const path = approvalAction('companies', '0123456789abcdef01234567', 'approve');
    await adminApi.mutate(path, 'PATCH', { notes: 'Validated registration' });
    expect(path).toBe('/companies/admin/0123456789abcdef01234567/verify');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(path),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ notes: 'Validated registration' }),
      }),
    );
  });

  it('builds UTC analytics requests without blank filters', async () => {
    await adminApi.analytics('health', { preset: '24h', status: '' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/analytics/health?preset=24h'),
      expect.any(Object),
    );
  });

  it('downloads CSV with the in-memory bearer token', async () => {
    tokenStore.set('admin-token');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('metric,value\nusers,3', { status: 200 }));
    await downloadAnalyticsCsv({ report: 'users', format: 'csv', timezone: 'UTC' });
    expect(fetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/admin/analytics/export?report=users&format=csv&timezone=UTC'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }) }),
    );
  });

  it('offers only the exact backend application status enum', () => {
    expect(APPLICATION_ADMIN_STATUSES).toEqual([
      'submitted', 'under-review', 'shortlisted', 'assessment-pending',
      'assessment-in-progress', 'assessment-completed', 'interview-scheduled',
      'interview-completed', 'offer-pending', 'offer-sent', 'offer-accepted',
      'offer-declined', 'hired', 'rejected', 'withdrawn',
    ]);
  });
});
