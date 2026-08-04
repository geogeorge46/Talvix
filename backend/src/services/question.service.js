import { Question } from '../models/Question.js';
import { QuestionRevision } from '../models/QuestionRevision.js';
import { AppError } from '../shared/errors/AppError.js';
import { buildPagination, createSafeRegex } from '../utils/pagination.js';
import { AuditLog } from '../models/AuditLog.js';

const companyQuestion = async (company, id, privateFields = false) => {
  let query = Question.findOne({ _id: id, company });
  if (privateFields) query = query.select('+correctAnswer +explanation');
  const question = await query;
  if (!question) throw new AppError('Question not found', 404);
  return question;
};

export const createQuestion = (company, actor, input) => {
  return Question.create({
    ...input,
    company,
    createdBy: actor
  });
};

export const getQuestion = (company, id) => companyQuestion(company, id, true);

export const listQuestions = async (company, query) => {
  const filter = { company };
  
  if (query.search) {
    const regex = createSafeRegex(query.search);
    filter.$or = [{ title: regex }, { prompt: regex }];
  }
  
  if (query.type) filter.type = query.type;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.category) filter.category = query.category;
  if (query.topic) filter.topic = query.topic;
  
  if (query.skills?.length) {
    filter.skills = { $all: query.skills.map(createSafeRegex) };
  }
  
  if (query.active !== undefined) filter.isActive = query.active;
  if (query.reusable !== undefined) filter.isReusable = query.reusable;
  
  if (query.favoritesOnly && query.userId) {
    filter.favorites = query.userId;
  }

  const sorts = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    difficulty: { difficulty: 1 },
    'usage-high': { usageCount: -1 },
    'usage-low': { usageCount: 1 }
  };

  const page = parseInt(query.page || 1, 10);
  const limit = parseInt(query.limit || 10, 10);

  const [questions, total] = await Promise.all([
    Question.find(filter)
      .select('+correctAnswer +explanation')
      .sort(sorts[query.sort || 'newest'])
      .skip((page - 1) * limit)
      .limit(limit),
    Question.countDocuments(filter)
  ]);

  return {
    questions,
    pagination: buildPagination(page, limit, total)
  };
};

/**
 * Update a question.
 * If the question is already used (usageCount > 0), editing creates a new version (cloned document)
 * and keeps the old one immutable.
 */
export const updateQuestion = async (company, id, input, actor) => {
  const question = await companyQuestion(company, id, true);

  if (question.usageCount > 0) {
    // 1. Create a revision log for the current version
    await QuestionRevision.create({
      question: question.parentQuestion || question.id,
      version: question.version,
      content: question.toObject(),
      changeLog: input.changeLog || `Created version ${question.version}`,
      createdBy: actor
    });

    // 2. Clone to a new version document representing version V+1
    const clonedData = question.toObject();
    delete clonedData._id;
    delete clonedData.createdAt;
    delete clonedData.updatedAt;

    const nextVersion = question.version + 1;
    const parentQuestion = question.parentQuestion || question.id;

    const cloned = await Question.create({
      ...clonedData,
      ...input,
      parentQuestion,
      version: nextVersion,
      usageCount: 0,
      createdBy: actor
    });

    await AuditLog.create({
      action: 'QUESTION_VERSION_CREATED',
      actor,
      company,
      entityType: 'question',
      entityId: cloned.id,
      details: { parentQuestion, version: nextVersion }
    });

    return cloned;
  }

  // Update in-place if never used
  question.set(input);
  await question.save();

  await AuditLog.create({
    action: 'QUESTION_UPDATED',
    actor,
    company,
    entityType: 'question',
    entityId: question.id
  });

  return question;
};

export const deactivateQuestion = async (company, id) => {
  const question = await companyQuestion(company, id);
  question.isActive = false;
  await question.save();
  return question;
};

export const cloneQuestion = async (company, id, actor) => {
  const source = await companyQuestion(company, id, true);
  const data = source.toObject();
  for (const key of ['_id', 'createdAt', 'updatedAt', 'parentQuestion', 'version']) {
    delete data[key];
  }
  return Question.create({
    ...data,
    title: `${source.title || 'Question'} (Copy)`,
    createdBy: actor,
    usageCount: 0,
    isActive: true,
    version: 1
  });
};

/**
 * Rollback a question to a previous version.
 */
export const rollbackQuestionVersion = async (company, questionId, version, actor) => {
  const question = await companyQuestion(company, questionId, true);
  
  // Find historical content from revisions
  const revision = await QuestionRevision.findOne({
    question: question.parentQuestion || question.id,
    version
  });

  if (!revision) {
    throw new AppError(`Revision version ${version} not found`, 404);
  }

  const rolledContent = { ...revision.content };
  delete rolledContent._id;
  delete rolledContent.version;
  delete rolledContent.createdAt;
  delete rolledContent.updatedAt;

  // Use updateQuestion wrapper to trigger version cloning if needed
  return updateQuestion(company, questionId, {
    ...rolledContent,
    changeLog: `Rollback to version ${version}`
  }, actor);
};

/**
 * Compare differences between two question versions.
 */
export const compareQuestionVersions = async (company, questionId, versionA, versionB) => {
  const question = await companyQuestion(company, questionId, true);
  const parentId = question.parentQuestion || question.id;

  const [revA, revB] = await Promise.all([
    QuestionRevision.findOne({ question: parentId, version: versionA }),
    QuestionRevision.findOne({ question: parentId, version: versionB })
  ]);

  const contentA = revA ? revA.content : (question.version === versionA ? question.toObject() : null);
  const contentB = revB ? revB.content : (question.version === versionB ? question.toObject() : null);

  if (!contentA || !contentB) {
    throw new AppError('One of the compared versions could not be found', 404);
  }

  return { versionA: contentA, versionB: contentB };
};

/**
 * Toggle favorite status.
 */
export const toggleFavorite = async (company, questionId, userId) => {
  const question = await companyQuestion(company, questionId);
  const index = question.favorites.indexOf(userId);
  if (index >= 0) {
    question.favorites.splice(index, 1);
  } else {
    question.favorites.push(userId);
  }
  await question.save();
  return { isFavorite: question.favorites.includes(userId) };
};

/**
 * Bulk Import questions.
 */
export const bulkImport = async (company, questionsList, actor) => {
  const formatted = questionsList.map(q => ({
    ...q,
    company,
    createdBy: actor,
    version: 1
  }));
  const inserted = await Question.insertMany(formatted);

  await AuditLog.create({
    action: 'QUESTIONS_BULK_IMPORTED',
    actor,
    company,
    entityType: 'question',
    details: { count: inserted.length }
  });

  return inserted;
};

/**
 * Bulk Export questions.
 */
export const bulkExport = async (company, query = {}) => {
  const filter = { company, isActive: true };
  if (query.category) filter.category = query.category;
  if (query.type) filter.type = query.type;
  return Question.find(filter).select('+correctAnswer +explanation');
};
