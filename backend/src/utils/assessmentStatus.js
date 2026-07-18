import { AppError } from '../shared/errors/AppError.js';
const assessmentTransitions = { draft: ['published', 'archived'], published: ['archived'], archived: [] };
const assignmentTransitions = { assigned: ['available', 'in-progress', 'expired', 'cancelled'], available: ['in-progress', 'expired', 'cancelled'], 'in-progress': ['submitted', 'cancelled'], submitted: ['evaluating', 'completed'], evaluating: ['completed'], completed: [], expired: [], cancelled: [] };
export const assertAssessmentTransition = (from, to) => { if (!assessmentTransitions[from]?.includes(to)) throw new AppError(`Assessment cannot transition from ${from} to ${to}`, 409); };
export const assertAssignmentTransition = (from, to) => { if (!assignmentTransitions[from]?.includes(to)) throw new AppError(`Assignment cannot transition from ${from} to ${to}`, 409); };
