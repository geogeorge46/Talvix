import { describe, expect, it } from 'vitest';
import { emptyCompanyDraft, serializeCompany, toCompany } from './model';

describe('organization administration privacy adapter', () => {
  it('allowlists company and team data before caching', () => {
    const company = toCompany(
      {
        _id: '1'.repeat(24),
        name: 'Talvix Labs',
        verificationStatus: 'pending',
        verificationNotes: 'private admin note',
        verifiedBy: { email: 'admin@example.com' },
        owner: 'secret',
        logo: {
          url: 'https://example.com/logo.png',
          publicId: 'provider-secret',
        },
        teamMembers: [
          {
            _id: '2'.repeat(24),
            recruiter: {
              _id: '3'.repeat(24),
              fullName: 'Rae',
              email: 'rae@example.com',
              role: 'recruiter',
              password: 'secret',
            },
            role: 'owner',
            permissions: ['team.manage', 'made.up'],
            status: 'active',
            internalNote: 'private',
          },
        ],
      },
      true,
    );
    expect(company).toMatchObject({
      name: 'Talvix Labs',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(company.team[0]?.permissions).toEqual(['team.manage']);
    const rendered = JSON.stringify(company);
    expect(rendered).not.toContain('private admin note');
    expect(rendered).not.toContain('provider-secret');
    expect(rendered).not.toContain('verifiedBy');
    expect(rendered).not.toContain('password');
  });

  it('serializes only supported editable company fields', () => {
    const body = serializeCompany({
      name: ' Talvix ',
      description: '',
      website: '',
      email: '',
      phone: '',
      industry: 'Software',
      companySize: '11-50',
      foundedYear: '2024',
      headquartersCity: 'Bengaluru',
      headquartersState: '',
      headquartersCountry: 'India',
      logoUrl: 'https://example.com/logo.png',
      bannerUrl: '',
      benefits: 'Remote\nLearning',
      technologies: 'React, Node',
      locations: 'Mumbai | Maharashtra | India',
      linkedin: 'https://linkedin.com/company/talvix',
      twitter: '',
      github: '',
      facebook: '',
    });
    expect(body).toMatchObject({
      name: 'Talvix',
      industry: 'Software',
      companySize: '11-50',
      foundedYear: 2024,
      headquarters: { city: 'Bengaluru', country: 'India' },
      benefits: ['Remote', 'Learning'],
      technologies: ['React', 'Node'],
      logo: { url: 'https://example.com/logo.png' },
    });
    expect(body).not.toHaveProperty('verificationStatus');
    expect(body).not.toHaveProperty('owner');
  });
  it('rejects company-size values outside the backend enum', () => {
    expect(() =>
      serializeCompany({
        ...emptyCompanyDraft,
        name: 'Talvix',
        companySize: 'small',
      }),
    ).toThrow('Unsupported company size');
  });
});
