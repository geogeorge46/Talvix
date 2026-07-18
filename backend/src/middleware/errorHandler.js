import { AppError } from '../shared/errors/AppError.js';
import { logger } from '../shared/utils/logger.js';

export const errorHandler = (error, request, response, next) => {
  if (response.headersSent) {
    return next(error);
  }

  const isOperational = error instanceof AppError && error.isOperational;
  const statusCode = isOperational ? error.statusCode : 500;
  const message = isOperational ? error.message : 'Internal server error';

  if (!isOperational) {
    logger.error(`Unexpected error during ${request.method} ${request.originalUrl}`, error);
  }

  const body = { success: false, message };

  if (isOperational && error.details !== undefined) {
    body.details = error.details;
  }

  return response.status(statusCode).json(body);
};
