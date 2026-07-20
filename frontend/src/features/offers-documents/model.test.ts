import { describe, expect, it } from 'vitest';
import {
  activeCandidateActions,
  toCandidateOffer,
  toDocument,
  toOffer,
  toTimeline,
} from './model';

describe('Phase 10 safe view models', () => {
  const offer = {
    _id: '1'.repeat(24),
    title: 'Engineer',
    status: 'sent',
    candidateSnapshot: {
      fullName: 'A Candidate',
      email: 'private@example.com',
    },
    compensation: {
      currency: 'INR',
      period: 'annual',
      base: 100,
      confidential: true,
    },
    approval: { privateNotes: 'secret' },
    createdBy: 'actor',
    document: { url: 'https://signed.example', publicId: 'provider-id' },
  };
  it('allowlists candidate offer fields and excludes private approval material', () => {
    const safe = toCandidateOffer(offer);
    expect(safe).toMatchObject({
      title: 'Engineer',
      candidateName: 'A Candidate',
      status: 'sent',
    });
    expect(safe).not.toHaveProperty('approval');
    expect(safe).not.toHaveProperty('createdBy');
    expect(JSON.stringify(safe)).not.toContain('private@example.com');
  });
  it('does not retain signed URLs or provider identifiers', () => {
    const safe = JSON.stringify(toCandidateOffer(offer));
    expect(safe).not.toContain('signed.example');
    expect(safe).not.toContain('provider-id');
  });
  it.each([
    'expired',
    'withdrawn',
    'superseded',
    'accepted',
    'declined',
  ] as const)('disables candidate decisions for %s offers', (status) =>
    expect(activeCandidateActions(status)).toBe(false),
  );
  it.each(['sent', 'viewed', 'revised'] as const)(
    'enables candidate decisions for %s offers',
    (status) => expect(activeCandidateActions(status)).toBe(true),
  );
  it('maps current revision and terms without spreading raw data', () =>
    expect(toOffer({ ...offer, revision: 3, terms: ['Term'] })).toMatchObject({
      revisionNumber: 3,
      terms: ['Term'],
    }));
  it('exposes only candidate-safe verification reason', () => {
    const safe = toDocument({
      id: '2'.repeat(24),
      verification: {
        required: true,
        status: 'rejected',
        reason: 'Replace the scan',
        privateNotes: 'fraud concern',
      },
      storage: { publicId: 'secret' },
    });
    expect(safe.verification.reason).toBe('Replace the scan');
    expect(JSON.stringify(safe)).not.toContain('fraud concern');
    expect(JSON.stringify(safe)).not.toContain('publicId');
  });
  it('filters private timeline states', () =>
    expect(
      toTimeline([
        { status: 'sent', changedAt: '2026-01-01' },
        { status: 'internal-review', changedAt: '2026-01-02' },
      ]),
    ).toEqual([{ status: 'sent', changedAt: '2026-01-01' }]));
});
