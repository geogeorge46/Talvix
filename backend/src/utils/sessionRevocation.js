import { User } from '../models/User.js';
import { RefreshSession } from '../models/RefreshSession.js';

/**
 * Revokes all active sessions for a user by incrementing tokenVersion 
 * and invalidating all active refresh sessions.
 */
export const revokeUserSessions = async (userId) => {
  await Promise.all([
    User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } }),
    RefreshSession.updateMany({ userId, isActive: true }, { $set: { isActive: false } }),
  ]);
};
