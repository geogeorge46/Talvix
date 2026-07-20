import { render, screen } from '@testing-library/react';
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), company: vi.fn() }));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useCompany: () => mocks.company(),
  useSaveCompany: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAddMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveMember: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
import {
  AddTeamMemberPage,
  CompanyCreatePage,
  TeamPage,
  UnsupportedOrganizationPage,
} from './Pages';
describe('organization administration states', () => {
  beforeEach(() => {
    mocks.auth.mockReturnValue({
      user: { _id: '1'.repeat(24) },
      recruiter: { permissions: ['team.manage'] },
      refreshCapabilities: vi.fn(),
    });
    mocks.company.mockReturnValue({
      data: { team: [] },
      isLoading: false,
      isError: false,
    });
  });
  it('calls ID membership an immediate add, never an invitation', () => {
    render(
      <MemoryRouter>
        <AddTeamMemberPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/this is not an invitation/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add recruiter now/i }),
    ).toBeEnabled();
  });
  it('groups high-risk permissions by hiring domain', () => {
    render(
      <MemoryRouter>
        <AddTeamMemberPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    expect(screen.getByText('Assessments')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getAllByText(/selected/i).length).toBeGreaterThan(5);
  });
  it('blocks direct company creation for an existing member', () => {
    mocks.auth.mockReturnValue({
      recruiter: {
        permissions: ['company.manage'],
        company: { id: '1'.repeat(24) },
      },
      refreshCapabilities: vi.fn(),
    });
    const router = createMemoryRouter(
      [{ path: '/org/company/new', element: <CompanyCreatePage /> }],
      { initialEntries: ['/org/company/new'] },
    );
    render(<RouterProvider router={router} />);
    expect(
      screen.getByText(/company creation unavailable/i),
    ).toBeInTheDocument();
  });
  it('renders direct permission denial without redirecting', () => {
    mocks.auth.mockReturnValue({ recruiter: { permissions: [] } });
    render(
      <MemoryRouter>
        <TeamPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/team administration unavailable/i),
    ).toBeInTheDocument();
  });
  it.each(['invitations', 'analytics', 'exports'] as const)(
    'shows %s as explicitly unavailable',
    (kind) => {
      render(
        <MemoryRouter>
          <UnsupportedOrganizationPage kind={kind} />
        </MemoryRouter>,
      );
      expect(
        screen.getByText(new RegExp(`${kind} unavailable`, 'i')),
      ).toBeInTheDocument();
    },
  );
});
