import { describe, expect, it } from 'vitest';
import {
  allowedActions,
  emptyDraft,
  serializeDraft,
  statusMeta,
  toDraft,
  toJob,
} from './model';

describe('job management model', () => {
  it('whitelists DTO fields and safely maps unknown statuses', () => {
    const job = toJob({
      _id: 'abc',
      title: 'Designer',
      description: 'Build',
      status: 'future-state',
      privateNotes: 'secret',
      reviewedBy: 'opaque',
      applicationsCount: '12',
      location: { city: 'Pune' },
    });
    expect(job).toMatchObject({
      id: 'abc',
      title: 'Designer',
      status: 'unknown',
      applicationsCount: 0,
      location: 'Pune',
    });
    expect(job).not.toHaveProperty('privateNotes');
    expect(job).not.toHaveProperty('reviewedBy');
    expect(statusMeta(job.status)[0]).toBe('Unknown status');
  });
  it('exposes exact recruiter lifecycle actions without publish', () => {
    const p = ['jobs.update', 'jobs.publish', 'jobs.delete'];
    expect(allowedActions('draft', p, true)).toEqual({
      edit: true,
      submit: true,
      pause: false,
      resume: false,
      close: false,
      archive: true,
    });
    expect(allowedActions('published', p, true)).toEqual({
      edit: false,
      submit: false,
      pause: true,
      resume: false,
      close: true,
      archive: false,
    });
    expect(allowedActions('paused', p, false).resume).toBe(false);
    expect(allowedActions('unknown', p, true)).toEqual({
      edit: false,
      submit: false,
      pause: false,
      resume: false,
      close: false,
      archive: false,
    });
  });
  it('serializes exact schema fields and omits empty optional objects', () => {
    const payload = serializeDraft({
      ...emptyDraft,
      title: 'Engineer',
      description: 'Build systems',
      employmentType: 'full-time',
      workMode: 'remote',
      responsibilities: 'Own APIs\n\nReview code',
    });
    expect(payload).toMatchObject({
      title: 'Engineer',
      responsibilities: ['Own APIs', 'Review code'],
      skills: [],
      applicationQuestions: [],
    });
    expect(payload).not.toHaveProperty('location');
    expect(payload).not.toHaveProperty('salary');
  });
  it('round-trips nested editable detail fields', () => {
    const view = toJob({
      _id: '1',
      title: 'Engineer',
      description: 'Build',
      status: 'draft',
      employmentType: 'full-time',
      workMode: 'hybrid',
      location: { city: 'Pune', state: 'MH', country: 'IN' },
      salary: {
        minimum: 10,
        maximum: 20,
        currency: 'INR',
        period: 'monthly',
        isVisible: false,
      },
      minimumExperience: 2,
      maximumExperience: 5,
      openings: 3,
      applicationDeadline: '2030-01-02T00:00:00.000Z',
      responsibilities: ['Own'],
      requirements: ['TypeScript'],
      preferredQualifications: ['SaaS'],
      educationRequirements: ['BS'],
      assessmentRequired: true,
      resumeRequired: false,
      minimumProfileCompletion: 80,
      skills: [
        {
          name: 'React',
          required: true,
          minimumProficiency: 'advanced',
          minimumYearsOfExperience: 3,
          weight: 90,
        },
      ],
      applicationQuestions: [
        {
          question: 'Why?',
          type: 'single-choice',
          required: true,
          options: ['A', 'B'],
        },
      ],
    });
    expect(serializeDraft(toDraft(view))).toMatchObject({
      location: { city: 'Pune', state: 'MH', country: 'IN' },
      salary: {
        minimum: 10,
        maximum: 20,
        currency: 'INR',
        period: 'monthly',
        isVisible: false,
      },
      minimumExperience: 2,
      maximumExperience: 5,
      openings: 3,
      responsibilities: ['Own'],
      assessmentRequired: true,
      resumeRequired: false,
      minimumProfileCompletion: 80,
      skills: [{ name: 'React', weight: 90 }],
      applicationQuestions: [{ question: 'Why?', options: ['A', 'B'] }],
    });
  });
});
