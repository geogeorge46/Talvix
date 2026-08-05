import { logger } from '../shared/utils/logger.js';

/**
 * Executes a function with exponential backoff retries.
 */
export const executeWithRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    factor = 2,
    retryOn = (err) => {
      // Retry on network errors, rate limits (429), or internal errors (5xx)
      const status = err.statusCode || err.status;
      return !status || status === 429 || (status >= 500 && status < 600);
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
      logger.warn(`AI Gateway provider call failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= factor;
    }
  }
};
