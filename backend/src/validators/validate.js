import { AppError } from '../shared/errors/AppError.js';

const issues = (error) => error.issues.map((issue) => ({ field: issue.path.join('.') || 'request', message: issue.message }));
const validate = (source, target) => (schema) => (request, _response, next) => {
  const result = schema.safeParse(request[source]);
  if (!result.success) return next(new AppError('Validation failed', 400, issues(result.error)));
  request[target] = result.data;
  return next();
};

export const validateBody = validate('body', 'body');
export const validateParams = validate('params', 'params');
export const validateQuery = validate('query', 'validatedQuery');
