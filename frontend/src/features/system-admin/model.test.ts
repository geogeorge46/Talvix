import { describe, expect, it } from 'vitest';
import { collectionFrom, compactQuery, detailFrom, sanitizeRecord } from './model';

describe('system admin response adapters', () => {
  it('preserves backend pagination and named collections', () => {
    expect(collectionFrom({
      applications: [{ _id: 'a', status: 'submitted' }],
      pagination: { page: 2, limit: 10, total: 31, pages: 4 },
    })).toEqual({
      rows: [{ _id: 'a', status: 'submitted' }],
      meta: { page: 2, limit: 10, total: 31, pages: 4 },
    });
  });

  it('removes private assessment and provider fields from records', () => {
    expect(sanitizeRecord({
      _id: 'safe',
      answers: ['secret'],
      hiddenTests: ['secret'],
      providerMetadata: { key: 'secret' },
      checksum: 'secret',
      status: 'active',
    })).toEqual({ _id: 'safe', status: 'active' });
  });

  it('unwraps detail envelopes and deeply removes private fields', () => {
    expect(detailFrom({ attempt: {
      _id: 'safe',
      status: 'submitted',
      answers: [{ answer: 'secret' }],
      document: { displayName: 'Resume', signedUrl: 'secret' },
    } })).toEqual({
      _id: 'safe',
      status: 'submitted',
      document: { displayName: 'Resume' },
    });
  });

  it('omits blank query parameters', () => {
    expect(compactQuery({ page: 1, status: '', company: undefined }))
      .toBe('?page=1');
  });
});
