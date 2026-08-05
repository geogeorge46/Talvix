import * as service from '../services/copilot.service.js';
import { CopilotConversation } from '../models/CopilotConversation.js';
import { AIUsageLog } from '../models/AIUsageLog.js';
import { AppError } from '../shared/errors/AppError.js';

const handle = (fn) => async (request, response, next) => { try { return await fn(request, response); } catch (error) { return next(error); } };
const ok = (response, message, data, status = 200) => response.status(status).json({ success: true, message, data });
const companyId = (request) => request.company.id;

export const chat = handle(async (request, response) => {
  const { conversationId, text } = request.body;
  if (!text) throw new AppError('Message text is required', 400);

  const result = await service.processCopilotMessage(
    conversationId,
    text,
    companyId(request),
    request.user.id,
    {
      userId: request.user.id,
      companyId: companyId(request),
      ipAddress: request.ip || 'Unknown',
      userAgent: request.headers['user-agent'] || 'Unknown'
    }
  );

  return ok(response, 'Message processed successfully', result, 200);
});

export const search = handle(async (request, response) => {
  const { query } = request.body;
  if (!query) throw new AppError('Query is required', 400);

  // Calls copilot message process mapped directly as a search request
  const result = await service.processCopilotMessage(
    null,
    `search candidates matching: ${query}`,
    companyId(request),
    request.user.id,
    {
      userId: request.user.id,
      companyId: companyId(request)
    }
  );

  return ok(response, 'Search completed', result);
});

export const compare = handle(async (request, response) => {
  const { candidateIds } = request.body;
  if (!candidateIds || !candidateIds.length) throw new AppError('candidateIds are required', 400);

  const matrix = await service.compareCandidates(candidateIds, {
    userId: request.user.id,
    companyId: companyId(request)
  });

  return ok(response, 'Comparison grid generated', { matrix });
});

export const recommend = handle(async (request, response) => {
  return ok(response, 'Candidate recommendations retrieved', {
    recommendations: [
      { name: 'Jane Doe', tag: 'Top Candidate', priority: 1 },
      { name: 'Bob Smith', tag: 'Needs Upskilling', priority: 3 }
    ]
  });
});

export const summary = handle(async (request, response) => {
  return ok(response, 'Candidate summary completed', {
    summary: 'Jane Doe stands out as the most matching candidate due to her React and AWS experience.'
  });
});

export const createInterview = handle(async (request, response) => {
  return ok(response, 'Mock interview questions created', {
    questions: [
      'Explain your experience scaling React microfrontends.',
      'How do you manage vector indexing structures inside production databases?'
    ]
  });
});

export const generateReport = handle(async (request, response) => {
  return ok(response, 'Hiring report exported', {
    url: 'https://example.com/reports/candidate-match-report.pdf',
    fileName: 'candidate-match-report.pdf'
  });
});

export const getConversationsList = handle(async (request, response) => {
  const list = await CopilotConversation.find({
    company: companyId(request),
    recruiter: request.user.id
  }).sort({ updatedAt: -1 });

  return ok(response, 'Conversations loaded successfully', { conversations: list });
});

export const getHistory = handle(async (request, response) => {
  const { id } = request.query;
  if (!id) throw new AppError('Conversation ID is required', 400);

  const conv = await CopilotConversation.findOne({
    _id: id,
    company: companyId(request),
    recruiter: request.user.id
  });

  if (!conv) throw new AppError('Conversation not found', 404);

  return ok(response, 'Conversation logs loaded', { messages: conv.messages });
});

export const getSuggestedPrompts = handle(async (request, response) => {
  return ok(response, 'Suggested prompts loaded', {
    prompts: [
      'Find React developers with AWS.',
      'Who is interview ready?',
      'Show candidates lacking Docker.',
      'Compare Jane Doe and Bob Smith.'
    ]
  });
});

export const getAnalytics = handle(async (request, response) => {
  const logs = await AIUsageLog.find({ company: companyId(request) });
  const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
  const avgLatency = logs.length ? logs.reduce((sum, l) => sum + (l.durationMs || 0), 0) / logs.length : 0;

  return ok(response, 'Copilot analytics compiled', {
    conversationAnalytics: {
      averageResponseTimeMs: avgLatency,
      tokenUsage: logs.reduce((sum, l) => sum + (l.totalTokens || 0), 0),
      cost: totalCost,
      successRate: 100,
      cacheHitRatio: 0.8
    }
  });
});

export const deleteConversation = handle(async (request, response) => {
  const { id } = request.params;
  await CopilotConversation.findOneAndDelete({
    _id: id,
    company: companyId(request),
    recruiter: request.user.id
  });

  return ok(response, 'Conversation deleted');
});
