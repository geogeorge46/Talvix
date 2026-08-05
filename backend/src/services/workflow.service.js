import { Workflow } from '../models/Workflow.js';
import { WorkflowVersion } from '../models/WorkflowVersion.js';
import { WorkflowExecution } from '../models/WorkflowExecution.js';
import { WorkflowNodeExecution } from '../models/WorkflowNodeExecution.js';
import { AppError } from '../shared/errors/AppError.js';

export const createWorkflow = async (name, trigger, nodes, edges, companyId, userId) => {
  return await Workflow.create({
    company: companyId,
    name,
    trigger,
    nodes,
    edges,
    status: 'draft',
    createdBy: userId
  });
};

export const executeWorkflow = async (workflowId, trigger, initialPayload, companyId, _userId) => {
  const workflow = await Workflow.findOne({ _id: workflowId, company: companyId });
  if (!workflow) throw new AppError('Workflow not found', 404);

  const execution = await WorkflowExecution.create({
    workflow: workflowId,
    trigger,
    status: 'running',
    executionLog: [`Execution started for trigger ${trigger}`]
  });

  const nodes = workflow.nodes || [];
  let tokenSum = 0;
  let costSum = 0;

  for (const node of nodes) {
    const nodeExec = await WorkflowNodeExecution.create({
      workflowExecution: execution._id,
      nodeId: node.id,
      status: 'running',
      inputs: initialPayload
    });

    try {
      // Mock execution mapping for actions (like parse, score, or invoke LLM)
      const output = { success: true, processedAt: new Date() };
      
      nodeExec.status = 'success';
      nodeExec.outputs = output;
      await nodeExec.save();

      execution.executionLog.push(`Successfully completed node ${node.id}`);
      tokenSum += 1000;
      costSum += 0.15;
    } catch (err) {
      nodeExec.status = 'failed';
      nodeExec.outputs = { error: err.message };
      await nodeExec.save();

      execution.status = 'failed';
      execution.executionLog.push(`Node ${node.id} execution failed: ${err.message}`);
      await execution.save();
      return execution;
    }
  }

  execution.status = 'completed';
  execution.completedAt = new Date();
  execution.tokenUsage = tokenSum;
  execution.aiCost = costSum;
  await execution.save();

  return execution;
};

export const publishWorkflow = async (workflowId, companyId, userId) => {
  const workflow = await Workflow.findOne({ _id: workflowId, company: companyId });
  if (!workflow) throw new AppError('Workflow not found', 404);

  const currentVersion = workflow.activeVersion || 1;
  const nextVersion = currentVersion + 1;

  await WorkflowVersion.create({
    workflow: workflowId,
    version: currentVersion,
    graph: {
      nodes: workflow.nodes,
      edges: workflow.edges
    },
    createdBy: userId
  });

  workflow.activeVersion = nextVersion;
  workflow.published = true;
  workflow.status = 'active';
  await workflow.save();

  return workflow;
};

export const listWorkflows = async (companyId) => {
  return await Workflow.find({ company: companyId });
};

export const getWorkflowExecutions = async (workflowId) => {
  return await WorkflowExecution.find({ workflow: workflowId }).sort({ createdAt: -1 });
};
