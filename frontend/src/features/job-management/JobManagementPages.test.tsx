import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toJob } from './model';

const mocks = vi.hoisted(() => ({
  managedJobs: vi.fn(),
  managedJob: vi.fn(),
  save: vi.fn(),
  action: vi.fn(),
  auth: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useManagedJobs: (...a: unknown[]) => mocks.managedJobs(...a),
  useManagedJob: (...a: unknown[]) => mocks.managedJob(...a),
  useSaveJob: () => ({ isPending: false, mutateAsync: mocks.save }),
  useJobAction: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.action,
  }),
}));
import {
  JobDetailsPage,
  JobFormPage,
  ManagedJobsPage,
} from './JobManagementPages';

const recruiter = (
  permissions: string[],
  company = { verificationStatus: 'verified', isActive: true },
) => ({
  user: { _id: 'actor', role: 'recruiter' },
  recruiter: {
    isApproved: true,
    isCompanyOwner: false,
    permissions,
    company: { _id: 'company', name: 'Acme', slug: 'acme', ...company },
  },
});
const job = toJob({
  _id: '0123456789abcdef01234567',
  title: 'Product Designer',
  description: 'Shape hiring tools',
  status: 'draft',
  employmentType: 'full-time',
  workMode: 'hybrid',
  openings: 2,
  applicationsCount: 8,
  viewsCount: 42,
  applicationDeadline: '2030-01-01T00:00:00.000Z',
  requirements: ['Research'],
  responsibilities: ['Lead discovery'],
});
function show(element: React.ReactNode, path = '/org/jobs') {
  const router = createMemoryRouter(
    [
      { path: '/org/jobs', element },
      { path: '/org/jobs/new', element },
      { path: '/org/jobs/:jobId', element },
      { path: '/org', element: <p>Overview</p> },
    ],
    { initialEntries: [path] },
  );
  const rendered = render(<RouterProvider router={router} />);
  return { ...rendered, router };
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.auth.mockReturnValue(
    recruiter(['jobs.update', 'jobs.create', 'jobs.publish', 'jobs.delete']),
  );
  mocks.managedJobs.mockReturnValue({
    data: { jobs: [job], pagination: { page: 1, pages: 1, total: 1 } },
    isLoading: false,
    isError: false,
  });
  mocks.managedJob.mockReturnValue({
    data: job,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});
describe('job pages rendered integration', () => {
  it('renders populated wide/narrow contracts without axe violations', async () => {
    const { container } = show(<ManagedJobsPage />);
    expect(screen.getAllByText('Product Designer').length).toBeGreaterThan(1);
    expect(screen.getAllByText(/No deadline|Closes/).length).toBeGreaterThan(0);
    expect((await axe(container)).violations).toEqual([]);
  });
  it('suppresses managed requests without read permission', () => {
    mocks.auth.mockReturnValue(recruiter(['jobs.create']));
    show(<ManagedJobsPage />);
    expect(screen.getByText(/jobs.update permission/)).toBeInTheDocument();
    expect(mocks.managedJobs).toHaveBeenCalledWith(1, '', false);
  });
  it('create-only mode disables detail lookup and reaches safe success', async () => {
    mocks.auth.mockReturnValue(recruiter(['jobs.create']));
    mocks.save.mockResolvedValue({ job: { _id: job.id } });
    show(<JobFormPage mode="create" />, '/org/jobs/new');
    expect(mocks.managedJob).toHaveBeenCalledWith('new', false);
    await userEvent.type(screen.getByLabelText(/Job title/), 'Engineer');
    await userEvent.type(screen.getByLabelText(/^Description/), 'Build');
    await userEvent.selectOptions(
      screen.getByLabelText(/Employment type/),
      'full-time',
    );
    await userEvent.selectOptions(screen.getByLabelText(/Work mode/), 'remote');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByText('Job created')).toBeInTheDocument();
  });
  it('blocks inactive companies before detail content or actions', () => {
    mocks.auth.mockReturnValue(
      recruiter(['jobs.update', 'jobs.publish'], {
        verificationStatus: 'verified',
        isActive: false,
      }),
    );
    show(<JobDetailsPage />, `/org/jobs/${job.id}`);
    expect(screen.getByText('Company inactive')).toBeInTheDocument();
    expect(mocks.managedJob).toHaveBeenCalledWith(job.id, false);
  });
  it('renders loading, empty and error list states', () => {
    mocks.managedJobs.mockReturnValueOnce({ isLoading: true });
    const first = show(<ManagedJobsPage />);
    expect(screen.getByText('Loading jobs')).toBeInTheDocument();
    first.unmount();
    mocks.managedJobs.mockReturnValueOnce({
      data: { jobs: [], pagination: { page: 1, pages: 1, total: 0 } },
      isLoading: false,
      isError: false,
    });
    const second = show(<ManagedJobsPage />);
    expect(screen.getByText('No jobs yet')).toBeInTheDocument();
    second.unmount();
    mocks.managedJobs.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      error: new Error('Offline'),
      refetch: vi.fn(),
    });
    show(<ManagedJobsPage />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
  it('requires confirmation before lifecycle mutation and never renders Publish', async () => {
    show(<JobDetailsPage />, `/org/jobs/${job.id}`);
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(mocks.action).toHaveBeenCalledWith('submit');
  });
  it('renders form validation summary and retains safe input', async () => {
    show(<JobFormPage mode="create" />, '/org/jobs/new');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title');
    expect(screen.getByLabelText(/Job title/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
  it('installs draft persistence and browser exit protection', async () => {
    show(<JobFormPage mode="create" />, '/org/jobs/new');
    await userEvent.type(screen.getByLabelText(/Job title/), 'Draft');
    expect(
      Object.keys(sessionStorage).some((k) =>
        k.includes('talvix:job-draft:v1'),
      ),
    ).toBe(true);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
