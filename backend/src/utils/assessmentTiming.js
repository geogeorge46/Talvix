export const getEffectiveAttemptExpiry = (startedAt, durationMinutes, assignmentExpiry) => new Date(Math.min(new Date(startedAt).getTime() + durationMinutes * 60000, new Date(assignmentExpiry).getTime()));
export const isAttemptExpired = (attempt, now = new Date()) => Boolean(attempt.expiresAt && new Date(attempt.expiresAt) <= now);
export const getRemainingSeconds = (attempt, now = new Date()) => Math.max(0, Math.ceil((new Date(attempt.expiresAt).getTime() - now.getTime()) / 1000));
