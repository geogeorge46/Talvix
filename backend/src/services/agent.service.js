import { AgentMemory } from '../models/AgentMemory.js';
import { invokeAIGateway } from './aiProvider.service.js';
import { parseJSON } from './jsonParser.service.js';
import { z } from 'zod';

const agentResponseSchema = z.object({
  decision: z.string(),
  justification: z.string(),
  riskScore: z.number().default(0),
  nextSteps: z.array(z.string()).default([])
});

/**
 * Autonomous Recruiting and Interviewing agents execution loop.
 */
export const executeAgentTask = async (agentType, instruction, companyId, userId, context = {}) => {
  let memory = await AgentMemory.findOne({ company: companyId, recruiter: userId });
  if (!memory) {
    memory = await AgentMemory.create({
      company: companyId,
      recruiter: userId,
      context: 'Initial recruiter agent memory base.',
      recentActions: []
    });
  }

  const memoryString = `Context: ${memory.context}. Recent: ${memory.recentActions.join(', ')}`;
  const res = await invokeAIGateway('agent_execution', { instruction, memoryContext: memoryString }, context);
  const data = parseJSON(res, agentResponseSchema);

  // Update memory
  memory.recentActions.push(data.decision);
  if (memory.recentActions.length > 5) memory.recentActions.shift();
  await memory.save();

  return {
    agentType,
    ...data
  };
};
