import { AppError } from '../shared/errors/AppError.js';

/**
 * Extracts and parses JSON from raw LLM responses.
 * Optionally validates the parsed output against a Zod schema.
 */
export const parseJSON = (text, schema = null) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AppError('Empty or invalid AI response received', 502);
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

  // 2. Extract from markdown code block if present (e.g. ```json or ```)
  let cleanText = text.trim();
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleanText.match(codeBlockRegex);
  if (match && match[1]) {
    cleanText = match[1].trim();
  } else {
    // Find matching bounds for either object {...} or array [...]
    const firstObj = cleanText.indexOf('{');
    const lastObj = cleanText.lastIndexOf('}');
    const firstArr = cleanText.indexOf('[');
    const lastArr = cleanText.lastIndexOf(']');

    const hasObj = firstObj !== -1 && lastObj > firstObj;
    const hasArr = firstArr !== -1 && lastArr > firstArr;

    if (hasObj && (!hasArr || firstObj < firstArr)) {
      cleanText = cleanText.substring(firstObj, lastObj + 1);
    } else if (hasArr) {
      cleanText = cleanText.substring(firstArr, lastArr + 1);
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
