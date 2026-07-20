import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { toApplicationDetail, toApplicationRow, toCandidate } from './model';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  applications: vi.fn(),
  pipeline: vi.fn(),
  application: vi.fn(),
  candidates: vi.fn(),
  candidate: vi.fn(),
  move: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useApplications: (...a: unknown[]) => mocks.applications(...a),
  usePipeline: (...a: unknown[]) => mocks.pipeline(...a),
  useApplication: (...a: unknown[]) => mocks.application(...a),
  useCandidates: (...a: unknown[]) => mocks.candidates(...a),
  useCandidate: (...a: unknown[]) => mocks.candidate(...a),
  useMoveApplication: () => ({ isPending: false, mutateAsync: mocks.move }),
}));
import {
  ApplicationDetailPage,
  ApplicationsPage,
  CandidateDetailPage,
  CandidatesPage,
  canonicalizeParams,
} from './Pages';
const privateValues = [
  'private@mail.test',
  '+1-secret',
  'https://resume-secret',
  'provider-secret',
  'actor-secret',
  'private-note',
];
const rawApp = {
  _id: 'app1',
  applicationNumber: 'TVX-101',
  candidateProfile: 'profile1',
  candidateSnapshot: {
    fullName: 'Alex Rivera',
    email: privateValues[0],
    phone: privateValues[1],
    skills: [{ name: 'React' }, { name: 'Research' }],
    experience: [
      { title: 'Designer', company: 'Northstar', description: 'Led research' },
    ],
  },
  jobSnapshot: { title: 'Senior Product Designer' },
  skillMatch: {
    score: 94,
    matchedSkills: ['React'],
    missingRequiredSkills: ['Figma'],
  },
  status: 'submitted',
  submittedAt: '2026-07-01T00:00:00Z',
  coverLetter: 'I submitted this evidence.',
  resumeSnapshot: {
    fileName: 'alex.pdf',
    url: privateValues[2],
    publicId: privateValues[3],
  },
  recruiterNotes: [{ note: privateValues[5] }],
  statusHistory: [
    {
      from: 'submitted',
      to: 'under-review',
      changedBy: privateValues[4],
      reason: 'Reviewed',
      changedAt: '2026-07-02T00:00:00Z',
    },
  ],
};
const rawCandidate = {
  _id: 'profile1',
  user: { fullName: 'Alex Rivera', email: privateValues[0] },
  headline: 'Product designer',
  bio: 'Evidence-led designer',
  phone: privateValues[1],
  resume: { url: privateValues[2], publicId: privateValues[3] },
  location: { city: 'Bengaluru', country: 'India' },
  skills: [{ name: 'React', proficiency: 'advanced', yearsOfExperience: 4 }],
  experience: [{ title: 'Designer', company: 'Northstar' }],
  profileCompletion: 88,
  availability: 'immediately',
};
const row = toApplicationRow(rawApp),
  detail = toApplicationDetail(rawApp),
  candidate = toCandidate(rawCandidate);
function show(element: React.ReactNode, path: string) {
  const router = createMemoryRouter(
    [
      { path: '/org/applications', element },
      { path: '/org/applications/:applicationId', element },
      { path: '/org/candidates', element },
      { path: '/org/candidates/:candidateId', element },
    ],
    { initialEntries: [path] },
  );
  const result = render(<RouterProvider router={router} />);
  return { ...result, router };
}
const query = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: mocks.refetch,
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue({
    recruiter: { permissions: ['applications.view', 'applications.manage'] },
  });
  mocks.applications.mockReturnValue(
    query({ items: [row], page: { page: 1, pages: 2, total: 11 } }),
  );
  mocks.pipeline.mockReturnValue(
    query({ total: 11, pipeline: { submitted: 5 } }),
  );
  mocks.application.mockReturnValue(query(detail));
  mocks.candidates.mockReturnValue(
    query({ items: [candidate], page: { page: 1, pages: 1, total: 1 } }),
  );
  mocks.candidate.mockReturnValue(query(candidate));
  mocks.move.mockResolvedValue({});
});
describe('applications workspace', () => {
  it('renders populated list accessibly with privacy-safe content and no bulk or drag UI', async () => {
    const { container } = show(<ApplicationsPage />, '/org/applications');
    expect(screen.getAllByText('Alex Rivera').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('table', { name: /current result page/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/bulk|drag/i)).not.toBeInTheDocument();
    privateValues.forEach((x) => expect(container).not.toHaveTextContent(x));
    expect((await axe(container)).violations).toEqual([]);
  });
  it('keeps view and filters in URL and renders the same record on board', async () => {
    const { router } = show(
      <ApplicationsPage />,
      '/org/applications?q=Alex&view=list',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Pipeline board' }),
    );
    expect(router.state.location.search).toContain('q=Alex');
    expect(router.state.location.search).toContain('view=board');
    expect(
      screen.getByRole('region', { name: 'Pipeline board' }),
    ).toHaveTextContent('Alex Rivera');
  });
  it('suppresses requests without permission', () => {
    mocks.auth.mockReturnValue({ recruiter: { permissions: [] } });
    show(<ApplicationsPage />, '/org/applications');
    expect(
      screen.getByText(/applications.view permission/i),
    ).toBeInTheDocument();
    expect(mocks.applications).toHaveBeenCalledWith(expect.any(String), false);
    expect(mocks.pipeline).toHaveBeenCalledWith(undefined, false);
  });
  it('confirms an exact move and announces success', async () => {
    show(<ApplicationsPage />, '/org/applications');
    const moveButton = screen
      .getAllByRole('button', { name: 'Move to stage' })
      .at(0);
    expect(moveButton).toBeDefined();
    await userEvent.click(moveButton as HTMLElement);
    await userEvent.selectOptions(
      screen.getByLabelText('Destination'),
      'under-review',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm movement' }),
    );
    expect(mocks.move).toHaveBeenCalledWith({ status: 'under-review' });
    expect(
      await screen.findByText(/moved from Submitted to Under Review/),
    ).toBeInTheDocument();
  });
  it('treats a transition 409 as stale without auto retry', async () => {
    mocks.move.mockRejectedValueOnce(new ApiError(409, 'stale'));
    show(<ApplicationsPage />, '/org/applications');
    const moveButton = screen
      .getAllByRole('button', { name: 'Move to stage' })
      .at(0);
    expect(moveButton).toBeDefined();
    await userEvent.click(moveButton as HTMLElement);
    await userEvent.selectOptions(
      screen.getByLabelText('Destination'),
      'under-review',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm movement' }),
    );
    expect(mocks.move).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/Move to Under Review was not completed/i),
    ).toBeInTheDocument();
    const reopen = screen
      .getAllByRole('button', { name: 'Move to stage' })
      .at(0);
    await userEvent.click(reopen as HTMLElement);
    expect(screen.getByLabelText('Destination')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Confirm movement' }),
    ).toBeDisabled();
    expect(mocks.move).toHaveBeenCalledTimes(1);
    await userEvent.selectOptions(
      screen.getByLabelText('Destination'),
      'under-review',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm movement' }),
    );
    expect(mocks.move).toHaveBeenCalledTimes(2);
  });
  it('provides board pagination, complete filters, and canonical URL safety', async () => {
    const { router } = show(
      <ApplicationsPage />,
      '/org/applications?view=board&page=1',
    );
    expect(screen.getByLabelText('Minimum rating')).toBeInTheDocument();
    expect(screen.getByLabelText('Tags')).toBeInTheDocument();
    expect(screen.getByLabelText('Submitted from')).toBeInTheDocument();
    expect(
      screen.getAllByRole('navigation', { name: /Application board pages/i })
        .length,
    ).toBeGreaterThan(0);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Next' }).at(0) as HTMLElement,
    );
    expect(router.state.location.search).toContain('page=2');
    const clean = canonicalizeParams(
      new URLSearchParams(
        'page=-2&view=broken&stage=nope&rating=9&jobId=bad&sort=wat',
      ),
      'applications',
    );
    expect(clean.toString()).toContain('page=1');
    expect(clean.get('view')).toBe('list');
    expect(clean.get('stage')).toBeNull();
    expect(clean.get('rating')).toBeNull();
    expect(clean.get('jobId')).toBeNull();
    expect(clean.get('sort')).toBe('newest');
  });
});
describe('safe evidence and candidates', () => {
  it('renders submitted evidence and chronological rail without private sentinels', async () => {
    const { container } = show(
      <ApplicationDetailPage />,
      '/org/applications/app1',
    );
    expect(
      screen.getByRole('heading', { name: 'Evidence trail' }),
    ).toBeInTheDocument();
    expect(screen.getByText('I submitted this evidence.')).toBeInTheDocument();
    expect(screen.getByText(/alex.pdf/)).toBeInTheDocument();
    privateValues.forEach((x) => expect(container).not.toHaveTextContent(x));
    expect((await axe(container)).violations).toEqual([]);
  });
  it('renders candidate list and detail with View profile as the only candidate action', async () => {
    const list = show(<CandidatesPage />, '/org/candidates');
    expect(
      screen.getAllByRole('link', { name: 'View profile' }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /message|contact|shortlist/i }),
    ).not.toBeInTheDocument();
    list.unmount();
    const rendered = show(<CandidateDetailPage />, '/org/candidates/profile1');
    expect(screen.getByText('Evidence-led designer')).toBeInTheDocument();
    privateValues.forEach((x) =>
      expect(rendered.container).not.toHaveTextContent(x),
    );
    expect((await axe(rendered.container)).violations).toEqual([]);
  });
  it('exposes every supported candidate filter', () => {
    show(<CandidatesPage />, '/org/candidates');
    expect(screen.getByLabelText('Preferred role')).toBeInTheDocument();
    expect(screen.getByLabelText('Job type')).toBeInTheDocument();
    expect(screen.getByLabelText('Minimum experience')).toBeInTheDocument();
  });
  it('renders loading, filtered empty, and retryable error states', () => {
    mocks.applications.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mocks.refetch,
    });
    const loading = show(<ApplicationsPage />, '/org/applications');
    expect(
      screen.getByRole('table', { name: /current result page/i }),
    ).toBeInTheDocument();
    loading.unmount();
    mocks.applications.mockReturnValue(
      query({ items: [], page: { page: 1, pages: 1, total: 0 } }),
    );
    const empty = show(<ApplicationsPage />, '/org/applications?q=none');
    expect(screen.getByText('No matching applications')).toBeInTheDocument();
    empty.unmount();
    mocks.applications.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Offline'),
      refetch: mocks.refetch,
    });
    show(<ApplicationsPage />, '/org/applications');
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });
});
