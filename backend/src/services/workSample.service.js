import { TechnicalSubmission } from '../models/TechnicalSubmission.js';

export const saveWorkSampleSubmission = async ({ attempt, questionId, candidate, assessment, assignment, workSampleInput, isFinal = false }) => {
  const sub = await TechnicalSubmission.findOneAndUpdate(
    { attempt, question: questionId },
    {
      assessment,
      assignment,
      attempt,
      question: questionId,
      candidate,
      type: 'work-sample',
      subtype: workSampleInput.subtype || 'mini-project',
      workSample: {
        submissionType: workSampleInput.submissionType || 'github',
        repositoryUrl: workSampleInput.repositoryUrl || '',
        branch: workSampleInput.branch || 'main',
        hostedUrl: workSampleInput.hostedUrl || '',
        fileUrl: workSampleInput.fileUrl || '',
        fileSize: workSampleInput.fileSize || 0,
        textResponse: workSampleInput.textResponse || '',
      },
      status: isFinal ? 'submitted' : 'draft',
      ...(isFinal && { submittedAt: new Date() }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return sub;
};
