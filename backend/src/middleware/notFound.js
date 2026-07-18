import { AppError } from '../shared/errors/AppError.js';

export const notFound = (_request, _response, next) => {
  next(new AppError('Route not found', 404));
};
