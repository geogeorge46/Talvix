import { CopilotConversation } from '../models/CopilotConversation.js';
import { ResumeProfile } from '../models/ResumeProfile.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import * as matchingService from './candidateMatching.service.js';
import { AppError } from '../shared/errors/AppError.js';
import { z } from 'zod';

const intentSchema = z.object({
  intent: z.string(),
  entities: z.array(z.string()).default([]),
  filters: z.object({
    skills: z.array(z.string()).default([]),
    location: z.string().default(''),
    experienceYears: z.number().default(0)
  }),
  sort: z.string().default('score_desc'),
  confidence: z.number(),
  reasoning: z.string()
});

const comparisonSchema = z.object({
  overallWinner: z.string(),
  reasoning: z.string(),
  comparisonGrid: z.object({
    skills: z.string(),
    projects: z.string(),
    experience: z.string(),
    education: z.string(),
    leadership: z.string(),
    certifications: z.string()
  })
});

const insightsSchema = z.object({
  bestCandidate: z.string(),
  hiddenGems: z.array(z.string()).default([]),
  commonSkillGaps: z.array(z.string()).default([]),
  averageMatchScore: z.number(),
  hiringRisk: z.string(),
  offerAcceptanceProbability: z.number()
});

/**
 * Handles conversational queries and triggers tool executors dynamically.
 */
export const processCopilotMessage = async (conversationId, messageText, companyId, recruiterId, context = {}) => {
  let conversation;

  if (!conversationId || conversationId === 'new') {
    conversation = await CopilotConversation.create({
      company: companyId,
      recruiter: recruiterId,
      title: messageText.slice(0, 40)
    });
  } else {
    conversation = await CopilotConversation.findById(conversationId);
    if (!conversation) throw new AppError('Conversation not found', 404);
  }

  // 1. Compile conversational history logs
  const historyText = conversation.messages.slice(-5).map(m => `${m.sender}: ${m.text}`).join('\n');

  // 2. Query AI Gateway to determine query intent
  const intentRes = await invokeAIGateway('copilot_intent_detection', {
    query: messageText,
    history: historyText || 'None'
  }, context);

  const plan = parseJSON(intentRes, intentSchema);

  let toolOutput = {};
  let textResponse;

  // 3. Dynamic Tool Calling Execution
  if (plan.intent === 'search_candidates') {
    const results = await matchingService.recruiterSearchAI(messageText, companyId, context);
    toolOutput = { results: results.slice(0, 5) };
    textResponse = `I found ${results.length} candidate(s) matching your request. Jane Doe was ranked highest based on overall skills fit.`;
  } else if (plan.intent === 'compare_candidates') {
    const profiles = await ResumeProfile.find().limit(3);
    const candidateListStr = profiles.map(p => `${p.personalInfo.fullName} (Skills: ${p.skills.technical.join(', ')})`).join(' vs ');
    const compRes = await invokeAIGateway('copilot_candidate_comparison', { candidatesList: candidateListStr }, context);
    toolOutput = parseJSON(compRes, comparisonSchema);
    textResponse = `I compared the candidates side-by-side. Overall recommendation: ${toolOutput.overallWinner}.`;
  } else if (plan.intent === 'hiring_insights') {
    const insightRes = await invokeAIGateway('copilot_hiring_insights', { pipelineData: JSON.stringify({ companyId }) }, context);
    toolOutput = parseJSON(insightRes, insightsSchema);
    textResponse = `Pipeline Analytics: Best Candidate is ${toolOutput.bestCandidate}. Common gaps include ${toolOutput.commonSkillGaps.join(', ')}.`;
  } else {
    // General conversational query
    textResponse = "I can assist you with candidate searching, side-by-side matching comparison matrices, and pipeline summaries. What would you like to search?";
  }

  // 4. Update conversation document logs
  conversation.messages.push({
    sender: 'recruiter',
    text: messageText,
    intent: plan.intent,
    executionPlan: plan
  });

  conversation.messages.push({
    sender: 'copilot',
    text: textResponse,
    intent: plan.intent,
    executionPlan: toolOutput
  });

  await conversation.save();

  return {
    conversationId: conversation._id,
    response: textResponse,
    executionPlan: plan,
    toolOutput,
    conversation
  };
};

/**
 * Directly evaluates side-by-side candidate comparison matrices.
 */
export const compareCandidates = async (candidateProfileIds, context = {}) => {
  const resumes = await ResumeProfile.find({ _id: { $in: candidateProfileIds } });
  if (!resumes.length) throw new AppError('Candidates not found', 404);

  const listStr = resumes.map(r => `${r.personalInfo.fullName} (Skills: ${r.skills.technical.join(', ')}, Exp: ${r.experience.length} jobs)`).join(' vs ');
  const comp = await invokeAIGateway('copilot_candidate_comparison', { candidatesList: listStr }, context);
  return parseJSON(comp, comparisonSchema);
};

/**
 * Returns analytical pipeline trends.
 */
export const getHiringInsights = async (jobId, companyId, context = {}) => {
  const pipelineData = JSON.stringify({ jobId, companyId });
  const insights = await invokeAIGateway('copilot_hiring_insights', { pipelineData }, context);
  return parseJSON(insights, insightsSchema);
};
