import { describe, expect, it } from 'vitest';
import {
  applicationStatuses,
  toApplicationDetail,
  toApplicationRow,
  toCandidate,
  transitions,
} from './model';
const forbidden = [
  'private@example.test',
  '+91-secret',
  'https://secret-resume',
  'provider-private',
  'salary-secret',
  'actor-private',
  'internal-note',
];
describe('ATS privacy adapters', () => {
  it('allowlists list and submitted evidence fields', () => {
    const raw = {
      _id: 'app1',
      applicationNumber: 'TVX-1',
      candidateProfile: 'profile1',
      candidateSnapshot: {
        fullName: 'Alex Rivera',
        email: forbidden[0],
        phone: forbidden[1],
        skills: [{ name: 'React' }],
        expectedSalary: forbidden[4],
        education: [{ degree: 'BSc', institution: 'Institute' }],
      },
      jobSnapshot: { title: 'Designer' },
      skillMatch: { score: 94, matchedSkills: ['React'] },
      status: 'submitted',
      resumeSnapshot: {
        fileName: 'resume.pdf',
        url: forbidden[2],
        publicId: forbidden[3],
      },
      coverLetter: 'Submitted evidence',
      recruiterNotes: [{ note: forbidden[6] }],
      statusHistory: [
        {
          from: 'submitted',
          to: 'under-review',
          changedBy: forbidden[5],
          reason: 'Reviewed',
        },
      ],
    };
    const serialized = JSON.stringify({
      list: toApplicationRow(raw),
      detail: toApplicationDetail(raw),
    });
    forbidden.forEach((value) => expect(serialized).not.toContain(value));
    expect(toApplicationDetail(raw).resume?.fileName).toBe('resume.pdf');
  });
  it('discards private candidate contact, salary, resume and social data', () => {
    const result = toCandidate({
      _id: 'profile1',
      user: { fullName: 'Sam Chen', email: forbidden[0] },
      phone: forbidden[1],
      expectedSalary: forbidden[4],
      resume: { url: forbidden[2], publicId: forbidden[3] },
      socialLinks: { linkedin: 'https://private' },
      headline: 'Engineer',
      skills: [
        { name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4 },
      ],
    });
    const serialized = JSON.stringify(result);
    forbidden
      .slice(0, 5)
      .forEach((value) => expect(serialized).not.toContain(value));
    expect(result.skills).toEqual(['Node.js']);
  });
  it('maps the backend certification and numeric education field names', () => {
    const detail = toCandidate({
      _id: 'p',
      user: { fullName: 'Candidate' },
      education: [
        {
          degree: 'BSc',
          institution: 'Talvix University',
          startYear: 2019,
          endYear: 2023,
        },
      ],
      certifications: [
        {
          name: 'Accessibility',
          issuingOrganization: 'IAAP',
          issueDate: '2024-01-01',
          expirationDate: '2027-01-01',
        },
      ],
    });
    expect(detail.education[0]?.meta).toBe('2019–2023');
    expect(detail.certifications[0]).toMatchObject({
      subtitle: 'IAAP',
      meta: '2024-01-01 – 2027-01-01',
    });
  });
});
describe('recruiter transition matrix', () => {
  it('is exhaustive and keeps terminal statuses terminal', () => {
    expect(Object.keys(transitions).sort()).toEqual(
      [...applicationStatuses].sort(),
    );
    (['hired', 'rejected', 'withdrawn', 'offer-declined'] as const).forEach(
      (value) => expect(transitions[value]).toEqual([]),
    );
    expect(transitions.submitted).toEqual(['under-review', 'rejected']);
  });
});
