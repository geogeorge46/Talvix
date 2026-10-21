/**
 * Match and discrepancy handling service for business registries.
 * Conservatively normalizes names, checks entity type compatibility,
 * examines registry status, and flags explainable risk indicators.
 */

export const normalizeCompanyName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|inc|incorporated|llp|limited liability partnership|corp|corporation|co|company)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const isFuzzyNameMatch = (name1, name2) => {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;

  // Substring check with conservative length threshold
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = Math.min(norm1.length, norm2.length);
    const longer = Math.max(norm1.length, norm2.length);
    if (shorter / longer >= 0.6) {
      return true;
    }
  }

  // Token overlap check (Jaccard token similarity)
  const tokens1 = new Set(norm1.split(' ').filter(Boolean));
  const tokens2 = new Set(norm2.split(' ').filter(Boolean));
  if (tokens1.size === 0 || tokens2.size === 0) return false;

  const intersection = [...tokens1].filter((t) => tokens2.has(t));
  const union = new Set([...tokens1, ...tokens2]);
  const jaccard = intersection.length / union.size;

  return jaccard >= 0.7;
};

export const normalizeEntityType = (type) => {
  if (!type || typeof type !== 'string') return '';
  const clean = type.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean.includes('privatelimited') || clean === 'ptc' || clean === 'pvt') return 'private_limited';
  if (clean.includes('publiclimited') || clean === 'plc') return 'public_limited';
  if (clean.includes('llp') || clean.includes('limitedliabilitypartnership')) return 'llp';
  if (clean.includes('proprietorship') || clean.includes('soleproprietor')) return 'proprietorship';
  if (clean.includes('partnership')) return 'partnership';
  return clean;
};

export const normalizeState = (state) => {
  if (!state || typeof state !== 'string') return '';
  return state.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

/**
 * Compares submitted company details with returned authoritative registry data.
 * Produces matched fields, mismatched fields, risk indicators, score, and summary.
 */
export const compareRegistryRecord = ({ company, registryData, checkType: _checkType, baseOutcome }) => {
  const matchedFields = [];
  const mismatchedFields = [];
  const riskIndicators = [];
  let riskScore = 0;

  if (baseOutcome === 'unavailable') {
    riskIndicators.push({
      code: 'REGISTRY_UNAVAILABLE',
      severity: 'low',
      description: 'External registry provider was temporarily unavailable. Manual document review required.'
    });
    return {
      outcome: 'unavailable',
      matchedFields: [],
      mismatchedFields: [],
      riskIndicators,
      riskScore: 5,
      summary: 'Registry provider temporarily unavailable. Company flagged for manual review.'
    };
  }

  if (baseOutcome === 'manual_review_required') {
    riskIndicators.push({
      code: 'MANUAL_REVIEW_REQUIRED',
      severity: 'low',
      description: 'Registry check requires manual review because credentials or provider support is pending.'
    });
    return {
      outcome: 'manual_review_required',
      matchedFields: [],
      mismatchedFields: [],
      riskIndicators,
      riskScore: 5,
      summary: 'Manual verification required. No live provider credentials configured.'
    };
  }

  if (baseOutcome === 'not_found' || !registryData) {
    riskIndicators.push({
      code: 'REGISTRY_NOT_FOUND',
      severity: 'high',
      description: 'Registration identifier was not found in official government records.'
    });
    return {
      outcome: 'not_found',
      matchedFields: [],
      mismatchedFields: [],
      riskIndicators,
      riskScore: 40,
      summary: 'Identifier not found in registry. Admin review advised.'
    };
  }

  // 1. Legal Name / Trade Name Comparison
  const submittedLegalName = company.legalName || company.name || '';
  const registryLegalName = registryData.legalName || '';
  const registryTradeName = registryData.tradeName || '';

  if (registryLegalName) {
    const isLegalMatch = isFuzzyNameMatch(submittedLegalName, registryLegalName);
    const isTradeMatch = registryTradeName ? isFuzzyNameMatch(submittedLegalName, registryTradeName) : false;

    if (isLegalMatch || isTradeMatch) {
      matchedFields.push('legalName');
    } else {
      mismatchedFields.push({
        field: 'legalName',
        submitted: submittedLegalName,
        registry: registryLegalName
      });
      riskIndicators.push({
        code: 'REGISTRY_NAME_MISMATCH',
        severity: 'high',
        description: `Submitted company legal name '${submittedLegalName}' does not match registry record '${registryLegalName}'.`
      });
      riskScore += 35;
    }
  }

  // 2. Entity Type Consistency Check
  if (company.entityType && registryData.entityType) {
    const normSubmittedEntity = normalizeEntityType(company.entityType);
    const normRegistryEntity = normalizeEntityType(registryData.entityType);

    if (normSubmittedEntity && normRegistryEntity && normSubmittedEntity === normRegistryEntity) {
      matchedFields.push('entityType');
    } else if (normSubmittedEntity && normRegistryEntity) {
      mismatchedFields.push({
        field: 'entityType',
        submitted: company.entityType,
        registry: registryData.entityType
      });
      riskIndicators.push({
        code: 'REGISTRY_ENTITY_MISMATCH',
        severity: 'medium',
        description: `Submitted entity type '${company.entityType}' differs from registry type '${registryData.entityType}'.`
      });
      riskScore += 20;
    }
  }

  // 3. Registration Status Check (Active vs Cancelled / Suspended / Inactive)
  if (registryData.status) {
    const statusClean = String(registryData.status).toLowerCase();
    const isActive = ['active', 'actv', 'normal', 'registered'].some((s) => statusClean.includes(s));
    const isSuspendedOrCancelled = ['cancelled', 'suspended', 'inactive', 'strike', 'dormant', 'liquidat', 'dissolved'].some((s) => statusClean.includes(s));

    if (isSuspendedOrCancelled) {
      mismatchedFields.push({
        field: 'status',
        submitted: 'active',
        registry: registryData.status
      });
      riskIndicators.push({
        code: 'REGISTRY_STATUS_INACTIVE',
        severity: 'critical',
        description: `Registry status is '${registryData.status}', indicating company is not in good standing.`
      });
      riskScore += 45;
    } else if (isActive) {
      matchedFields.push('status');
    }
  }

  // 4. State / Address Consistency Check
  const submittedState = company.registeredAddress?.state || company.headquarters?.state || '';
  const registryState = registryData.state || registryData.registeredAddress?.state || '';

  if (submittedState && registryState) {
    if (normalizeState(submittedState) === normalizeState(registryState)) {
      matchedFields.push('state');
    } else {
      mismatchedFields.push({
        field: 'state',
        submitted: submittedState,
        registry: registryState
      });
      riskIndicators.push({
        code: 'REGISTRY_STATE_MISMATCH',
        severity: 'medium',
        description: `Submitted registered state '${submittedState}' does not match registry state '${registryState}'.`
      });
      riskScore += 15;
    }
  }

  const finalOutcome = mismatchedFields.length > 0 ? 'mismatch' : 'match';
  const cappedRiskScore = Math.min(100, Math.max(0, riskScore));

  const summary = finalOutcome === 'match'
    ? `Registry check verified: ${matchedFields.join(', ')} matched authoritative records.`
    : `Registry check flagged discrepancies in: ${mismatchedFields.map((f) => f.field).join(', ')}.`;

  return {
    outcome: finalOutcome,
    matchedFields,
    mismatchedFields,
    riskIndicators,
    riskScore: cappedRiskScore,
    summary
  };
};
