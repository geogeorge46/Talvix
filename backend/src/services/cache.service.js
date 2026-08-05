import crypto from 'crypto';
import { AICache } from '../models/AICache.js';

/**
 * Generates a stable unique hash key for caching.
 */
export const generateCacheKey = (promptKey, promptVariables, providerName, modelName) => {
  const rawString = JSON.stringify({ promptKey, promptVariables, providerName, modelName });
  return crypto.createHash('sha256').update(rawString).digest('hex');
};

/**
 * Resolves a cached response if valid and not expired.
 */
export const getCache = async (key) => {
  const cacheItem = await AICache.findOne({ cacheKey: key, expiresAt: { $gt: new Date() } });
  return cacheItem ? cacheItem.response : null;
};

/**
 * Stores an AI response in cache.
 */
export const setCache = async (key, response, ttlSeconds = 3600, companyId = null) => {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await AICache.findOneAndUpdate(
    { cacheKey: key },
    { response, expiresAt, company: companyId },
    { upsert: true, new: true }
  );
};

/**
 * Invalidates a specific cache entry.
 */
export const invalidateCache = async (key) => {
  await AICache.deleteOne({ cacheKey: key });
};

/**
 * Deletes all expired cache entries.
 */
export const cleanupExpiredCache = async () => {
  const res = await AICache.deleteMany({ expiresAt: { $lt: new Date() } });
  return res.deletedCount;
};
