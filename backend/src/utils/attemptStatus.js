import { AppError } from '../shared/errors/AppError.js';
const transitions = { 'not-started': ['in-progress'], 'in-progress': ['submitted', 'expired'], submitted: ['auto-evaluated', 'review-pending'], 'auto-evaluated': ['completed'], 'review-pending': ['completed'], completed: [], expired: [], cancelled: [] };
export const assertAttemptTransition = (from, to) => { if (!transitions[from]?.includes(to)) throw new AppError(`Attempt cannot transition from ${from} to ${to}`, 409); };
