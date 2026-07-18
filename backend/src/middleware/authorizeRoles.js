import { AppError } from '../shared/errors/AppError.js';

/** Restricts an authenticated route to the supplied trusted roles. */
export const authorizeRoles = (...allowedRoles) => (request, _response, next) => {
  if (!request.user || !allowedRoles.includes(request.user.role)) {
    return next(new AppError('You are not authorized to perform this action', 403));
  }

  return next();
};
