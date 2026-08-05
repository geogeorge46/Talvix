import { AppError } from '../shared/errors/AppError.js';

/**
 * Extracts and parses JSON from raw LLM responses.
 * Optionally validates the parsed output against a Zod schema.
 */
export const parseJSON = (text, schema = null) => {
  if (!text || typeof text !== 'string') {
    throw new AppError('Empty or invalid AI response received', 500);
  }

  // 1. Try simple parse first
  try {
    const data = JSON.parse(text.trim());
    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        throw new AppError(`AI response failed schema validation: ${parsed.error.message}`, 422, parsed.error.format());
      }
      return parsed.data;
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
  }

  // 2. Extract from markdown code block if present
  let cleanText = text;
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonBlockRegex);
  if (match && match[1]) {
    cleanText = match[1];
  } else {
    // Find matching bounds
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      cleanText = text.substring(startIdx, endIdx + 1);
    }
  }

  try {
    const data = JSON.parse(cleanText.trim());
    if (schema) {
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        throw new AppError(`AI response failed schema validation: ${parsed.error.message}`, 422, parsed.error.format());
      }
      return parsed.data;
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to parse JSON from AI response', 502, { rawOutput: text });
  }
};
