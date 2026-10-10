import { TechnicalSubmission } from '../models/TechnicalSubmission.js';

export const saveSystemDesignSubmission = async ({ attempt, questionId, candidate, assessment, assignment, systemDesignInput, isFinal = false }) => {
  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt, question: questionId },
    {
      assessment,
      assignment,
      attempt,
      question: questionId,
      candidate,
      type: 'work-sample',
      subtype: 'system-design',
      systemDesign: {
        nodes: systemDesignInput.nodes || [],
        edges: systemDesignInput.edges || [],
        databaseSchema: systemDesignInput.databaseSchema || [],
        apis: systemDesignInput.apis || [],
        explanation: systemDesignInput.explanation || {},
      },
      status: isFinal ? 'submitted' : 'draft',
      ...(isFinal && { submittedAt: new Date() }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return sub;
};
