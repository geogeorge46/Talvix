import { Organization } from '../models/Organization.js';
import { AuditLog } from '../models/AuditLog.js';
import { Secret } from '../models/Secret.js';
import { SecurityIncident } from '../models/SecurityIncident.js';
import { TenantQuota } from '../models/TenantQuota.js';
import { AppError } from '../shared/errors/AppError.js';
import crypto from 'crypto';

export const createOrganization = async (companyId, name, branding = {}, settings = {}) => {
  let org = await Organization.findOne({ company: companyId });
  if (org) {
    org.name = name;
    org.branding = branding;
    org.settings = settings;
    await org.save();
  } else {
    org = await Organization.create({ company: companyId, name, branding, settings });
  }
  return org;
};

export const logAuditEvent = async (actorId, companyId, action, resource, metadata = {}) => {
  return await AuditLog.create({
    actor: actorId,
    company: companyId,
    action,
    resource,
    metadata
  });
};

export const rotateSecret = async (companyId, key, rotationPolicy = 'manual') => {
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const encryptedValue = crypto.createHash('sha256').update(rawSecret).digest('hex'); // Simple encryption mockup

  let record = await Secret.findOne({ company: companyId, key });
  if (record) {
    record.encryptedValue = encryptedValue;
    record.rotationPolicy = rotationPolicy;
    await record.save();
  } else {
    record = await Secret.create({
      company: companyId,
      key,
      encryptedValue,
      rotationPolicy
    });
  }
  return record;
};

export const enforceQuota = async (companyId, limitType, amount) => {
  const quota = await TenantQuota.findOne({ company: companyId });
  if (!quota) return true; // No quota restriction defined

  const currentLimit = quota[limitType];
  if (currentLimit !== undefined && amount > currentLimit) {
    throw new AppError(`Tenant quota exceeded for ${limitType}. Maximum limit allowed is ${currentLimit}`, 403);
  }
  return true;
};

export const logSecurityIncident = async (companyId, userId, severity, category, description) => {
  return await SecurityIncident.create({
    company: companyId,
    user: userId,
    severity,
    category,
    description
  });
};
