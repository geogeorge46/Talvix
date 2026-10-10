import { Job } from '../models/Job.js';
import { Assessment } from '../models/Assessment.js';
import { Question } from '../models/Question.js';
import { AppError } from '../shared/errors/AppError.js';
import { generateAssessmentBlueprint, regenerateBlueprintSection, computeJobContentHash } from './ai.service.js';
import { assessmentBlueprintDataSchema } from '../validators/assessmentBlueprint.validator.js';

/**
 * Get stored assessment blueprint for a managed job.
 */
export const getJobBlueprintService = async (companyId, jobId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId }).select('title description blueprint status intelligence');
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const currentHash = computeJobContentHash(job.title, job.description);
  let blueprint = job.blueprint?.toObject ? job.blueprint.toObject() : (job.blueprint || { status: 'none' });

  if (['proposed', 'approved'].includes(blueprint.status) && blueprint.contentHash && blueprint.contentHash !== currentHash) {
    blueprint.status = 'stale';
  }

  return {
    jobId: job._id,
    jobTitle: job.title,
    jobStatus: job.status,
    blueprint
  };
};

/**
 * Generate or refresh assessment blueprint for a managed job.
 */
export const generateAndPersistBlueprint = async (companyId, jobId, options = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const currentHash = computeJobContentHash(job.title, job.description);

  if (
    !options.forceRefresh &&
    job.blueprint &&
    ['proposed', 'approved'].includes(job.blueprint.status) &&
    job.blueprint.contentHash === currentHash
  ) {
    return {
      jobId: job._id,
      cached: true,
      blueprint: job.blueprint
    };
  }

  job.blueprint = {
    schemaVersion: 1,
    promptVersion: 1,
    status: 'pending',
    generatedAt: new Date(),
    contentHash: currentHash,
    data: job.blueprint?.data || null,
    convertedAssessmentId: null,
    error: ''
  };
  await job.save();

  try {
    const context = {
      companyId,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent
    };

    const intelligenceData = job.intelligence?.data || null;
    const blueprintData = await generateAssessmentBlueprint(job.title, job.description, intelligenceData, context);

    job.blueprint = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'proposed',
      generatedAt: new Date(),
      contentHash: currentHash,
      data: blueprintData,
      convertedAssessmentId: null,
      error: ''
    };
    await job.save();

    return {
      jobId: job._id,
      cached: false,
      blueprint: job.blueprint
    };
  } catch (error) {
    job.blueprint = {
      schemaVersion: 1,
      promptVersion: 1,
      status: 'failed',
      generatedAt: new Date(),
      contentHash: currentHash,
      data: job.blueprint?.data || null,
      convertedAssessmentId: null,
      error: error.message || 'Blueprint generation failed'
    };
    await job.save();

    throw error;
  }
};

/**
 * Regenerate a specific blueprint section.
 */
export const regenerateSectionService = async (companyId, jobId, sectionId, customInstructions = '', options = {}) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job || !job.blueprint?.data?.sections) {
    throw new AppError('Job or blueprint not found', 404);
  }

  const sections = job.blueprint.data.sections;
  const targetIndex = sections.findIndex((s) => s.id === sectionId);
  if (targetIndex === -1) {
    throw new AppError(`Blueprint section '${sectionId}' not found`, 404);
  }

  const currentSection = sections[targetIndex];
  const newSection = await regenerateBlueprintSection(
    job.title,
    currentSection.title,
    currentSection.skillsEvaluated,
    customInstructions,
    { companyId, userId: options.userId }
  );

  sections[targetIndex] = { ...currentSection, ...newSection, id: currentSection.id };
  job.blueprint.data.sections = sections;
  job.markModified('blueprint.data');
  await job.save();

  return {
    jobId: job._id,
    blueprint: job.blueprint
  };
};

/**
 * Update blueprint fields edited by recruiter.
 */
export const updateJobBlueprintService = async (companyId, jobId, updateData) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job || !job.blueprint?.data) {
    throw new AppError('Job or blueprint not found', 404);
  }

  const merged = { ...job.blueprint.data, ...updateData };
  const validated = assessmentBlueprintDataSchema.parse(merged);

  job.blueprint.data = validated;
  job.markModified('blueprint.data');
  await job.save();

  return {
    jobId: job._id,
    blueprint: job.blueprint
  };
};

/**
 * Approve blueprint proposal.
 */
export const approveJobBlueprintService = async (companyId, jobId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job || !job.blueprint?.data) {
    throw new AppError('Job or blueprint not found', 404);
  }

  job.blueprint.status = 'approved';
  await job.save();

  return {
    jobId: job._id,
    blueprint: job.blueprint
  };
};

/**
 * Convert approved blueprint into official Talvix Assessment & Question documents.
 */
export const convertBlueprintToAssessmentService = async (companyId, jobId, userId) => {
  const job = await Job.findOne({ _id: jobId, company: companyId });
  if (!job || !job.blueprint?.data) {
    throw new AppError('Job or blueprint not found', 404);
  }

  if (job.blueprint.status !== 'approved' && job.blueprint.status !== 'proposed') {
    throw new AppError('Blueprint must be approved or proposed before conversion', 400);
  }

  const blueprintData = job.blueprint.data;
  const createdQuestionRefs = [];

  // Convert proposed questions or generate section questions into Question documents
  let questionOrder = 0;
  for (const section of blueprintData.sections || []) {
    const questionsToCreate = section.proposedQuestions && section.proposedQuestions.length > 0 
      ? section.proposedQuestions 
      : [{ prompt: `${section.title}: ${section.purpose}`, type: section.questionType, difficulty: section.difficulty }];

    for (const qData of questionsToCreate) {
      questionOrder += 1;
      const qType = section.questionType || 'multiple-choice';
      const qDifficulty = section.difficulty || 'medium';
      const defaultMarks = section.sectionMarks ? Math.round(section.sectionMarks / questionsToCreate.length) : 10;

      const createdQuestion = await Question.create({
        company: companyId,
        createdBy: userId,
        type: qType,
        title: `${section.title} Q${questionOrder}`,
        prompt: qData.prompt || `${section.title}: Evaluate ${section.skillsEvaluated?.join(', ')}`,
        skills: section.skillsEvaluated || [],
        difficulty: qDifficulty,
        defaultMarks: defaultMarks > 0 ? defaultMarks : 10,
        options: qData.options || (['single-choice', 'multiple-choice'].includes(qType) ? [
          { id: 'a', text: 'Option A' },
          { id: 'b', text: 'Option B' }
        ] : []),
        correctAnswer: ['single-choice', 'multiple-choice'].includes(qType) ? 'a' : null,
        isReusable: true,
        isActive: true
      });

      createdQuestionRefs.push({
        question: createdQuestion._id,
        marks: createdQuestion.defaultMarks,
        order: questionOrder,
        isRequired: true
      });
    }
  }

  // Create the Assessment document
  const assessment = await Assessment.create({
    company: companyId,
    createdBy: userId,
    title: `${job.title} Assessment Blueprint`,
    description: `Automated assessment suite generated from Job Blueprint. ${blueprintData.passCriteriaExplanation || ''}`,
    instructions: blueprintData.objectives?.join('\n') || 'Complete all assessment sections within the allocated duration.',
    type: 'mixed',
    skills: blueprintData.skillCoverage?.map((s) => s.skill) || [],
    durationMinutes: blueprintData.totalDurationMinutes || 60,
    totalMarks: blueprintData.totalMarks || 100,
    passingPercentage: blueprintData.recommendedPassingPercentage || 70,
    status: 'draft',
    questions: createdQuestionRefs
  });

  // Link assessment ID to job blueprint
  job.blueprint.status = 'converted';
  job.blueprint.convertedAssessmentId = assessment._id;
  await job.save();

  return {
    jobId: job._id,
    assessmentId: assessment._id,
    assessment,
    blueprint: job.blueprint
  };
};

/**
 * Ad-hoc preview blueprint generation for unpersisted job drafts.
 */
export const previewAssessmentBlueprint = async (title, description, context = {}) => {
  return await generateAssessmentBlueprint(title, description, null, context);
};
