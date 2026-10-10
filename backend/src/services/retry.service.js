import { logger } from '../shared/utils/logger.js';

/**
 * Executes a function with exponential backoff retries, jitter, and Retry-After header support.
 */
export const executeWithRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    factor = 2,
    maxDelayMs = 10000,
    retryOn = (err) => {
      const status = err?.statusCode || err?.status;
      return !status || status === 429 || status === 502 || status === 503 || status === 504 || Boolean(err?.isTransient);
    }
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt > maxRetries || !retryOn(error)) {
        throw error;
      }

      let waitTime = delay;
      if (typeof error?.retryAfterMs === 'number' && error.retryAfterMs > 0) {
        waitTime = Math.max(delay, error.retryAfterMs);
      }

      // Add randomized jitter (+/- 15% of wait time)
      const jitter = (Math.random() - 0.5) * 0.3 * waitTime;
      const actualDelay = Math.min(maxDelayMs, Math.max(0, Math.round(waitTime + jitter)));

      logger.warn(`AI Gateway provider call failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${actualDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delay = Math.min(maxDelayMs, delay * factor);
    }
  }
};
