import { AIUsageLog } from '../models/AIUsageLog.js';
import { User } from '../models/User.js';

/**
 * Creates a sanitized AI Usage log in the database.
 */
export const logUsage = async (data) => {
  try {
    const {
      companyId = null,
      userId = null,
      providerName,
      modelName,
      promptKey,
      promptVersion = 1,
      tokensInput = 0,
      tokensOutput = 0,
      cost = 0,
      durationMs = 0,
      status,
      errorMessage = '',
      ipAddress = 'Unknown',
      userAgent = 'Unknown',
      requestPayload = null,
      responsePayload = null
    } = data;

    // Remove confidential or secret fields from payload logs
    const sanitize = (payload) => {
      if (!payload) return null;
      try {
        const sanitized = JSON.parse(JSON.stringify(payload));
        const sensitiveKeys = ['apikey', 'password', 'token', 'secret', 'key', 'auth'];
        
        const traverse = (obj) => {
          if (typeof obj !== 'object' || obj === null) return;
          for (const [k, v] of Object.entries(obj)) {
            if (sensitiveKeys.some(sk => k.toLowerCase().includes(sk))) {
              obj[k] = '[REDACTED]';
            } else if (typeof v === 'string') {
              let updatedStr = v;
              for (const sk of sensitiveKeys) {
                const regex = new RegExp(sk, 'gi');
                updatedStr = updatedStr.replace(regex, '[REDACTED]');
              }
              obj[k] = updatedStr;
            } else {
              traverse(v);
            }
          }
        };
        traverse(sanitized);
        return sanitized;
      } catch {
        return null;
      }
    };

    return await AIUsageLog.create({
      company: companyId,
      user: userId,
      providerName,
      modelName,
      promptKey,
      promptVersion,
      tokensInput,
      tokensOutput,
      cost,
      durationMs,
      status,
      errorMessage,
      ipAddress,
      userAgent,
      requestPayload: sanitize(requestPayload),
      responsePayload: sanitize(responsePayload)
    });
  } catch (err) {
    console.error('Failed to log AI Usage:', err);
  }
};

/**
 * Aggregates usage details across providers, prompts, and companies.
 */
export const getAggregatedUsage = async (filters = {}) => {
  const { companyId, from, to, promptKey, providerName, userRole } = filters;
  const match = {};

  if (companyId) match.company = companyId;
  if (promptKey) match.promptKey = promptKey;
  if (providerName) match.providerName = providerName;

  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  if (userRole) {
    const users = await User.find({ role: userRole }).select('_id');
    match.user = { $in: users.map(u => u._id) };
  }

  const result = await AIUsageLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        successfulRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
        failedRequests: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        totalTokensInput: { $sum: '$tokensInput' },
        totalTokensOutput: { $sum: '$tokensOutput' },
        totalCost: { $sum: '$cost' },
        averageDuration: { $avg: '$durationMs' }
      }
    }
  ]);

  return result[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensInput: 0,
    totalTokensOutput: 0,
    totalCost: 0,
    averageDuration: 0
  };
};

/**
 * Returns time-series usage statistics for charts.
 */
export const getDailyUsageSeries = async (filters = {}) => {
  const { companyId, from, to } = filters;
  const match = {};

  if (companyId) match.company = companyId;
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  return await AIUsageLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        requests: { $sum: 1 },
        tokens: { $sum: { $add: ['$tokensInput', '$tokensOutput'] } },
        cost: { $sum: '$cost' }
      }
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        requests: 1,
        tokens: 1,
        cost: 1,
        _id: 0
      }
    }
  ]);
};
