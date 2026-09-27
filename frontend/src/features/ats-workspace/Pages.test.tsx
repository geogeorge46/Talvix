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
  checkEligibility: vi.fn(),
  bulkAssign: vi.fn(),
  assessments: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useApplications: (...a: unknown[]) => mocks.applications(...a),
  usePipeline: (...a: unknown[]) => mocks.pipeline(...a),
  useApplication: (...a: unknown[]) => mocks.application(...a),
  useCandidates: (...a: unknown[]) => mocks.candidates(...a),
  useCandidate: (...a: unknown[]) => mocks.candidate(...a),
  useMoveApplication: () => ({ isPending: false, mutateAsync: mocks.move }),
  useBulkApplications: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useApplicationTimeline: () => ({ isLoading: false, data: [] }),
  useApplicationComments: () => ({ isLoading: false, data: [] }),
  useAddApplicationComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteApplicationComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useAddApplicationNote: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUpdateApplicationNote: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useDeleteApplicationNote: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('../assessments/api', () => ({
  useAssignments: () => ({ isPending: false, data: { items: [] } }),
  useAssessments: () => mocks.assessments(),
  useCheckEligibility: () => ({
    isPending: false,
    mutate: mocks.checkEligibility,
    mutateAsync: mocks.checkEligibility,
  }),
  useBulkAssignAssessment: () => ({
    isPending: false,
    mutateAsync: mocks.bulkAssign,
  }),
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
  mocks.assessments.mockReturnValue(
    query({
      items: [
        {
          id: 'asmt1',
          title: 'Fullstack Technical Assessment',
          durationMinutes: 60,
          passingPercentage: 75,
          questionCount: 5,
        },
      ],
      page: { page: 1, pages: 1, total: 1 },
    }),
  );
  mocks.checkEligibility.mockImplementation(
    (
      _body: unknown,
      options?: { onSuccess?: (data: unknown) => void },
    ) => {
      options?.onSuccess?.({
        eligible: [
          {
            applicationId: 'app1',
            candidateName: 'Alex Rivera',
            email: 'alex@example.com',
            stage: 'submitted',
            jobTitle: 'Senior Product Designer',
          },
        ],
        alreadyAssigned: [],
        ineligible: [],
        summary: {
          total: 1,
          eligibleCount: 1,
          alreadyAssignedCount: 0,
          ineligibleCount: 0,
        },
      });
    },
  );
  mocks.bulkAssign.mockResolvedValue({
    assigned: [
      {
        applicationId: 'app1',
        candidateName: 'Alex Rivera',
        assignmentId: 'assign1',
        status: 'assessment-pending',
      },
    ],
    alreadyAssigned: [],
    ineligible: [],
    failed: [],
    summary: {
      requested: 1,
      assignedCount: 1,
      alreadyAssignedCount: 0,
      ineligibleCount: 0,
      failedCount: 0,
    },
  });
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
  it('does not render generic Move Stage button or MoveDialog modal on applications page', async () => {
    show(<ApplicationsPage />, '/org/applications');
    expect(
      screen.queryByRole('button', { name: /move stage|move to stage/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: /move to stage/i }),
    ).not.toBeInTheDocument();
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
  it('opens Assign Assessment modal on selection, shows eligibility preview, and processes bulk assignment with clear outcomes', async () => {
    mocks.auth.mockReturnValue({
      recruiter: {
        permissions: [
          'applications.view',
          'applications.manage',
          'assessments.assign',
        ],
      },
    });
    show(<ApplicationsPage />, '/org/applications');

    // Select the candidate checkbox
    const selectCheckbox = screen.getByLabelText(
      'Select application for Alex Rivera',
    );
    await userEvent.click(selectCheckbox);

    // Bulk action bar appears with "Assign Assessment" button
    const assignBtn = screen.getByRole('button', {
      name: 'Assign Assessment',
    });
    expect(assignBtn).toBeInTheDocument();
    await userEvent.click(assignBtn);

    // Modal dialog is open
    expect(
      screen.getByRole('dialog', {
        name: /Assign Assessment to Candidates/i,
      }),
    ).toBeInTheDocument();

    // Select the assessment from the dropdown
    const selectDropdown = screen.getByLabelText('Select Assessment');
    await userEvent.selectOptions(selectDropdown, 'asmt1');

    // Live eligibility preview is evaluated and displayed
    expect(mocks.checkEligibility).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'asmt1',
        applicationIds: ['app1'],
      }),
      expect.anything(),
    );
    expect(screen.getByText('1 Eligible')).toBeInTheDocument();
    expect(screen.getByText('Ready to Assign')).toBeInTheDocument();

    // Confirm and assign
    const confirmBtn = screen.getByRole('button', {
      name: /Confirm & Assign \(1\)/i,
    });
    expect(confirmBtn).not.toBeDisabled();
    await userEvent.click(confirmBtn);

    expect(mocks.bulkAssign).toHaveBeenCalledWith(
      expect.objectContaining({
        assessmentId: 'asmt1',
        applicationIds: ['app1'],
      }),
    );

    // Outcomes view is displayed with clear per-candidate outcomes
    expect(
      screen.getByText('Assignments Issued Successfully'),
    ).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
  });
});
