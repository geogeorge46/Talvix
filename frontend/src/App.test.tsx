import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { App } from './App';

describe('application bootstrap', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ success: false, message: 'No session' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );
    window.history.replaceState({}, '', '/login');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('restores into sign in with landmarks and skip navigation', async () => {
    render(<App />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to Talvix' }),
    ).toBeVisible();
  });

  it('has no detectable automated accessibility violations', async () => {
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Sign in to Talvix' });
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
