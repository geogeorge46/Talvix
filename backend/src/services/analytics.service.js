import mongoose from 'mongoose';
import { AnalyticsSnapshot } from '../models/AnalyticsSnapshot.js';
import { ExecutiveReport } from '../models/ExecutiveReport.js';
import { Application } from '../models/Application.js';
import { AIUsageLog } from '../models/AIUsageLog.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

const reportSchema = z.object({
  aiSummary: z.string(),
  forecasts: z.object({
    predictedHiringDemand: z.number().default(0),
    expectedCompletionDays: z.number().default(0),
    budgetForecastUSD: z.number().default(0)
  }),
  riskAlerts: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([])
});

/**
 * Daily background database aggregator compiling applicant funnel metrics and token costs.
 */
export const generateAnalyticsSnapshot = async (companyId) => {
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  const counts = await Application.aggregate([
    { $match: { company: companyObjectId } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const funnelMap = {
    applied: 0,
    screened: 0,
    interviewed: 0,
    offers: 0,
    hired: 0,
    rejected: 0
  };

  counts.forEach(c => {
    if (c._id === 'submitted') funnelMap.applied = c.count;
    if (c._id === 'shortlisted') funnelMap.screened = c.count;
    if (c._id === 'interview-scheduled' || c._id === 'interview-completed') funnelMap.interviewed += c.count;
    if (c._id === 'offer-pending' || c._id === 'offer-sent' || c._id === 'offer-accepted' || c._id === 'offer-declined') funnelMap.offers += c.count;
    if (c._id === 'hired') funnelMap.hired = c.count;
    if (c._id === 'rejected') funnelMap.rejected = c.count;
  });

  const logs = await AIUsageLog.aggregate([
    { $match: { company: companyObjectId } },
    { $group: { _id: null, tokens: { $sum: { $add: ['$tokensInput', '$tokensOutput'] } }, cost: { $sum: '$cost' } } }
  ]);

  const aiCost = logs[0] || { tokens: 0, cost: 0 };

  return await AnalyticsSnapshot.create({
    company: companyId,
    snapshotDate: new Date(),
    funnel: funnelMap,
    metrics: {
      timeToHireDays: 24, // baseline default
      offerAcceptanceRate: 88,
      assessmentCompletionRate: 75,
      recruiterProductivityScore: 90
    },
    aiSpending: {
      totalTokens: aiCost.tokens,
      totalCostUSD: aiCost.cost
    }
  });
};

/**
 * Runs generative audits summarizing company pipeline performance via the AI Gateway.
 */
export const generateExecutiveReport = async (companyId, userId, reportType = 'monthly', context = {}) => {
  const latestSnapshot = await AnalyticsSnapshot.findOne({ company: companyId }).sort({ snapshotDate: -1 });
  if (!latestSnapshot) throw new AppError('Analytics snapshot not found. Please refresh dashboard metrics first.', 404);

  const metricsString = `Funnel: ${JSON.stringify(latestSnapshot.funnel)} | AI cost: $${latestSnapshot.aiSpending.totalCostUSD}`;
  const res = await invokeAIGateway('executive_analytics', { metricsLogs: metricsString }, context);
  const data = parseJSON(res, reportSchema);

  return await ExecutiveReport.create({
    company: companyId,
    snapshotDate: new Date(),
    reportType,
    aiSummary: data.aiSummary,
    forecasts: data.forecasts,
    riskAlerts: data.riskAlerts,
    recommendations: data.recommendations,
    createdBy: userId
  });
};

/**
 * Renders latest snapshot trends list.
 */
export const getDashboardAnalytics = async (companyId) => {
  const snapshot = await AnalyticsSnapshot.findOne({ company: companyId }).sort({ snapshotDate: -1 });
  if (!snapshot) return await generateAnalyticsSnapshot(companyId);
  return snapshot;
};
export const listExecutiveReports = async (companyId) => {
  return await ExecutiveReport.find({ company: companyId }).sort({ snapshotDate: -1 });
};
