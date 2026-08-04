import { AssessmentBlueprint } from '../models/AssessmentBlueprint.js';
import { Assessment } from '../models/Assessment.js';
import { Question } from '../models/Question.js';
import { AppError } from '../shared/errors/AppError.js';
import { AuditLog } from '../models/AuditLog.js';

export const createBlueprint = async (company, actor, input) => {
  const blueprint = await AssessmentBlueprint.create({
    ...input,
    company,
    createdBy: actor
  });

  await AuditLog.create({
    action: 'BLUEPRINT_CREATED',
    actor,
    company,
    entityType: 'assessment-blueprint',
    entityId: blueprint.id
  });

  return blueprint;
};

export const getBlueprint = async (company, id) => {
  const blueprint = await AssessmentBlueprint.findOne({ _id: id, company });
  if (!blueprint) throw new AppError('Blueprint not found', 404);
  return blueprint;
};

export const updateBlueprint = async (company, id, input) => {
  const blueprint = await AssessmentBlueprint.findOne({ _id: id, company });
  if (!blueprint) throw new AppError('Blueprint not found', 404);

  blueprint.set(input);
  await blueprint.save();
  return blueprint;
};

export const deleteBlueprint = async (company, id) => {
  const blueprint = await AssessmentBlueprint.findOne({ _id: id, company });
  if (!blueprint) throw new AppError('Blueprint not found', 404);

  blueprint.isActive = false;
  await blueprint.save();
  return { success: true };
};

export const listBlueprints = async (company, query = {}) => {
  const filter = { company, isActive: true };
  if (query.search) {
    filter.name = { $regex: query.search, $options: 'i' };
  }
  return AssessmentBlueprint.find(filter).sort({ createdAt: -1 });
};

export const cloneBlueprint = async (company, id, actor) => {
  const original = await getBlueprint(company, id);
  const clonedData = original.toObject();
  delete clonedData._id;
  delete clonedData.createdAt;
  delete clonedData.updatedAt;

  clonedData.name = `${clonedData.name} (Copy)`;
  clonedData.createdBy = actor;
  clonedData.version = 1;

  const copy = await AssessmentBlueprint.create(clonedData);

  await AuditLog.create({
    action: 'BLUEPRINT_CLONED',
    actor,
    company,
    entityType: 'assessment-blueprint',
    entityId: copy.id,
    details: { originalId: original.id }
  });

  return copy;
};

/**
 * Dynamically generate a brand new Assessment from an AssessmentBlueprint configuration.
 * Selects matching questions from the company pool matching type/difficulty/skills.
 */
export const generateAssessmentFromBlueprint = async (company, blueprintId, actor) => {
  const blueprint = await getBlueprint(company, blueprintId);
  
  const assessmentQuestions = [];
  let orderIndex = 0;

  for (const sec of blueprint.sections) {
    const query = { company, type: sec.type, isActive: true };
    
    if (sec.difficulty && sec.difficulty !== 'mixed') {
      query.difficulty = sec.difficulty;
    }
    
    if (sec.skills && sec.skills.length > 0) {
      query.skills = { $in: sec.skills };
    }

    let candidates = await Question.find(query);
    
    // Fallback: If not enough matching questions found, search by type only
    if (candidates.length < sec.questionCount) {
      candidates = await Question.find({ company, type: sec.type, isActive: true });
    }

    if (candidates.length < sec.questionCount) {
      throw new AppError(`Not enough matching questions found in company pool for section: ${sec.name} (needed ${sec.questionCount}, found ${candidates.length})`, 400);
    }

    // Shuffle and pick section questions
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, sec.questionCount);

    // Calculate marks per question
    const defaultMarks = sec.weight || 10;

    for (const question of picked) {
      assessmentQuestions.push({
        question: question.id,
        marks: defaultMarks,
        order: orderIndex++,
        isRequired: true
      });
    }
  }

  const assessment = await Assessment.create({
    company,
    createdBy: actor,
    title: `${blueprint.name} - Generated`,
    description: blueprint.description,
    type: 'mixed',
    durationMinutes: blueprint.defaultDuration,
    passingPercentage: blueprint.passingScore,
    status: 'draft',
    questions: assessmentQuestions,
    shuffleQuestions: blueprint.settings?.shuffleQuestions ?? false,
    shuffleOptions: blueprint.settings?.shuffleOptions ?? false,
    showResultImmediately: blueprint.settings?.showResultImmediately ?? false,
    allowBackNavigation: blueprint.settings?.allowBackNavigation ?? true
  });

  await AuditLog.create({
    action: 'ASSESSMENT_GENERATED_FROM_BLUEPRINT',
    actor,
    company,
    entityType: 'assessment',
    entityId: assessment.id,
    details: { blueprintId: blueprint.id }
  });

  return assessment;
};
