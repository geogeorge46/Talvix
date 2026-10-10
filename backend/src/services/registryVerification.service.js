import { Company } from '../models/Company.js';
import { CompanyRegistryCheck } from '../models/CompanyRegistryCheck.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../shared/errors/AppError.js';
import { getRegistryProvider } from './registryVerification/registryProviderFactory.js';
import { isValidCIN, isValidGSTIN, isValidUdyam } from '../utils/formatValidation.js';

/**
 * Normalizes company names by removing legal suffixes, punctuation, and extra whitespace.
 */
export const normalizeCompanyName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|inc|incorporated|llp|corp|corporation|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isFuzzyNameMatch = (name1, name2) => {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  if (!norm1 || !norm2) return false;
  return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
};

/**
 * Executes a registry check for a company.
 */
export const runRegistryCheck = async ({ companyId, checkType = 'company_registration', providerName = 'mock_registry', options = {}, actorId }) => {
  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  const owner = await User.findById(company.owner);
  const provider = getRegistryProvider(providerName);
  const providerResult = await provider.verifyRegistration({ company, checkType, options });

  const matchedFields = [];
  const mismatchedFields = [];
  const riskIndicators = [];
  let riskScore = 0;

  // 1. Format Validation & Registry Outcome Evaluation
  let identifierValid = true;
  if (checkType === 'company_registration' && company.cin) {
    identifierValid = isValidCIN(company.cin);
    if (!identifierValid) {
      riskIndicators.push({
        code: 'FORMAT_INVALID_CIN',
        severity: 'high',
        description: 'Submitted Corporate Identification Number (CIN/LLPIN) format is invalid.'
      });
      riskScore += 25;
    }
  } else if (checkType === 'gst_registration' && company.gstin) {
    identifierValid = isValidGSTIN(company.gstin);
    if (!identifierValid) {
      riskIndicators.push({
        code: 'FORMAT_INVALID_GSTIN',
        severity: 'high',
        description: 'Submitted GSTIN format is invalid.'
      });
      riskScore += 25;
    }
  } else if (checkType === 'msme_registration' && company.udyamRegistrationNumber) {
    identifierValid = isValidUdyam(company.udyamRegistrationNumber);
    if (!identifierValid) {
      riskIndicators.push({
        code: 'FORMAT_INVALID_UDYAM',
        severity: 'high',
        description: 'Submitted Udyam registration number format is invalid.'
      });
      riskScore += 25;
    }
  }

  let finalOutcome = providerResult.outcome;

  if (finalOutcome === 'unavailable') {
    riskIndicators.push({
      code: 'REGISTRY_UNAVAILABLE',
      severity: 'low',
      description: 'External registry provider was temporarily unavailable. Manual verification recommended.'
    });
    riskScore += 5;
  } else if (finalOutcome === 'not_found') {
    riskIndicators.push({
      code: 'REGISTRY_NOT_FOUND',
      severity: 'high',
      description: 'Business registration details were not found in official registry records.'
    });
    riskScore += 40;
  } else if (finalOutcome === 'mismatch' || finalOutcome === 'match') {
    const regData = providerResult.registryData || {};
    const submittedLegalName = company.legalName || company.name;

    // Check Legal Name Match
    if (regData.legalName) {
      if (isFuzzyNameMatch(submittedLegalName, regData.legalName)) {
        matchedFields.push('legalName');
      } else {
        mismatchedFields.push({
          field: 'legalName',
          submitted: submittedLegalName,
          registry: regData.legalName
        });
        riskIndicators.push({
          code: 'REGISTRY_NAME_MISMATCH',
          severity: 'high',
          description: `Submitted legal name '${submittedLegalName}' mismatches official registry name '${regData.legalName}'.`
        });
        riskScore += 35;
      }
    }

    // Check Entity Type Match
    if (regData.entityType && company.entityType) {
      if (regData.entityType.toLowerCase() === company.entityType.toLowerCase()) {
        matchedFields.push('entityType');
      } else {
        mismatchedFields.push({
          field: 'entityType',
          submitted: company.entityType,
          registry: regData.entityType
        });
        riskIndicators.push({
          code: 'REGISTRY_ENTITY_MISMATCH',
          severity: 'medium',
          description: `Submitted entity type '${company.entityType}' mismatches registry entity type '${regData.entityType}'.`
        });
        riskScore += 20;
      }
    }

    if (mismatchedFields.length > 0 && finalOutcome === 'match') {
      finalOutcome = 'mismatch';
    }
  }

  // 2. Cross-Field Fraud Risk Indicators
  if (owner && owner.email && company.officialEmailDomain) {
    const emailDomain = owner.email.split('@')[1]?.toLowerCase();
    const companyDomain = company.officialEmailDomain.toLowerCase();
    if (emailDomain && companyDomain && emailDomain !== companyDomain) {
      riskIndicators.push({
        code: 'RECRUITER_DOMAIN_MISMATCH',
        severity: 'medium',
        description: `Recruiter email domain '${emailDomain}' does not match company official domain '${companyDomain}'.`
      });
      riskScore += 20;
    }
  }

  if (company.foundedYear) {
    const currentYear = new Date().getUTCFullYear();
    if (currentYear - company.foundedYear <= 1) {
      riskIndicators.push({
        code: 'RECENTLY_FOUNDED_COMPANY',
        severity: 'low',
        description: 'Company was founded within the last year.'
      });
      riskScore += 10;
    }
  }

  // Cap risk score between 0 and 100
  const finalRiskScore = Math.min(100, Math.max(0, riskScore));

  const checkRecord = await CompanyRegistryCheck.create({
    companyId: company._id,
    checkType,
    provider: providerResult.provider,
    outcome: finalOutcome,
    referenceId: providerResult.referenceId || '',
    matchedFields,
    mismatchedFields,
    riskIndicators,
    riskScore: finalRiskScore,
    checkedAt: new Date(),
    status: 'active'
  });

  if (actorId) {
    await AuditLog.create({
      action: 'company.registry_check_performed',
      actor: actorId,
      company: company._id,
      newValue: {
        checkId: checkRecord._id,
        checkType,
        outcome: finalOutcome,
        riskScore: finalRiskScore
      }
    });
  }

  // CRITICAL SECURITY RULE: The automated check does NOT alter Company.verificationStatus!
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
    emailVerified: Boolean(owner?.emailVerified),
    domainVerified: Boolean(company.domainVerified),
    officialEmailDomain: company.officialEmailDomain || '',
    registryCheckCount: checks.length,
    latestRegistryCheck: latestCheck
      ? {
          checkType: latestCheck.checkType,
          outcome: latestCheck.outcome,
          checkedAt: latestCheck.checkedAt,
          status: latestCheck.status,
          hasRiskIndicators: latestCheck.riskIndicators.length > 0
        }
      : null,
    hasOverriddenChecks: hasOverridden
  };
};
