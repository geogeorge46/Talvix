import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { apiRequest } from '../api/client';
import { axe } from 'vitest-axe';

const json = (data: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
const candidate = {
  _id: 'u1',
  fullName: 'Asha Rao',
  email: 'asha@example.com',
  role: 'candidate',
  profileCompleted: true,
};
const recruiter = {
  ...candidate,
  _id: 'u2',
  fullName: 'Rina Shah',
  role: 'recruiter',
};

describe('routing, auth, and shell integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('submits supported registration fields and never offers admin', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, init });
        if (url.endsWith('/auth/refresh')) return json({}, 401);
        return json({ data: { user: candidate, accessToken: 'access' } });
      }),
    );
    window.history.replaceState({}, '', '/register');
    render(<App />);
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText('Full name (required)'),
      'Asha Rao',
    );
    await user.type(
      screen.getByLabelText('Email address (required)'),
      'asha@example.com',
    );
    await user.type(screen.getByLabelText('Password (required)'), 'Secure1!');
    await user.selectOptions(
      screen.getByLabelText('I am joining as'),
      'candidate',
    );
    expect(
      screen.queryByRole('option', { name: /admin/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(calls.some((call) => call.url.endsWith('/auth/register'))).toBe(
        true,
      ),
    );
    const registration = calls.find((call) =>
      call.url.endsWith('/auth/register'),
    );
    expect(JSON.parse(String(registration?.init?.body))).toEqual({
      fullName: 'Asha Rao',
      email: 'asha@example.com',
      password: 'Secure1!',
      role: 'candidate',
    });
  });

  it('denies a candidate direct access to the organization workspace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? json({ data: { accessToken: 'access' } })
          : json({ data: candidate }),
      ),
    );
    window.history.replaceState({}, '', '/org');
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Wrong workspace' }),
    ).toBeVisible();
  });

  it('filters organization navigation by backend permission context', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh'))
          return json({ data: { accessToken: 'access' } });
        if (url.endsWith('/auth/me')) return json({ data: recruiter });
        return json({
          data: {
            profile: {
              isApproved: true,
              isCompanyOwner: false,
              permissions: ['jobs.update'],
              company: {
                _id: 'c1',
                name: 'Northstar',
                slug: 'northstar',
                verificationStatus: 'verified',
                isActive: true,
              },
            },
          },
        });
      }),
    );
    window.history.replaceState({}, '', '/org');
    render(<App />);
    expect(
      await screen.findByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: /Jobs/ }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('link', { name: /Team/ }),
    ).not.toBeInTheDocument();
  });

  it('resolves the real organization application-detail route', async () => {
    const applicationId = '0123456789abcdef01234567';
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh'))
          return json({ data: { accessToken: 'access' } });
        if (url.endsWith('/auth/me')) return json({ data: recruiter });
        if (url.endsWith('/recruiters/me'))
          return json({
            data: {
              profile: {
                isApproved: true,
                isCompanyOwner: false,
                permissions: ['applications.view'],
                company: {
                  _id: 'c1',
                  name: 'Northstar',
                  slug: 'northstar',
                  verificationStatus: 'verified',
                  isActive: true,
                },
              },
            },
          });
        if (url.endsWith(`/applications/manage/${applicationId}`))
          return json({
            data: {
              application: {
                _id: applicationId,
                applicationNumber: 'TVX-204',
                candidateSnapshot: { fullName: 'Alex Rivera', skills: [] },
                jobSnapshot: { title: 'Product Designer' },
                skillMatch: { score: 80 },
                status: 'submitted',
                submittedAt: '2026-07-20T00:00:00.000Z',
              },
            },
          });
        return json({ data: {} });
      }),
    );
    window.history.replaceState({}, '', `/org/applications/${applicationId}`);
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Alex Rivera' }),
    ).toBeVisible();
    expect(screen.getAllByText('TVX-204').length).toBeGreaterThan(0);
  });

  it('opens and closes mobile navigation with Escape and restores focus', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? json({ data: { accessToken: 'access' } })
          : json({ data: candidate }),
      ),
    );
    window.history.replaceState({}, '', '/candidate');
    render(<App />);
    const user = userEvent.setup();
    const trigger = await screen.findByRole('button', {
      name: 'Open navigation',
    });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Navigation' }),
      ).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Skip to main content' }),
    ).toHaveAttribute('href', '#main-content');
  });

  it('keeps notifications inside the authenticated role shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? json({ data: { accessToken: 'access' } })
          : json({ data: candidate }),
      ),
    );
    window.history.replaceState({}, '', '/notifications');
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Notifications' }),
    ).toBeVisible();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible();
  });

  it('closes the mobile drawer after selection and focuses main content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? json({ data: { accessToken: 'access' } })
          : json({ data: candidate }),
      ),
    );
    window.history.replaceState({}, '', '/candidate');
    render(<App />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Open navigation' }),
    );
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    await user.click(
      within(drawer).getByRole('link', { name: 'Applications' }),
    );
    await waitFor(() => expect(drawer).not.toBeInTheDocument());
    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('fails closed for unknown recruiter aliases and renders approval state from the real profile envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh'))
          return json({ data: { accessToken: 'access' } });
        if (url.endsWith('/auth/me')) return json({ data: recruiter });
        return json({
          data: {
            profile: {
              isApproved: false,
              isCompanyOwner: false,
              permissions: [],
              company: null,
            },
          },
        });
      }),
    );
    window.history.replaceState(
      {},
      '',
      '/recruiter/unknown/507f1f77bcf86cd799439011',
    );
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    window.history.replaceState({}, '', '/org');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByText('Approval pending')).toBeVisible();
  });

  it('refreshes recruiter capability context on focus and authenticated 403', async () => {
    let profileCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh'))
          return json({ data: { accessToken: 'access' } });
        if (url.endsWith('/auth/me')) return json({ data: recruiter });
        if (url.endsWith('/denied'))
          return json({ success: false, message: 'Forbidden' }, 403);
        if (url.includes('/jobs/manage'))
          return json({
            data: {
              jobs: [],
              pagination: { page: 1, limit: 50, total: 0, pages: 0 },
            },
          });
        profileCalls += 1;
        return json({
          data: {
            profile: {
              isApproved: true,
              isCompanyOwner: false,
              permissions: ['jobs.update'],
              company: {
                _id: 'c1',
                name: 'Northstar',
                slug: 'northstar',
                verificationStatus: 'verified',
                isActive: true,
              },
            },
          },
        });
      }),
    );
    window.history.replaceState({}, '', '/org');
    render(<App />);
    await screen.findByRole('navigation', { name: 'Primary navigation' });
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(profileCalls).toBe(2));
    await expect(apiRequest('/denied')).rejects.toMatchObject({ status: 403 });
    await waitFor(() => expect(profileCalls).toBe(3));
  });

  it('has no automated accessibility violations in the authenticated shell', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? json({ data: { accessToken: 'access' } })
          : json({ data: candidate }),
      ),
    );
    window.history.replaceState({}, '', '/candidate');
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: 'Candidate workspace' });
    expect((await axe(container)).violations).toEqual([]);
  });
});
