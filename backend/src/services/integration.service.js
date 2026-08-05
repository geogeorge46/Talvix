import { HRISIntegration } from '../models/HRISIntegration.js';
import { WebhookSubscription } from '../models/WebhookSubscription.js';
import { APIKey } from '../models/APIKey.js';
import { AppError } from '../shared/errors/AppError.js';
import crypto from 'crypto';

export const connectHRIS = async (companyId, provider, credentials, userId) => {
  let connection = await HRISIntegration.findOne({ company: companyId, provider });
  if (connection) {
    connection.credentials = credentials;
    connection.status = 'connected';
    await connection.save();
  } else {
    connection = await HRISIntegration.create({
      company: companyId,
      provider,
      credentials,
      status: 'connected',
      createdBy: userId
    });
  }
  return connection;
};

export const syncHRISData = async (companyId, provider) => {
  const connection = await HRISIntegration.findOne({ company: companyId, provider });
  if (!connection) throw new AppError('HRIS connection not configured', 404);

  connection.status = 'syncing';
  await connection.save();

  // Simulate remote HRIS sync
  connection.status = 'connected';
  connection.lastSyncedAt = new Date();
  await connection.save();

  return { success: true, syncedRecordsCount: 42, syncedAt: connection.lastSyncedAt };
};

export const createAPIKey = async (companyId, name, userId) => {
  const rawKey = `tlvx_${crypto.randomBytes(24).toString('hex')}`;
  return await APIKey.create({
    company: companyId,
    name,
    key: rawKey,
    scopes: ['*'],
    createdBy: userId
  });
};

export const verifyAPIKey = async (keyString) => {
  const record = await APIKey.findOne({ key: keyString, isActive: true });
  if (!record) throw new AppError('Invalid or inactive API Key', 401);
  return record;
};

export const registerWebhook = async (companyId, targetUrl, events, userId) => {
  const secret = `whsec_${crypto.randomBytes(16).toString('hex')}`;
  return await WebhookSubscription.create({
    company: companyId,
    targetUrl,
    events,
    secret,
    createdBy: userId
  });
};

export const triggerWebhook = async (companyId, eventName, _payload) => {
  const subs = await WebhookSubscription.find({ company: companyId, events: eventName, isActive: true });
  const results = [];

  for (const sub of subs) {
    // Mock delivery
    results.push({
      targetUrl: sub.targetUrl,
      delivered: true,
      statusCode: 200,
      timestamp: new Date()
    });
  }

  return results;
};
