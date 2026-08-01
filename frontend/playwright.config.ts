import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5000/api/v1';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html'], ['github']] : [['list']],
  use: {
    baseURL: frontendUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm start',
      cwd: '../backend',
      url: `${apiUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? 'production',
        PORT: process.env.PORT ?? '5000',
      },
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173',
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        ...process.env,
        VITE_API_BASE_URL: process.env.VITE_API_BASE_URL ?? apiUrl,
      },
    },
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
