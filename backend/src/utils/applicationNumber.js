import { Counter } from '../models/Counter.js';

/** Generates a concurrency-safe, human-readable application number. */
export const generateApplicationNumber = async (session) => {
  const year = new Date().getUTCFullYear();
  const counter = await Counter.findOneAndUpdate(
    { _id: `application-${year}` }, { $inc: { sequence: 1 } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, session },
  );
  return `TVX-APP-${year}-${String(counter.sequence).padStart(6, '0')}`;
};
