import { describe, expect, it } from 'vitest';
import { can } from './api';
import {
  currentWeekRange,
  dashboardDateRange,
  parseDashboardFilters,
  toCandidateViewModel,
  toInterviews,
  toPipeline,
  upcomingDateRange,
} from './model';

describe('organization dashboard privacy adapters', () => {
  it('projects only allowlisted candidate data', () => {
    const result = toCandidateViewModel({
      _id: 'app-1',
      status: 'under-review',
      submittedAt: '2026-07-10T10:00:00.000Z',
      candidateSnapshot: {
        fullName: 'Alex Rivera',
        email: 'private@example.com',
        phone: 'private',
        resumeUrl: 'private',
        skills: [{ name: 'Figma', note: 'private' }, 'Research'],
      },
      jobSnapshot: { title: 'Designer', salary: 'private' },
      skillMatch: {
        score: 94,
        matchedSkills: ['Figma'],
        missingRequiredSkills: ['private'],
      },
      coverLetter: 'private',
      recruiterNotes: ['private'],
      answers: ['private'],
    });
    expect(result).toEqual({
      id: 'app-1',
      name: 'Alex Rivera',
      initials: 'AR',
      role: 'Designer',
      skills: ['Figma', 'Research'],
      matchedSkills: ['Figma'],
      skillMatch: 94,
      stage: 'under-review',
      stageLabel: 'Under Review',
      submittedAt: '2026-07-10T10:00:00.000Z',
    });
    expect(JSON.stringify(result)).not.toMatch(
      /private|email|phone|resume|answer|note/i,
    );
  });

  it('projects safe interview details only', () => {
    const result = toInterviews({
      schedules: [
        {
          _id: 'schedule-1',
          startTime: '2026-07-20T10:00:00Z',
          endTime: '2026-07-20T11:00:00Z',
          mode: 'video',
          status: 'confirmed',
          location: { name: 'Studio', city: 'Pune', address: 'private' },
          meetingUrl: 'secret',
          meetingPassword: 'secret',
          interviewerInstructions: 'secret',
          audit: ['secret'],
        },
      ],
    });
    expect(result).toEqual([
      {
        id: 'schedule-1',
        startTime: '2026-07-20T10:00:00Z',
        endTime: '2026-07-20T11:00:00Z',
        mode: 'video',
        status: 'confirmed',
        place: 'Studio, Pune',
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /meeting|password|instruction|audit|address|secret/i,
    );
  });
});

describe('organization dashboard state policy', () => {
  it('maps only documented statuses into the all-time pipeline', () => {
    expect(
      toPipeline({
        total: 9,
        pipeline: {
          submitted: 3,
          shortlisted: 2,
          'assessment-pending': 1,
          'interview-scheduled': 1,
          'offer-sent': 1,
          hired: 1,
          rejected: 20,
        },
      }).stages,
    ).toEqual([
      { id: 'applied', label: 'Applied', count: 3 },
      { id: 'screening', label: 'Screening', count: 2 },
      { id: 'assessment', label: 'Assessment', count: 1 },
      { id: 'interview', label: 'Interview', count: 1 },
      { id: 'offer', label: 'Offer', count: 1 },
      { id: 'hired', label: 'Hired', count: 1 },
    ]);
  });
  it('sanitizes URL state and builds deterministic UTC bounds', () => {
    expect(
      parseDashboardFilters(
        new URLSearchParams('range=31&stage=secret&page=-2&q=%20hello%20'),
      ),
    ).toEqual({ range: 30, stage: '', page: 1, q: 'hello' });
    expect(
      parseDashboardFilters(new URLSearchParams('range=90&stage=hired&page=3')),
    ).toEqual({ range: 90, stage: 'hired', page: 3, q: '' });
    const now = new Date('2026-07-19T12:30:00.000Z');
    expect(dashboardDateRange(7, now)).toEqual({
      from: '2026-07-12T12:30:00.000Z',
      to: '2026-07-19T12:30:00.000Z',
    });
    expect(currentWeekRange(now)).toEqual({
      from: '2026-07-13T00:00:00.000Z',
      to: '2026-07-19T23:59:59.999Z',
    });
    expect(upcomingDateRange(7, now)).toEqual({
      from: '2026-07-19T12:30:00.000Z',
      to: '2026-07-26T12:30:00.000Z',
    });
  });
  it('gates endpoint capability by exact permission or ownership', () => {
    expect(can(['applications.view'], false, 'applications.view')).toBe(true);
    expect(can([], false, 'applications.view')).toBe(false);
    expect(can([], true, 'applications.view')).toBe(false);
  });
});
