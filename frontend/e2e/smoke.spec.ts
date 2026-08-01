import { expect, test } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5000/api/v1';

test('API health endpoint is reachable and secret-free', async ({ request }) => {
  const response = await request.get(`${apiUrl}/health`);
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body).toMatchObject({ success: true });
  expect(JSON.stringify(body)).not.toMatch(/JWT_|MONGODB_URI|CLOUDINARY_|RESEND_/);
});

test('public auth routes render in a browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in|welcome|talvix/i })).toBeVisible();
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create|register|join/i })).toBeVisible();
});

test('unknown routes fail closed to the public not-found state', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page).toHaveURL(/\/not-found$/);
});
