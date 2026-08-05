import { invokeAIGateway } from './aiProvider.service.js';

/**
 * Generates a vector representation (embedding vector) of length 768 for text queries.
 */
export const generateEmbedding = async (text, context = {}) => {
  if (process.env.NODE_ENV === 'test') {
    // Generate a reproducible mock vector for tests
    const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const vector = Array.from({ length: 768 }, (_, i) => Math.sin(seed + i));
    return normalize(vector);
  }

  try {
    // Invoke gateway to get text embedding. If Gemini embedding model is not configured, fallback to mock.
    const res = await invokeAIGateway('text_embedding', { text }, context);
    const parsed = JSON.parse(res);
    if (Array.isArray(parsed) && parsed.length === 768) {
      return normalize(parsed);
    }
  } catch {
    // Fallback if provider fails
  }

  // Fallback mock vector
  const vector = Array.from({ length: 768 }, (_, i) => Math.cos(text.length + i));
  return normalize(vector);
};

/**
 * Normalizes a vector to unit length.
 */
const normalize = (vec) => {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map(val => val / norm);
};

/**
 * Computes cosine similarity between two normalized vectors.
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
};
