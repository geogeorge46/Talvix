import { AIConfiguration } from '../models/AIConfiguration.js';
import { getCache, setCache } from './cache.service.js';

const CONFIG_CACHE_PREFIX = 'ai_config:';

/**
 * Resolves configuration for a company, falling back to global defaults.
 */
export const getConfiguration = async (companyId = null) => {
  const cacheKey = `${CONFIG_CACHE_PREFIX}${companyId || 'global'}`;
  
  // Try caching
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  let config = await AIConfiguration.findOne({ company: companyId });
  
  if (!config && companyId !== null) {
    // Try global settings
    config = await AIConfiguration.findOne({ company: null });
  }

  if (!config) {
    // Autogenerate global default config
    config = await AIConfiguration.create({
      company: null,
      primaryProvider: 'gemini',
      fallbackProvider: null,
      cachingEnabled: true,
      cacheTtlSeconds: 3600,
      retryCount: 3,
      retryBackoffMs: 1000
    });
  }

  const configObj = config.toObject ? config.toObject() : config;

  // Cache configuration for 5 minutes
  await setCache(cacheKey, configObj, 300, companyId);

  return configObj;
};

/**
 * Updates settings and purges cache.
 */
export const updateConfiguration = async (companyId, updateData) => {
  const config = await AIConfiguration.findOneAndUpdate(
    { company: companyId },
    { $set: updateData },
    { upsert: true, new: true }
  );

  const cacheKey = `${CONFIG_CACHE_PREFIX}${companyId || 'global'}`;
  await setCache(cacheKey, config.toObject(), 300, companyId);
  
  return config;
};
