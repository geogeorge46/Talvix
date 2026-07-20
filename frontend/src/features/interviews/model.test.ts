import { describe, expect, it } from 'vitest';
import {
  candidatePrivateKeys,
  formatZoned,
  toCandidateProcess,
  validateSlots,
} from './model';
describe('interview privacy and time contracts', () => {
  it('allowlists candidate data and gates feedback release', () => {
    const raw = {
      _id: 'p1',
      status: 'active',
      feedbackReleased: false,
      company: 'secret',
      rounds: [
        {
          _id: 'r1',
          name: 'Screen',
          type: 'screening',
          status: 'scheduled',
          order: 0,
          interviewers: ['private'],
          interviewerInstructions: 'private',
          schedule: {
            _id: 's1',
            timezone: 'Asia/Kolkata',
            startTime: '2030-01-01T04:30:00.000Z',
            endTime: '2030-01-01T05:00:00.000Z',
            meetingPassword: 'private',
          },
          feedback: [
            { candidateVisibleFeedback: 'hidden', privateNotes: 'private' },
          ],
        },
      ],
    };
    const safe = toCandidateProcess(raw);
    expect(safe.rounds[0]?.feedback).toEqual([]);
    expect(JSON.stringify(safe)).not.toContain('private');
    expect(candidatePrivateKeys).toContain('interviewerInstructions');
  });
  it('labels consequential times with the IANA zone', () =>
    expect(formatZoned('2030-01-01T04:30:00.000Z', 'Asia/Kolkata')).toContain(
      '(Asia/Kolkata)',
    ));
  it('rejects overlap and inverted slots', () => {
    expect(
      validateSlots([
        { startTime: '2030-01-01T10:00', endTime: '2030-01-01T11:00' },
        { startTime: '2030-01-01T10:30', endTime: '2030-01-01T12:00' },
      ]),
    ).toContain('overlap');
    expect(
      validateSlots([
        { startTime: '2030-01-01T11:00', endTime: '2030-01-01T10:00' },
      ]),
    ).toContain('follow');
  });
});
