import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { QueryClient } from '@tanstack/react-query';
import { axe } from 'vitest-axe';

const id = '507f1f77bcf86cd799439011';
const json = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('integrated RTL candidate journey (mocked contracts, not browser E2E)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('moves through owned candidate domains, mutates safe data, then clears protected access on logout', async () => {
    const clearSpy = vi.spyOn(QueryClient.prototype, 'clear');
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input),
          path = new URL(url).pathname;
        calls.push(`${init?.method ?? 'GET'} ${path}`);
        if (path.endsWith('/auth/refresh'))
          return json({ data: { accessToken: 'access' } });
        if (path.endsWith('/auth/me'))
          return json({
            data: {
              _id: id,
              fullName: 'Demo Candidate',
              email: 'demo@example.com',
              role: 'candidate',
            },
          });
        if (path.endsWith('/auth/logout')) return json({ data: {} });
        if (path.endsWith('/candidates/me'))
          return json({
            data: {
              profile: {
                _id: id,
                headline: 'Product designer',
                profileVisibility: 'recruiters-only',
                skills: [],
                experience: [],
                education: [],
                projects: [],
                certifications: [],
              },
            },
          });
        if (path.includes('/assessments/assignments/me'))
          return json({
            data: {
              assignments: [],
              pagination: { page: 1, pages: 1, total: 0 },
            },
          });
        if (path.endsWith('/interviews/me'))
          return json({ data: { processes: [] } });
        if (path.endsWith('/offers/me')) return json({ data: { offers: [] } });
        if (path.includes('/applications/me'))
          return json({
            data: {
              applications: [
                {
                  _id: id,
                  status: 'submitted',
                  jobSnapshot: {
                    title: 'Product Designer',
                    companyName: 'Northstar',
                  },
                  createdAt: '2026-07-20',
                },
              ],
              pagination: { page: 1, pages: 1, total: 1 },
            },
          });
        if (path.endsWith('/jobs'))
          return json({
            data: {
              jobs: [
                {
                  _id: id,
                  title: 'Product Designer',
                  companyName: 'Northstar',
                  status: 'published',
                },
              ],
              pagination: { page: 1, pages: 1, total: 1 },
            },
          });
        if (path.endsWith(`/jobs/${id}`))
          return json({
            data: {
              job: {
                _id: id,
                title: 'Product Designer',
                companyName: 'Northstar',
                status: 'published',
                applicationQuestions: [],
              },
            },
          });
        if (path.endsWith('/applications'))
          return json({ data: { application: { _id: id } } });
        if (path.includes('/notifications'))
          return json({
            data: {
              notifications: [
                {
                  _id: id,
                  type: 'application.updated',
                  title: 'Application updated',
                  message: 'Review your timeline',
                  createdAt: '2026-07-20',
                  data: {
                    applicationId: id,
                    actionUrl: 'https://evil.example',
                  },
                },
              ],
              pagination: { page: 1, pages: 1, total: 1 },
              count: 1,
            },
          });
        if (path.endsWith('/documents'))
          return json({
            data: {
              documents: [],
              pagination: { page: 1, pages: 1, total: 0 },
            },
          });
        return json({ data: {} });
      }),
    );
    window.history.replaceState({}, '', '/candidate');
    const { container } = render(<App />);
    const user = userEvent.setup();
    expect(
      await screen.findByRole('heading', { name: 'Candidate workspace' }),
    ).toBeVisible();
    expect((await axe(container)).violations).toEqual([]);
    await user.click(screen.getByRole('link', { name: /^profile$/i }));
    await user.clear(await screen.findByLabelText(/professional headline/i));
    await user.type(
      screen.getByLabelText(/professional headline/i),
      'Senior product designer',
    );
    await user.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() =>
      expect(calls.some((x) => x === 'PATCH /api/v1/candidates/me')).toBe(true),
    );
    await user.click(screen.getByRole('button', { name: 'Add skills' }));
    await user.type(screen.getByLabelText('Skill name'), 'Research');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await waitFor(() =>
      expect(calls.some((x) => x === 'POST /api/v1/candidates/me/skills')).toBe(
        true,
      ),
    );
    await user.click(screen.getByRole('link', { name: 'Jobs' }));
    await user.click(
      await screen.findByRole('link', { name: 'Product Designer' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Apply now' }));
    await user.click(
      screen.getByRole('button', { name: 'Submit application' }),
    );
    await waitFor(() =>
      expect(calls.some((x) => x === 'POST /api/v1/applications')).toBe(true),
    );
    for (const label of [
      'Applications',
      'Assessments',
      'Interviews',
      'Offers',
      'Documents',
      'Notifications',
      'Settings',
    ]) {
      const links = screen.getAllByRole('link', {
        name: new RegExp(`^${label}$`, 'i'),
      });
      await user.click(links[0] as HTMLElement);
      await waitFor(() =>
        expect(window.location.pathname.toLowerCase()).toContain(
          label.toLowerCase(),
        ),
      );
      if (label === 'Notifications')
        expect(
          screen.queryByRole('link', { name: /evil/i }),
        ).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(clearSpy).toHaveBeenCalled();
    window.history.pushState({}, '', `/candidate/applications/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(window.location.pathname).toContain('/login'));
    expect(
      screen.queryByRole('navigation', { name: 'Primary navigation' }),
    ).not.toBeInTheDocument();
  }, 15000);
});
