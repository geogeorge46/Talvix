import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth() }));
vi.mock('../../shell/Shell', () => ({
  organizationNavigation: [
    { id: 'company', label: 'Company', to: '/org/company' },
  ],
  candidateNavigation: [],
  adminNavigation: [],
  SkipLink: () => null,
  AppShell: ({ content }: { content?: React.ReactNode }) => (
    <div>{content ?? <Outlet />}</div>
  ),
}));
import { OrganizationWorkspaceLayout } from '../../layouts/Layouts';
describe('organization creation shell access', () => {
  beforeEach(() =>
    auth.mockReturnValue({
      recruiter: { isApproved: true, company: null, permissions: [] },
      capabilityStatus: 'resolved',
      refreshCapabilities: vi.fn(),
    }),
  );
  it('renders creation for an approved recruiter without a company', () => {
    render(
      <MemoryRouter initialEntries={['/org/company/new']}>
        <Routes>
          <Route path="org" element={<OrganizationWorkspaceLayout />}>
            <Route
              path="company/new"
              element={<h1>Company creation editor</h1>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Company creation editor' }),
    ).toBeInTheDocument();
  });
  it('offers an explicit creation action from the no-company state', () => {
    render(
      <MemoryRouter initialEntries={['/org']}>
        <Routes>
          <Route path="org" element={<OrganizationWorkspaceLayout />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('link', { name: /create company/i }),
    ).toHaveAttribute('href', '/org/company/new');
  });
  it('allows rejected companies to reach safe profile recovery routes', () => {
    auth.mockReturnValue({
      recruiter: {
        isApproved: true,
        company: {
          name: 'Talvix',
          isActive: true,
          verificationStatus: 'rejected',
        },
        permissions: ['company.manage'],
      },
      capabilityStatus: 'resolved',
      refreshCapabilities: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/org/company/edit']}>
        <Routes>
          <Route path="org" element={<OrganizationWorkspaceLayout />}>
            <Route
              path="company/edit"
              element={<h1>Safe profile recovery</h1>}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Safe profile recovery' }),
    ).toBeInTheDocument();
  });
  it('allows suspended status review while blocking team administration', () => {
    auth.mockReturnValue({
      recruiter: {
        isApproved: true,
        company: {
          name: 'Talvix',
          isActive: true,
          verificationStatus: 'suspended',
        },
        permissions: ['company.manage', 'team.manage'],
      },
      capabilityStatus: 'resolved',
      refreshCapabilities: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={['/org/team']}>
        <Routes>
          <Route path="org" element={<OrganizationWorkspaceLayout />}>
            <Route path="team" element={<h1>Team editor</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/organization suspended/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Team editor' }),
    ).not.toBeInTheDocument();
  });
});
