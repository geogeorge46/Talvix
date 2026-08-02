import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/** Verifies the bearer access token and attaches its active user to the request. */
export const authenticate = async (request, _response, next) => {
  try {
    const authorization = request.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authorization.slice(7).trim();
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select('+isActive +tokenVersion +blocked');

    if (!user || user.blocked || !user.isActive || (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion)) {
      throw new AppError('Authentication required', 401);
    }

    request.user = user;
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError('Invalid or expired access token', 401));
  }
};
