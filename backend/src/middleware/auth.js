import { User } from '../models/User.js';
import { AppError } from '../shared/errors/AppError.js';
import { verifyAccessToken } from '../utils/jwt.js';

/** Verifies the bearer access token and attaches its active user to the request. */
export const authenticate = async (request, _response, next) => {
  try {
    let token = null;
    const authorization = request.get('authorization');

    if (authorization?.startsWith('Bearer ')) {
      token = authorization.slice(7).trim();
    } else if (request.query.token) {
      token = request.query.token;
    }

    if (!token) {
      throw new AppError('Authentication required', 401);
    }
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
