import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { vi } from 'vitest';

const apiRequest = vi.fn();
const auth = {
  user: {
    _id: 'user-1',
    fullName: 'Rhea Recruiter',
    email: 'rhea@example.com',
    role: 'recruiter' as const,
    profileCompleted: true,
  },
  recruiter: {
    isApproved: true,
    isCompanyOwner: false,
    permissions: [
      'jobs.create',
      'jobs.update',
      'applications.view',
      'interviews.view',
      'offers.view',
    ],
    company: {
      _id: 'company-1',
      name: 'Northstar',
      slug: 'northstar',
      verificationStatus: 'verified',
      isActive: true,
    },
  },
};
vi.mock('../../api/client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth }));

import { OrganizationDashboardPage } from './OrganizationDashboardPage';

const application = {
  _id: '507f1f77bcf86cd799439011',
  status: 'under-review',
  submittedAt: '2026-07-10T10:00:00.000Z',
  candidateSnapshot: {
    fullName: 'Alex Rivera',
    email: 'private@example.com',
    phone: 'secret',
    skills: [{ name: 'Figma' }, { name: 'Research' }],
  },
  jobSnapshot: { title: 'Senior Product Designer' },
  skillMatch: { score: 94, matchedSkills: ['Figma'] },
  recruiterNotes: ['secret'],
  answers: ['secret'],
};
function responseFor(path: string): unknown {
  if (path.startsWith('/jobs/manage'))
    return {
      jobs: [{ _id: 'job-1', status: 'published' }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    };
  if (path === '/applications/manage/pipeline')
    return {
      total: 5,
      pipeline: { submitted: 2, 'under-review': 2, hired: 1 },
    };
  if (path.startsWith('/applications/manage'))
    return {
      applications: [application],
      pagination: { page: 1, limit: 10, total: 21, pages: 3 },
    };
  if (path.startsWith('/interviews/calendar'))
    return {
      schedules: [
        {
          _id: 'schedule-1',
          startTime: '2026-07-20T10:00:00.000Z',
          endTime: '2026-07-20T11:00:00.000Z',
          mode: 'video',
          status: 'confirmed',
          location: { name: 'Studio', city: 'Pune', address: 'secret' },
          meetingPassword: 'secret',
        },
      ],
    };
  if (path === '/offers/analytics')
    return { analytics: { pendingApprovals: 5, compensationRange: 'private' } };
  throw new Error(`Unexpected request: ${path}`);
}
function Location() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function renderDashboard(entry = '/org') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/org"
            element={
              <>
                <OrganizationDashboardPage />
                <Location />
              </>
            }
          />
          <Route path="/org/*" element={<p>Destination</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation((path: string) =>
    Promise.resolve(responseFor(path)),
  );
  auth.recruiter.permissions = [
    'jobs.create',
    'jobs.update',
    'applications.view',
    'interviews.view',
    'offers.view',
  ];
});

describe('rendered organization dashboard', () => {
  it('renders populated backend envelopes, composes exact endpoints, and makes no AI claim', async () => {
    const { container } = renderDashboard();
    expect(
      await screen.findByRole('heading', { name: 'Hiring overview' }),
    ).toBeVisible();
    expect(await screen.findAllByText('Alex Rivera')).not.toHaveLength(0);
    expect(screen.getByText('AI unavailable')).toBeVisible();
    expect(screen.getAllByText(/skill match/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/private@example|secret/i),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledTimes(7));
    const paths = apiRequest.mock.calls.map(([path]) => String(path));
    expect(paths).toContain('/jobs/manage?page=1&limit=50');
    expect(paths).toContain('/applications/manage/pipeline');
    expect(paths).toContain('/offers/analytics');
    expect(
      paths.filter((path) => path.startsWith('/applications/manage?')),
    ).toHaveLength(2);
    expect(
      paths.filter((path) => path.startsWith('/interviews/calendar?')),
    ).toHaveLength(2);
    expect(
      container.querySelector('.tvx-data__wide table'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.tvx-data__narrow[role="list"]'),
    ).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });

  it('does not request or render sections without their exact permission', async () => {
    auth.recruiter.permissions = [];
    renderDashboard();
    expect(
      await screen.findByRole('heading', { name: 'Hiring overview' }),
    ).toBeVisible();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('button', { name: 'Create job' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/permission required|permission is required/i).length,
    ).toBeGreaterThan(0);
  });

  it('canonicalizes and updates range, search, stage, and page in URL state', async () => {
    const user = userEvent.setup();
    renderDashboard('/org?range=31&stage=bad&page=-2&q=%20Alex%20');
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('?q=Alex'),
    );
    await user.selectOptions(
      screen.getByLabelText('Dashboard date range'),
      '90',
    );
    expect(screen.getByTestId('location')).toHaveTextContent('range=90');
    const search = screen.getByLabelText('Search candidates');
    await user.clear(search);
    await user.type(search, 'Rivera');
    await user.click(
      within(screen.getByRole('search')).getByRole('button', {
        name: 'Search',
      }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('q=Rivera');
    await user.selectOptions(screen.getByLabelText('Filter by stage'), 'hired');
    expect(screen.getByTestId('location')).toHaveTextContent('stage=hired');
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('location')).toHaveTextContent('page=2');
  });

  it('keeps successful sections visible when one endpoint errors and supports retry', async () => {
    let fail = true;
    apiRequest.mockImplementation((path: string) =>
      path === '/applications/manage/pipeline' && fail
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(responseFor(path)),
    );
    renderDashboard();
    expect(
      await screen.findByText('Pipeline data could not be loaded.'),
    ).toBeVisible();
    expect(screen.getByText('Offers pending')).toBeVisible();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText(
        'All-time application status, independent of the selected date range.',
      ),
    ).toBeVisible();
  });

  it('renders loading, empty, and filtered-empty states', async () => {
    let resolveRequest!: (value: unknown) => void;
    apiRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const loading = renderDashboard();
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0);
    loading.unmount();
    resolveRequest({});
    apiRequest.mockImplementation((path: string) =>
      path.startsWith('/applications/manage') &&
      path !== '/applications/manage/pipeline'
        ? Promise.resolve({
            applications: [],
            pagination: { page: 1, limit: 10, total: 0, pages: 0 },
          })
        : Promise.resolve(responseFor(path)),
    );
    const { unmount } = renderDashboard();
    expect(
      await screen.findByRole('heading', { name: 'No applications yet' }),
    ).toBeVisible();
    unmount();
    renderDashboard('/org?q=nobody');
    expect(
      await screen.findByRole('heading', { name: 'No candidates match' }),
    ).toBeVisible();
  });
});
