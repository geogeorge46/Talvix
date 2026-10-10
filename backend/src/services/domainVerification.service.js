import crypto from 'crypto';
import dns from 'dns';
import { Company } from '../models/Company.js';
import { CompanyMember } from '../models/CompanyMember.js';
import { DomainVerificationChallenge } from '../models/DomainVerificationChallenge.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';

const CHALLENGE_EXPIRY_HOURS = 24;

const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'mail.com',
  'zoho.com',
  'gmx.com',
  'yandex.com',
  'live.com',
  'rediffmail.com',
]);

/**
 * Safely normalizes and validates domain input.
 */
export const normalizeAndValidateDomain = (inputDomain) => {
  if (!inputDomain || typeof inputDomain !== 'string') {
    throw new AppError('Valid corporate domain is required', 400);
  }

  let cleaned = inputDomain.trim().toLowerCase();

  // Strip scheme if provided
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  // Strip trailing slashes, paths, query params, ports
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].split(':')[0];
  // Strip leading www.
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4);
  }

  // Validate format
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-2]{2,}$/i;
  if (!domainRegex.test(cleaned)) {
    throw new AppError('Invalid domain format. Please provide a valid domain name (e.g. company.com)', 400);
  }

  // Reject free email providers
  if (FREE_EMAIL_PROVIDERS.has(cleaned)) {
    throw new AppError('Public free email providers cannot be verified as corporate domains', 400);
  }

  return cleaned;
};

const hashChallenge = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Checks whether user has company admin / management permissions.
 */
const assertCompanyAdminPermission = async (company, userId) => {
  if (String(company.owner) === String(userId)) {
    return true;
  }

  const member = await CompanyMember.findOne({
    company: company._id || company.id,
    recruiter: userId,
    status: 'active',
  });

  if (!member || !['primary_admin', 'hr_admin', 'owner'].includes(member.role)) {
    throw new AppError('Forbidden: Only company owners or primary administrators can manage domain verification', 403);
  }

  return true;
};

/**
 * Generates a DNS TXT domain verification challenge.
 */
export const createDomainVerificationChallenge = async (companyId, userId, domainInput, ipAddress = 'Unknown', userAgent = 'Unknown') => {
  const company = await Company.findById(companyId);
  if (!company || !company.isActive) {
    throw new AppError('Company not found or inactive', 404);
  }

  await assertCompanyAdminPermission(company, userId);

  const domain = normalizeAndValidateDomain(domainInput);

  // Check domain uniqueness: ensure another company does not already have this domain verified
  const existingVerifiedCompany = await Company.findOne({
    officialEmailDomain: domain,
    domainVerified: true,
    _id: { $ne: company._id },
  });

  if (existingVerifiedCompany) {
    throw new AppError('This corporate domain is already verified for another company', 409);
  }

  // Generate cryptographically secure token
  const rawToken = crypto.randomBytes(32).toString('hex');
  const challengeHash = hashChallenge(rawToken);
  const txtRecordName = `_talvix-verification.${domain}`;
  const txtRecordValue = `talvix-domain-verification=${rawToken}`;
  const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRY_HOURS * 60 * 60 * 1000);

  // Invalidate previous pending challenges for this company & domain
  await DomainVerificationChallenge.updateMany(
    { companyId: company._id, status: 'pending' },
    { $set: { status: 'expired' } },
  );

  const challenge = await DomainVerificationChallenge.create({
    companyId: company._id,
    requestedBy: userId,
    domain,
    challengeHash,
    txtRecordName,
    txtRecordValue,
    expiresAt,
  });

  // Store domain on company object if not already set
  company.officialEmailDomain = domain;
  await company.save();

  await AuditLog.create({
    action: 'company.domain_challenge_created',
    actor: userId,
    company: company._id,
    newValue: { domain, txtRecordName, txtRecordValue, expiresAt },
    ipAddress,
    userAgent,
  });

  return {
    challengeId: challenge._id,
    domain,
    txtRecordName,
    txtRecordValue,
    expiresAt,
    instructions: `Add a DNS TXT record for "${txtRecordName}" with value "${txtRecordValue}".`,
  };
};

/**
 * Resolves DNS TXT records with custom resolver injection support for unit testing.
 */
export const defaultDnsTxtResolver = async (hostname) => {
  try {
    const records = await dns.promises.resolveTxt(hostname);
    // Flatten array of array strings returned by node dns module
    return records.map((r) => r.join(''));
  } catch (err) {
    return [];
  }
};

/**
 * Confirms domain verification challenge against DNS TXT records.
 */
export const confirmDomainVerification = async (
  companyId,
  userId,
  dnsResolver = defaultDnsTxtResolver,
  ipAddress = 'Unknown',
  userAgent = 'Unknown',
) => {
  const company = await Company.findById(companyId);
  if (!company || !company.isActive) {
    throw new AppError('Company not found or inactive', 404);
  }

  await assertCompanyAdminPermission(company, userId);

  // If already verified, return idempotent status
  if (company.domainVerified && company.officialEmailDomain) {
    return {
      status: 'verified',
      domain: company.officialEmailDomain,
      domainVerified: true,
      domainVerifiedAt: company.domainVerifiedAt,
      message: 'Company corporate domain is already verified',
    };
  }

  const activeChallenge = await DomainVerificationChallenge.findOne({
    companyId: company._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!activeChallenge) {
    throw new AppError('No active domain verification challenge found. Please initiate a domain challenge first.', 404);
  }

  // Resolve DNS TXT records
  const txtRecords = await dnsResolver(activeChallenge.txtRecordName);

  const matched = txtRecords.some((val) => val.trim() === activeChallenge.txtRecordValue.trim());

  if (!matched) {
    return {
      status: 'pending',
      domainVerified: false,
      domain: activeChallenge.domain,
      txtRecordName: activeChallenge.txtRecordName,
      txtRecordValue: activeChallenge.txtRecordValue,
      message: `DNS TXT record not found or propagation in progress for ${activeChallenge.txtRecordName}. Expected: ${activeChallenge.txtRecordValue}`,
    };
  }

  // Check domain uniqueness one final time before completing
  const conflict = await Company.findOne({
    officialEmailDomain: activeChallenge.domain,
    domainVerified: true,
    _id: { $ne: company._id },
  });

  if (conflict) {
    throw new AppError('Domain conflict detected: This domain was verified by another company while your challenge was pending', 409);
  }

  // Update challenge & company
  activeChallenge.status = 'verified';
  activeChallenge.verifiedAt = new Date();
  await activeChallenge.save();

  company.domainVerified = true;
  company.domainVerifiedAt = new Date();
  company.officialEmailDomain = activeChallenge.domain;
  await company.save();

  await AuditLog.create({
    action: 'company.domain_verified',
    actor: userId,
    company: company._id,
    newValue: { domain: activeChallenge.domain, verifiedAt: company.domainVerifiedAt },
    ipAddress,
    userAgent,
  });

  return {
    status: 'verified',
    domain: company.officialEmailDomain,
    domainVerified: true,
    domainVerifiedAt: company.domainVerifiedAt,
    message: 'Corporate domain verified successfully!',
  };
};

/**
 * Returns current domain verification status for a company.
 */
export const getDomainVerificationStatus = async (companyId) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const activeChallenge = await DomainVerificationChallenge.findOne({
    companyId: company._id,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  return {
    officialEmailDomain: company.officialEmailDomain || null,
    domainVerified: Boolean(company.domainVerified),
    domainVerifiedAt: company.domainVerifiedAt || null,
    activeChallenge: activeChallenge
      ? {
          challengeId: activeChallenge._id,
          domain: activeChallenge.domain,
          txtRecordName: activeChallenge.txtRecordName,
          txtRecordValue: activeChallenge.txtRecordValue,
          expiresAt: activeChallenge.expiresAt,
        }
      : null,
  };
};
