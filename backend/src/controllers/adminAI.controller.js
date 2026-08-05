import { AIProvider } from '../models/AIProvider.js';
import { AIConfiguration } from '../models/AIConfiguration.js';
import { AIPrompt } from '../models/AIPrompt.js';
import { AIUsageLog } from '../models/AIUsageLog.js';
import { AICache } from '../models/AICache.js';
import { updateConfiguration } from '../services/aiConfig.service.js';
import { getAggregatedUsage, getDailyUsageSeries } from '../services/aiUsage.service.js';
import { AppError } from '../shared/errors/AppError.js';
import mongoose from 'mongoose';

// Config
export const getConfig = async (req, res, next) => {
  try {
    let config = await AIConfiguration.findOne({ company: null });
    if (!config) {
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
    return res.json({ success: true, data: config });
  } catch (error) {
    return next(error);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const config = await updateConfiguration(null, req.body);
    return res.json({ success: true, data: config });
  } catch (error) {
    return next(error);
  }
};

// Providers
export const getProviders = async (req, res, next) => {
  try {
    const providers = await AIProvider.find().select('+apiKey');
    return res.json({ success: true, data: providers });
  } catch (error) {
    return next(error);
  }
};

export const createProvider = async (req, res, next) => {
  try {
    const provider = await AIProvider.create(req.body);
    return res.status(201).json({ success: true, data: provider });
  } catch (error) {
    return next(error);
  }
};

export const updateProvider = async (req, res, next) => {
  try {
    const provider = await AIProvider.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!provider) {
      throw new AppError('Provider not found', 404);
    }
    return res.json({ success: true, data: provider });
  } catch (error) {
    return next(error);
  }
};

export const deleteProvider = async (req, res, next) => {
  try {
    const provider = await AIProvider.findByIdAndDelete(req.params.id);
    if (!provider) {
      throw new AppError('Provider not found', 404);
    }
    return res.json({ success: true, message: 'Provider deleted successfully' });
  } catch (error) {
    return next(error);
  }
};

// Prompts
export const getPrompts = async (req, res, next) => {
  try {
    const prompts = await AIPrompt.find().sort({ key: 1, version: -1 });
    return res.json({ success: true, data: prompts });
  } catch (error) {
    return next(error);
  }
};

export const createPrompt = async (req, res, next) => {
  try {
    const { key, template, description, requiredVariables } = req.body;
    
    // Auto increment version
    const latest = await AIPrompt.findOne({ key }).sort({ version: -1 });
    const version = latest ? latest.version + 1 : 1;

    // Inactivate older active prompts if this one will be active
    if (req.body.isActive !== false) {
      await AIPrompt.updateMany({ key }, { $set: { isActive: false } });
    }

    const prompt = await AIPrompt.create({
      key,
      version,
      template,
      description,
      requiredVariables,
      isActive: req.body.isActive !== false,
      createdBy: req.user.id
    });

    return res.status(201).json({ success: true, data: prompt });
  } catch (error) {
    return next(error);
  }
};

export const setActivePrompt = async (req, res, next) => {
  try {
    const { key, version } = req.params;
    await AIPrompt.updateMany({ key }, { $set: { isActive: false } });
    const prompt = await AIPrompt.findOneAndUpdate({ key, version: Number(version) }, { $set: { isActive: true } }, { new: true });
    
    if (!prompt) {
      throw new AppError('Prompt version not found', 404);
    }

    return res.json({ success: true, data: prompt });
  } catch (error) {
    return next(error);
  }
};

// Stats
export const getUsageStats = async (req, res, next) => {
  try {
    const stats = await getAggregatedUsage(req.query);
    return res.json({ success: true, data: stats });
  } catch (error) {
    return next(error);
  }
};

export const getUsageCosts = async (req, res, next) => {
  try {
    const dailySeries = await getDailyUsageSeries(req.query);
    return res.json({ success: true, data: dailySeries });
  } catch (error) {
    return next(error);
  }
};

// Health
export const getSystemHealth = async (req, res, next) => {
  try {
    const activeProviders = await AIProvider.countDocuments({ isActive: true });
    const totalCacheSize = await AICache.countDocuments();
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    const lastHour = new Date(Date.now() - 3600000);
    const recentLogs = await AIUsageLog.find({ createdAt: { $gte: lastHour } });
    
    const totalCount = recentLogs.length;
    const errorCount = recentLogs.filter(l => l.status === 'failed').length;
    const errorRate = totalCount ? (errorCount / totalCount) * 100 : 0;
    
    const latencySum = recentLogs.reduce((sum, l) => sum + (l.durationMs || 0), 0);
    const avgLatency = totalCount ? latencySum / totalCount : 0;

    return res.json({
      success: true,
      data: {
        databaseState: dbState,
        activeProviders,
        totalCacheSize,
        recentStats: {
          requestsLastHour: totalCount,
          errorRatePercent: Number(errorRate.toFixed(2)),
          averageLatencyMs: Number(avgLatency.toFixed(0))
        }
      }
    });
  } catch (error) {
    return next(error);
  }
};

// Logs
export const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AIUsageLog.find()
      .populate('user', 'fullName email')
      .populate('company', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ success: true, data: logs });
  } catch (error) {
    return next(error);
  }
};

// Security
export const getSecurityMetrics = async (req, res, next) => {
  try {
    const last24h = new Date(Date.now() - 24 * 3600 * 1000);
    
    // Count failed checks and blocked request logs
    const rateLimitBlockedCount = await AIUsageLog.countDocuments({
      status: 'failed',
      errorMessage: /rate limit/i,
      createdAt: { $gte: last24h }
    });

    const potentialInjectionsCount = await AIUsageLog.countDocuments({
      status: 'failed',
      errorMessage: /injection/i,
      createdAt: { $gte: last24h }
    });

    return res.json({
      success: true,
      data: {
        rateLimitsTriggered24h: rateLimitBlockedCount,
        potentialPromptInjections24h: potentialInjectionsCount
      }
    });
  } catch (error) {
    return next(error);
  }
};
