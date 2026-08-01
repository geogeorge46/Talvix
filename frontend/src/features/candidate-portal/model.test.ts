import { describe, expect, it } from 'vitest';
import {
  candidateModelInternals,
  toCandidateProfile,
  toPublicJob,
  toSafeApplication,
  toSafeNotification,
  toSafeTimeline,
} from './model';

describe('candidate portal privacy adapters', () => {
  it('allowlists candidate profile fields and drops legacy assets and snapshots', () => {
    const profile = toCandidateProfile({
      _id: 'candidate-1',
      headline: 'Product designer',
      profileVisibility: 'public',
      skills: [
        {
          _id: 'skill-1',
          name: 'Research',
          proficiency: 'expert',
          yearsOfExperience: 6,
          privateScore: 99,
        },
      ],
      profilePhoto: { url: 'private', publicId: 'provider-id' },
      resume: { url: 'signed' },
      rawSnapshot: { secret: true },
    });
    expect(profile.headline).toBe('Product designer');
    expect(profile.skills[0]).toEqual({
      id: 'skill-1',
      name: 'Research',
      proficiency: 'expert',
      yearsOfExperience: 6,
    });
    expect(profile).not.toHaveProperty('profilePhoto');
    expect(profile).not.toHaveProperty('resume');
    expect(profile).not.toHaveProperty('rawSnapshot');
  });

  it('removes reasons, scores, notes, changed actors and snapshots from applications', () => {
    const application = toSafeApplication({
      _id: 'a1',
      status: 'under-review',
      reason: 'private',
      score: 92,
      notes: ['private'],
      changedBy: 'internal',
      jobSnapshot: {
        title: 'Designer',
        companyName: 'Acme',
        answers: ['secret'],
      },
    });
    expect(application).toEqual({
      id: 'a1',
      jobId: '',
      jobTitle: 'Designer',
      companyName: 'Acme',
      status: 'under-review',
      appliedAt: undefined,
      updatedAt: undefined,
    });
    expect(application).not.toHaveProperty('reason');
    expect(
      toSafeTimeline({
        from: 'submitted',
        to: 'under-review',
        changedAt: '2026-07-20',
        changedBy: 'r1',
        note: 'private',
      }),
    ).toEqual({
      from: 'submitted',
      to: 'under-review',
      changedAt: '2026-07-20',
    });
  });

  it('never trusts notification action URLs and only builds known candidate targets', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(
      toSafeNotification({
        _id: 'n1',
        type: 'offer.sent',
        title: 'Offer',
        message: 'Ready',
        data: {
          offerId: id,
          actionUrl: 'https://evil.example',
          privateNote: 'x',
        },
      }).target,
    ).toBe(`/candidate/offers/${id}`);
    expect(
      toSafeNotification({
        _id: 'n2',
        type: 'unknown',
        data: { actionUrl: '/admin/users', offerId: id },
      }).target,
    ).toBeUndefined();
    expect(
      candidateModelInternals.safeTarget('offer.sent', {
        offerId: 'not-an-id',
      }),
    ).toBeUndefined();
  });

  it('only exposes safe public job fields', () => {
    const job = toPublicJob({
      _id: 'j1',
      title: 'Engineer',
      company: { name: 'Talvix', internalBilling: true },
      location: { city: 'Pune', country: 'India' },
      description: 'Build things',
      recruiterNotes: 'private',
    });
    expect(job.companyName).toBe('Talvix');
    expect(job.location).toBe('Pune, India');
    expect(job).not.toHaveProperty('recruiterNotes');
  });
});
