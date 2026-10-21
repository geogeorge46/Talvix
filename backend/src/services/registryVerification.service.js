import { Company } from '../models/Company.js';
import { CompanyRegistryCheck } from '../models/CompanyRegistryCheck.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { getRegistryProvider, getProviderForCheckType } from './registryVerification/registryProviderFactory.js';
import { isValidCIN, isValidGSTIN, isValidUdyam, maskIdentifier } from '../utils/formatValidation.js';
import {
  normalizeCompanyName,
  isFuzzyNameMatch,
  compareRegistryRecord
} from './registryVerification/registryMatch.service.js';

export { normalizeCompanyName, isFuzzyNameMatch };

/**
 * Executes an authoritative registry check for a company.
 */
export const runRegistryCheck = async ({
  companyId,
  checkType = 'company_registration',
  providerName,
  options = {},
  actorId
}) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const owner = await User.findById(company.owner);
  const provider = providerName
    ? getRegistryProvider(providerName)
    : getProviderForCheckType(checkType);

  const providerResult = await provider.verifyRegistration({ company, checkType, options });

  const initialRiskIndicators = [];
  let formatRiskScore = 0;

  // 1. Format Validation (Format valid != Registry verified)
  let rawIdentifier = '';
  let identifierType = 'unknown';

  if (checkType === 'company_registration') {
    rawIdentifier = company.cin || '';
    identifierType = company.entityType === 'llp' ? 'llpin' : 'cin';
    if (rawIdentifier && !isValidCIN(rawIdentifier)) {
      initialRiskIndicators.push({
        code: 'FORMAT_INVALID_CIN',
        severity: 'high',
        description: 'Submitted Corporate Identification Number (CIN/LLPIN) format is invalid.'
      });
      formatRiskScore += 25;
    }
  } else if (checkType === 'gst_registration') {
    rawIdentifier = company.gstin || '';
    identifierType = 'gstin';
    if (rawIdentifier && !isValidGSTIN(rawIdentifier)) {
      initialRiskIndicators.push({
        code: 'FORMAT_INVALID_GSTIN',
        severity: 'high',
        description: 'Submitted GSTIN format is invalid.'
      });
      formatRiskScore += 25;
    }
  } else if (checkType === 'msme_registration') {
    rawIdentifier = company.udyamRegistrationNumber || '';
    identifierType = 'udyam';
    if (rawIdentifier && !isValidUdyam(rawIdentifier)) {
      initialRiskIndicators.push({
        code: 'FORMAT_INVALID_UDYAM',
        severity: 'high',
        description: 'Submitted Udyam registration number format is invalid.'
      });
      formatRiskScore += 25;
    }
  }

  // 2. Authoritative Comparison & Discrepancy Matching
  const comparison = compareRegistryRecord({
    company,
    registryData: providerResult.registryData,
    checkType,
    baseOutcome: providerResult.outcome
  });

  // 3. Cross-Field Fraud Risk Indicators
  const fraudRiskIndicators = [];
  let fraudRiskScore = 0;

  if (owner && owner.email && company.officialEmailDomain) {
    const emailDomain = owner.email.split('@')[1]?.toLowerCase();
    const companyDomain = company.officialEmailDomain.toLowerCase();
    if (emailDomain && companyDomain && emailDomain !== companyDomain) {
      fraudRiskIndicators.push({
        code: 'RECRUITER_DOMAIN_MISMATCH',
        severity: 'medium',
        description: `Recruiter email domain '${emailDomain}' does not match company official domain '${companyDomain}'.`
      });
      fraudRiskScore += 20;
    }
  }

  if (company.foundedYear) {
    const currentYear = new Date().getUTCFullYear();
    if (currentYear - company.foundedYear <= 1) {
      fraudRiskIndicators.push({
        code: 'RECENTLY_FOUNDED_COMPANY',
        severity: 'low',
        description: 'Company was founded within the last year.'
      });
      fraudRiskScore += 10;
    }
  }

  const allRiskIndicators = [
    ...initialRiskIndicators,
    ...comparison.riskIndicators,
    ...fraudRiskIndicators
  ];

  const totalRiskScore = Math.min(100, Math.max(0, formatRiskScore + comparison.riskScore + fraudRiskScore));

  const checkRecord = await CompanyRegistryCheck.create({
    companyId: company._id,
    checkType,
    provider: providerResult.provider,
    identifierType: providerResult.identifierType || identifierType,
    maskedIdentifier: providerResult.maskedIdentifier || maskIdentifier(rawIdentifier),
    registryData: providerResult.registryData || null,
    outcome: comparison.outcome,
    summary: comparison.summary,
    referenceId: providerResult.referenceId || '',
    matchedFields: comparison.matchedFields,
    mismatchedFields: comparison.mismatchedFields,
    riskIndicators: allRiskIndicators,
    riskScore: totalRiskScore,
    checkedAt: new Date(),
    status: 'active'
  });

  // Update technical registry verification status on Company (NOT verificationStatus)
  let newRegistryStatus = 'inconclusive';
  if (comparison.outcome === 'match') {
    newRegistryStatus = 'verified';
  } else if (comparison.outcome === 'mismatch') {
    newRegistryStatus = 'failed';
  } else if (comparison.outcome === 'not_found') {
    newRegistryStatus = 'failed';
  }

  await Company.findByIdAndUpdate(company._id, {
    registryVerificationStatus: newRegistryStatus,
    registryVerifiedAt: new Date()
  });

  if (actorId) {
    await AuditLog.create({
      action: 'company.registry_check_performed',
      actor: actorId,
      company: company._id,
      newValue: {
        checkId: checkRecord._id,
        checkType,
        outcome: comparison.outcome,
        riskScore: totalRiskScore,
        summary: comparison.summary
      }
    });
  }

  // CRITICAL SECURITY RULE: The automated registry check does NOT alter Company.verificationStatus!
  return checkRecord;
};

/**
 * Returns all registry check records for a company.
 */
export const getRegistryChecksForCompany = async (companyId) => {
  return CompanyRegistryCheck.find({ companyId })
    .populate('overriddenBy', 'fullName email')
    .sort({ checkedAt: -1 });
};

/**
 * Allows an administrator to manually override a registry check record.
 */
export const overrideRegistryCheck = async ({ companyId, checkId, adminUser, reason }) => {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new AppError('Reason is required for manual override of registry check', 400);
  }

  const checkRecord = await CompanyRegistryCheck.findOne({ _id: checkId, companyId });
  if (!checkRecord) {
    throw new AppError('Registry check record not found', 404);
  }

  const previousStatus = checkRecord.status;
  checkRecord.status = 'overridden';
  checkRecord.overriddenBy = adminUser._id || adminUser.id;
  checkRecord.overriddenAt = new Date();
  checkRecord.overrideReason = reason.trim();
  await checkRecord.save();

  await AuditLog.create({
    action: 'company.registry_check_overridden',
    actor: adminUser._id || adminUser.id,
    company: companyId,
    oldValue: { checkId: checkRecord._id, status: previousStatus },
    newValue: {
      checkId: checkRecord._id,
      status: 'overridden',
      overrideReason: reason.trim(),
      overriddenBy: adminUser.fullName || adminUser.email
    }
  });

  return checkRecord;
};

/**
 * Returns privacy-safe verification summary for company/recruiter view.
 */
export const getCompanyVerificationSummary = async (companyId) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const owner = await User.findById(company.owner);
  const checks = await CompanyRegistryCheck.find({ companyId }).sort({ checkedAt: -1 });

  const latestCheck = checks[0] || null;
  const hasOverridden = checks.some((c) => c.status === 'overridden');

  return {
    companyId: company._id,
    verificationStatus: company.verificationStatus,
    registryVerificationStatus: company.registryVerificationStatus || 'none',
    registryVerifiedAt: company.registryVerifiedAt || null,
    emailVerified: Boolean(owner?.emailVerified),
    domainVerified: Boolean(company.domainVerified),
    officialEmailDomain: company.officialEmailDomain || '',
    registryCheckCount: checks.length,
    latestRegistryCheck: latestCheck
      ? {
          checkType: latestCheck.checkType,
          identifierType: latestCheck.identifierType,
          maskedIdentifier: latestCheck.maskedIdentifier,
          outcome: latestCheck.outcome,
          summary: latestCheck.summary,
          checkedAt: latestCheck.checkedAt,
          status: latestCheck.status,
          hasRiskIndicators: latestCheck.riskIndicators.length > 0
        }
      : null,
    hasOverriddenChecks: hasOverridden
  };
};
