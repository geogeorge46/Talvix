import {
  RECRUITER_PERMISSIONS,
  type RecruiterPermission,
} from '../../auth/types';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const optionalText = (value: unknown) =>
  typeof value === 'string' ? value : undefined;
const id = (value: unknown) =>
  text(value) || text(record(value)._id) || text(record(value).id);
const safeUrl = (value: unknown) => optionalText(record(value).url);

export interface TeamMember {
  id: string;
  recruiterId: string;
  fullName: string;
  email: string;
  accountRole: string;
  avatarUrl?: string | undefined;
  role: string;
  permissions: RecruiterPermission[];
  joinedAt?: string | undefined;
  status: 'active' | 'removed';
}
export interface CompanyView {
  id: string;
  name: string;
  slug: string;
  description: string;
  website?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  industry?: string | undefined;
  companySize?: string | undefined;
  foundedYear?: number | undefined;
  headquarters?: Location | undefined;
  locations: Location[];
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  socialLinks: Record<string, string>;
  benefits: string[];
  technologies: string[];
  verificationStatus: string;
  isActive: boolean;
  officialEmailDomain?: string | undefined;
  autoApproveDomainMembers?: boolean | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  team: TeamMember[];
}
export interface Location {
  city?: string | undefined;
  state?: string | undefined;
  country?: string | undefined;
}

export const knownPermissions = [...RECRUITER_PERMISSIONS];
export const COMPANY_SIZES = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5000+',
] as const;
export const toCompany = (input: unknown, includeTeam = false): CompanyView => {
  const x = record(input);
  const location = (v: unknown): Location => {
    const l = record(v);
    return {
      city: optionalText(l.city),
      state: optionalText(l.state),
      country: optionalText(l.country),
    };
  };
  const teamRaw = Array.isArray(x.teamMembers)
    ? x.teamMembers
    : Array.isArray(x.team)
      ? x.team
      : [];
  return {
    id: id(x._id ?? x.id),
    name: text(x.name),
    slug: text(x.slug),
    description: text(x.description),
    website: optionalText(x.website),
    email: optionalText(x.email),
    phone: optionalText(x.phone),
    industry: optionalText(x.industry),
    companySize: optionalText(x.companySize),
    foundedYear: typeof x.foundedYear === 'number' ? x.foundedYear : undefined,
    headquarters: x.headquarters ? location(x.headquarters) : undefined,
    locations: Array.isArray(x.locations) ? x.locations.map(location) : [],
    logoUrl: safeUrl(x.logo),
    bannerUrl: safeUrl(x.banner),
    socialLinks: Object.fromEntries(
      Object.entries(record(x.socialLinks)).filter(
        ([, v]) => typeof v === 'string',
      ),
    ) as Record<string, string>,
    benefits: Array.isArray(x.benefits)
      ? x.benefits.filter((v): v is string => typeof v === 'string')
      : [],
    technologies: Array.isArray(x.technologies)
      ? x.technologies.filter((v): v is string => typeof v === 'string')
      : [],
    verificationStatus: text(x.verificationStatus) || 'pending',
    isActive: x.isActive !== false,
    officialEmailDomain: optionalText(x.officialEmailDomain),
    autoApproveDomainMembers: x.autoApproveDomainMembers === true,
    createdAt: optionalText(x.createdAt),
    updatedAt: optionalText(x.updatedAt),
    team: includeTeam
      ? teamRaw.map((raw): TeamMember => {
          const m = record(raw),
            recruiter = record(m.recruiter);
          return {
            id: id(m._id ?? m.id),
            recruiterId: id(m.recruiter),
            fullName: text(recruiter.fullName),
            email: text(recruiter.email),
            accountRole: text(recruiter.role),
            avatarUrl:
              safeUrl(recruiter.avatar) ?? optionalText(recruiter.avatar),
            role: text(m.role) || 'recruiter',
            permissions: (Array.isArray(m.permissions)
              ? m.permissions
              : []
            ).filter(
              (p): p is RecruiterPermission =>
                typeof p === 'string' &&
                RECRUITER_PERMISSIONS.includes(p as RecruiterPermission),
            ),
            joinedAt: optionalText(m.joinedAt),
            status: m.status === 'removed' ? 'removed' : 'active',
          };
        })
      : [],
  };
};

export interface CompanyDraft {
  name: string;
  description: string;
  website: string;
  email: string;
  phone: string;
  industry: string;
  companySize: string;
  foundedYear: string;
  headquartersCity: string;
  headquartersState: string;
  headquartersCountry: string;
  logoUrl: string;
  bannerUrl: string;
  benefits: string;
  technologies: string;
  locations: string;
  linkedin: string;
  twitter: string;
  github: string;
  facebook: string;
  officialEmailDomain: string;
  autoApproveDomainMembers: boolean;
}
export const emptyCompanyDraft: CompanyDraft = {
  name: '',
  description: '',
  website: '',
  email: '',
  phone: '',
  industry: '',
  companySize: '',
  foundedYear: '',
  headquartersCity: '',
  headquartersState: '',
  headquartersCountry: '',
  logoUrl: '',
  bannerUrl: '',
  benefits: '',
  technologies: '',
  locations: '',
  linkedin: '',
  twitter: '',
  github: '',
  facebook: '',
  officialEmailDomain: '',
  autoApproveDomainMembers: false,
};
export const companyToDraft = (c: CompanyView): CompanyDraft => ({
  name: c.name,
  description: c.description,
  website: c.website ?? '',
  email: c.email ?? '',
  phone: c.phone ?? '',
  industry: c.industry ?? '',
  companySize: c.companySize ?? '',
  foundedYear: c.foundedYear?.toString() ?? '',
  headquartersCity: c.headquarters?.city ?? '',
  headquartersState: c.headquarters?.state ?? '',
  headquartersCountry: c.headquarters?.country ?? '',
  logoUrl: c.logoUrl ?? '',
  bannerUrl: c.bannerUrl ?? '',
  benefits: c.benefits.join('\n'),
  technologies: c.technologies.join(', '),
  locations: c.locations
    .map((location) =>
      [location.city, location.state, location.country]
        .filter(Boolean)
        .join(' | '),
    )
    .join('\n'),
  linkedin: c.socialLinks.linkedin ?? '',
  twitter: c.socialLinks.twitter ?? '',
  github: c.socialLinks.github ?? '',
  facebook: c.socialLinks.facebook ?? '',
  officialEmailDomain: c.officialEmailDomain ?? '',
  autoApproveDomainMembers: c.autoApproveDomainMembers ?? false,
});
export const serializeCompany = (d: CompanyDraft) => {
  if (
    d.companySize &&
    !COMPANY_SIZES.includes(d.companySize as (typeof COMPANY_SIZES)[number])
  )
    throw new Error('Unsupported company size');
  return Object.fromEntries(
    Object.entries({
      name: d.name.trim(),
      description: d.description.trim() || undefined,
      website: d.website.trim() || undefined,
      email: d.email.trim() || undefined,
      phone: d.phone.trim() || undefined,
      industry: d.industry.trim() || undefined,
      companySize: d.companySize || undefined,
      foundedYear: d.foundedYear ? Number(d.foundedYear) : undefined,
      headquarters:
        d.headquartersCity || d.headquartersState || d.headquartersCountry
          ? {
              city: d.headquartersCity || undefined,
              state: d.headquartersState || undefined,
              country: d.headquartersCountry || undefined,
            }
          : undefined,
      logo: d.logoUrl ? { url: d.logoUrl } : undefined,
      banner: d.bannerUrl ? { url: d.bannerUrl } : undefined,
      benefits: d.benefits
        .split('\n')
        .map((v) => v.trim())
        .filter(Boolean),
      technologies: d.technologies
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      locations: d.locations
        .split('\n')
        .map((line) => {
          const [city, state, country] = line
            .split('|')
            .map((value) => value.trim());
          return {
            city: city || undefined,
            state: state || undefined,
            country: country || undefined,
          };
        })
        .filter(
          (location) => location.city || location.state || location.country,
        ),
      socialLinks:
        d.linkedin || d.twitter || d.github || d.facebook
          ? {
              linkedin: d.linkedin || undefined,
              twitter: d.twitter || undefined,
              github: d.github || undefined,
              facebook: d.facebook || undefined,
            }
          : undefined,
      officialEmailDomain: d.officialEmailDomain.trim() || undefined,
      autoApproveDomainMembers: d.autoApproveDomainMembers,
    }).filter(([, v]) => v !== undefined),
  );
};
