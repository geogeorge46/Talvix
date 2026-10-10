import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIProvider } from '../src/models/AIProvider.js';
import { AIConfiguration } from '../src/models/AIConfiguration.js';
import { AIPrompt } from '../src/models/AIPrompt.js';
import { AIUsageLog } from '../src/models/AIUsageLog.js';
import { AICache } from '../src/models/AICache.js';
import { invokeAIGateway, normalizeModel } from '../src/services/aiProvider.service.js';
import { executeWithRetry } from '../src/services/retry.service.js';
import { AppError } from '../src/shared/errors/AppError.js';

let replicaSet;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replicaSet.getUri());
});

beforeEach(async () => {
  await Promise.all([
    AIProvider.deleteMany({}),
    AIConfiguration.deleteMany({}),
    AIPrompt.deleteMany({}),
    AIUsageLog.deleteMany({}),
    AICache.deleteMany({})
  ]);

  await AIConfiguration.create({
    company: null,
    primaryProvider: 'gemini',
    fallbackProvider: 'openrouter',
    cachingEnabled: false,
    retryCount: 1,
    retryBackoffMs: 1
  });

  await AIProvider.create([
    {
      name: 'gemini',
      displayName: 'Google Gemini',
      apiKey: 'test-api-key-gemini-12345',
      isActive: true,
      costPerInputToken: 0.000002,
      costPerOutputToken: 0.000006
    },
    {
      name: 'openrouter',
      displayName: 'OpenRouter',
      apiKey: 'test-api-key-openrouter-12345',
      isActive: true,
      costPerInputToken: 0.000002,
      costPerOutputToken: 0.000006
    }
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet.stop();
});

describe('AI Provider Resilience & Fallback Tests', () => {

  describe('Model ID Normalization', () => {
    it('normalizes hallucinated/invalid model IDs to official supported model names', () => {
      expect(normalizeModel('gemini', 'gemini-3.6-flash-medium')).toBe('gemini-2.5-flash');
      expect(normalizeModel('gemini', 'invalid-model-name')).toBe('gemini-2.5-flash');
      expect(normalizeModel('gemini', 'gemini-2.5-pro')).toBe('gemini-2.5-pro');
      expect(normalizeModel('openrouter', 'gemini-3.6-flash-medium')).toBe('google/gemini-2.5-flash');
      expect(normalizeModel('openrouter', 'google/gemini-2.0-flash-exp:free')).toBe('google/gemini-2.5-flash');
    });
  });

  describe('Retry Mechanism with Jitter and Backoff', () => {
    it('retries transient 503 errors with exponential backoff and succeeds', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          const err = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        }
        return 'Success after retry';
      };

      const result = await executeWithRetry(fn, {
        maxRetries: 3,
        initialDelayMs: 5,
        factor: 1.5
      });

      expect(result).toBe('Success after retry');
      expect(attempts).toBe(3);
    });

    it('honors Retry-After header duration when provided on rate limit 429', async () => {
      let attempts = 0;
      const startTime = Date.now();
      const fn = async () => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('Rate limit hit');
          err.status = 429;
          err.retryAfterMs = 50;
          throw err;
        }
        return 'Success after rate limit';
      };

      const result = await executeWithRetry(fn, {
        maxRetries: 2,
        initialDelayMs: 5
      });

      const elapsed = Date.now() - startTime;
      expect(result).toBe('Success after rate limit');
      expect(attempts).toBe(2);
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe('Provider & Model Fallback Chain', () => {
    it('executes gateway call and returns generated text on primary provider success', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Generated description via Gemini API' }] } }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 25 }
          })
        };
      });

      try {
        const res = await invokeAIGateway('generate_job_description', { title: 'Backend Lead' });
        expect(res).toBe('Generated description via Gemini API');
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('throws sanitized 503 error when all providers fail without returning fake mock text', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: false,
          status: 503,
          text: async () => 'No capacity available for model'
        };
      });

      try {
        await expect(
          invokeAIGateway('generate_job_description', { title: 'Backend Lead' })
        ).rejects.toThrow(/temporarily unavailable/i);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    it('falls back to secondary provider if primary provider fails completely', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('generativelanguage.googleapis.com')) {
          return { ok: false, status: 503, text: async () => 'Gemini offline' };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'Fallback OpenRouter response text' } }],
            usage: { prompt_tokens: 10, completion_tokens: 20 }
          })
        };
      });

      try {
        const res = await invokeAIGateway('generate_job_description', { title: 'Architect' });
        expect(res).toBe('Fallback OpenRouter response text');
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('Validation of Content & Error Handling', () => {
    it('handles empty provider response body cleanly by rejecting', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: '   ' } }] })
        };
      });

      try {
        await expect(
          invokeAIGateway('generate_job_description', { title: 'Developer' })
        ).rejects.toThrow();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});
