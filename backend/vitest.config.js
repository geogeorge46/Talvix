import { defineConfig } from 'vitest/config';

process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/talvix_test_bootstrap';
process.env.JWT_ACCESS_SECRET = 'vitest-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'vitest-refresh-secret-that-is-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.FILE_STORAGE_PROVIDER = 'memory';
process.env.FILE_UPLOADS_ENABLED = 'true';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
