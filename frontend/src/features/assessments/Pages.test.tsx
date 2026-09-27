import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  attempt: vi.fn(),
  save: vi.fn(),
  submit: vi.fn(),
  assessments: vi.fn(),
  assessment: vi.fn(),
  cohortLeaderboard: vi.fn(),
  promoteCandidates: vi.fn(),
  composition: vi.fn(),
  assessmentAction: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useAttempt: (...args: unknown[]) => mocks.attempt(...args),
  useSaveAnswer: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.save,
  }),
  useSubmit: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.submit,
  }),
  useAssessments: (...args: unknown[]) => mocks.assessments(...args),
  useAssessment: (...args: unknown[]) => mocks.assessment(...args),
  useAssessmentAction: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.assessmentAction,
  }),
  useAssessmentSave: () => ({}),
  useComposition: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.composition,
  }),
  useAssignment: () => ({ isLoading: false }),
  useAssignments: () => ({ isLoading: false, data: { items: [] } }),
  useResult: () => ({ isLoading: false }),
  useReviews: () => ({ isLoading: false, data: [] }),
  useStart: () => ({}),
  useQuestions: () => ({ isLoading: false, data: { items: [] } }),
  useCohortLeaderboard: (...args: unknown[]) => mocks.cohortLeaderboard(...args),
  usePromoteCandidates: () => ({
    isPending: false,
    isError: false,
    mutateAsync: mocks.promoteCandidates,
  }),
  useGenerateQuestions: () => ({
    isPending: false,
    isError: false,
    mutateAsync: vi.fn().mockResolvedValue({ questions: [], count: 0 }),
  }),
}));
import {
  AssessmentsPage,
  AssessmentDetailPage,
  AttemptPage,
} from './Pages';

const attempt = {
  id: '222222222222222222222222',
  assignmentId: '111111111111111111111111',
  title: 'Keyboard assessment',
  status: 'in-progress',
  expiresAt: '2099-01-01T00:00:00.000Z',
  allowBackNavigation: true,
  currentQuestion: 0,
  answers: {},
  questions: [
    {
      id: '333333333333333333333333',
      type: 'long-answer',
      prompt: 'First response',
      title: 'First',
      marks: 10,
      required: true,
      options: [],
      languages: [],
      starterCode: {},
    },
    {
      id: '444444444444444444444444',
      type: 'short-answer',
      prompt: 'Second response',
      title: 'Second',
      marks: 5,
      required: true,
      options: [],
      languages: [],
      starterCode: {},
    },
  ],
};
function renderAttempt(data = attempt) {
  mocks.attempt.mockReturnValue({
    isLoading: false,
    isError: false,
    data,
    refetch: vi.fn(),
  });
  return render(
    <MemoryRouter
      initialEntries={[
        '/candidate/assessments/111111111111111111111111/attempt/222222222222222222222222',
      ]}
    >
      <Routes>
        <Route
          path="/candidate/assessments/:assignmentId/attempt/:attemptId"
          element={<AttemptPage />}
        />
        <Route
          path="/candidate/assessments/:assignmentId/result/:attemptId"
          element={<div>Result route</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  mocks.auth.mockReturnValue({ recruiter: null });
  mocks.attempt.mockReturnValue({
    isLoading: false,
    isError: false,
    data: attempt,
    refetch: vi.fn(),
  });
  mocks.save.mockResolvedValue({ savedAt: new Date().toISOString() });
  mocks.submit.mockResolvedValue({});
  mocks.assessments.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: [] },
  });
});

describe('candidate assessment attempt resilience', () => {
  it('retains an interrupted answer and offers retry after a recoverable save failure', async () => {
    mocks.save.mockRejectedValueOnce(new Error('offline'));
    renderAttempt();
    const user = userEvent.setup();
    const field = screen.getByLabelText('First response');
    await user.type(field, 'preserve me');
    await user.click(screen.getByRole('button', { name: 'Save answer' }));
    expect(field).toHaveValue('preserve me');
    expect(screen.getByText(/Save failed/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save answer' }));
    expect(mocks.save).toHaveBeenCalledTimes(2);
  });
  it('disables saving and final submission after expiry and exposes an accessible timer', () => {
    renderAttempt({ ...attempt, expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(screen.getByRole('timer')).toHaveTextContent('Time expired');
    expect(screen.getByRole('button', { name: 'Save answer' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submit assessment' }),
    ).toBeDisabled();
  });
  it('supports keyboard-complete question navigation', async () => {
    renderAttempt();
    const user = userEvent.setup();
    const second = screen.getByRole('button', { name: 'Question 2' });
    second.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Second response')).toBeInTheDocument();
  });
  it('locks duplicate final submission while the first request is pending', async () => {
    let resolve!: () => void;
    mocks.submit.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    renderAttempt();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Submit assessment' }));
    const confirm = screen.getByRole('button', {
      name: 'Submit final answers',
    });
    await user.dblClick(confirm);
    expect(mocks.submit).toHaveBeenCalledTimes(1);
    resolve();
  });
});

describe('assessment permission gates', () => {
  it('does not request recruiter definitions without assessments.view', () => {
    mocks.auth.mockReturnValue({ recruiter: { permissions: [] } });
    render(
      <MemoryRouter>
        <AssessmentsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/assessments.view permission/)).toBeInTheDocument();
    expect(mocks.assessments).toHaveBeenCalledWith(expect.any(String), false);
  });
});

const sampleAssessment = {
  id: '111111111111111111111111',
  title: 'Full Stack Engineer Assessment',
  description: 'Technical skills assessment',
  type: 'mixed',
  durationMinutes: 60,
  passingPercentage: 70,
  allowBackNavigation: true,
  status: 'published',
  instructions: 'Please answer all questions carefully.',
  questions: [
    {
      id: '222222222222222222222222',
      type: 'short-answer',
      prompt: 'Explain REST',
      title: 'REST Question',
      marks: 10,
      required: true,
      options: [],
      languages: [],
      starterCode: {},
    },
  ],
};

const sampleCohortData = {
  summary: {
    totalAssigned: 5,
    notStarted: 1,
    inProgress: 1,
    underReview: 1,
    completed: 2,
    resultReleased: 0,
    overdue: 0,
    cancelled: 0,
  },
  candidates: [
    {
      assignmentId: 'assign11111111111111111111',
      applicationId: 'app1111111111111111111111',
      applicationNumber: 'APP-001',
      candidateId: 'cand111111111111111111111',
      candidateName: 'Alice Johnson',
      candidateEmail: 'alice@example.com',
      status: 'completed',
      rawStatus: 'completed',
      attemptsUsed: 1,
      score: 90,
      percentage: 90,
      passed: true,
      isProvisional: false,
      durationSeconds: 2400,
      submittedAt: '2026-03-15T10:00:00.000Z',
      categoryScores: [
        {
          category: 'backend',
          totalMarks: 50,
          awardedMarks: 45,
          percentage: 90,
          isProvisional: false,
        },
        {
          category: 'system-design',
          totalMarks: 50,
          awardedMarks: 45,
          percentage: 90,
          isProvisional: false,
        },
      ],
      university: 'State University',
      department: 'Computer Science',
      rank: 1,
    },
    {
      assignmentId: 'assign22222222222222222222',
      applicationId: 'app2222222222222222222222',
      applicationNumber: 'APP-002',
      candidateId: 'cand222222222222222222222',
      candidateName: 'Bob Smith',
      candidateEmail: 'bob@example.com',
      status: 'under-review',
      rawStatus: 'under-review',
      attemptsUsed: 1,
      score: 75,
      percentage: 75,
      passed: true,
      isProvisional: true,
      durationSeconds: 3100,
      submittedAt: '2026-03-15T11:00:00.000Z',
      categoryScores: [
        {
          category: 'backend',
          totalMarks: 50,
          awardedMarks: 40,
          percentage: 80,
          isProvisional: false,
        },
        {
          category: 'manual-review',
          totalMarks: 50,
          awardedMarks: 35,
          percentage: 70,
          isProvisional: true,
        },
      ],
      university: 'Tech Institute',
      department: 'Software Engineering',
      rank: 2,
    },
  ],
};

function renderAssessmentDetail(
  permissions: string[] = [
    'assessments.view',
    'assessments.manage',
    'applications.manage',
  ],
) {
  mocks.auth.mockReturnValue({
    recruiter: { permissions },
  });
  mocks.assessment.mockReturnValue({
    isLoading: false,
    isError: false,
    data: sampleAssessment,
    refetch: vi.fn(),
  });
  mocks.cohortLeaderboard.mockReturnValue({
    isLoading: false,
    isError: false,
    data: sampleCohortData,
    refetch: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={['/org/assessments/111111111111111111111111']}>
      <Routes>
        <Route
          path="/org/assessments/:assessmentId"
          element={<AssessmentDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('cohort leaderboard and competency breakdowns', () => {
  it('toggles between structure view and cohort leaderboard tab', async () => {
    renderAssessmentDetail();
    const user = userEvent.setup();

    expect(screen.getByText('Candidate instructions')).toBeInTheDocument();
    expect(screen.getByText('REST Question')).toBeInTheDocument();

    const leaderboardTab = screen.getByRole('tab', {
      name: 'Cohort Leaderboard & Results',
    });
    await user.click(leaderboardTab);

    expect(screen.getByText('Total Assigned')).toBeInTheDocument();
    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText(/APP-001/)).toBeInTheDocument();
    expect(screen.getByText('backend: 90%')).toBeInTheDocument();
    expect(screen.getByText('system-design: 90%')).toBeInTheDocument();

    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText(/manual-review:\s*70%/)).toBeInTheDocument();
    expect(screen.getByText('⚠️ Provisional')).toBeInTheDocument();
  });
});

describe('recruiter advancement and promotion flow', () => {
  it('requires explicit provisional confirmation when promoting provisional candidates', async () => {
    renderAssessmentDetail();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('tab', { name: 'Cohort Leaderboard & Results' }),
    );

    const bobCheckbox = screen.getByRole('checkbox', {
      name: 'Select Bob Smith',
    });
    await user.click(bobCheckbox);

    const advanceSelectedBtn = screen.getByRole('button', {
      name: /Advance Selected \(1\)/,
    });
    await user.click(advanceSelectedBtn);

    expect(
      screen.getByRole('heading', { name: 'Advance Candidates to Next Round' }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Interview Scheduling Notice/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/qualifies them for the interview round/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Provisional Scores Detected/i),
    ).toBeInTheDocument();

    const advanceBtn = screen.getByRole('button', {
      name: 'Advance 1 Candidate',
    });
    expect(advanceBtn).toBeDisabled();

    const allowCheckbox = screen.getByRole('checkbox', {
      name: /Allow advancing candidates with provisional reviews/i,
    });
    await user.click(allowCheckbox);

    expect(advanceBtn).toBeEnabled();

    mocks.promoteCandidates.mockResolvedValueOnce({
      summary: {
        requested: 1,
        promoted: 1,
        alreadyInStage: 0,
        failed: 0,
        targetStage: 'interview-scheduled',
        note: 'Successfully promoted 1 candidate(s)',
      },
      details: [
        {
          applicationId: 'app2222222222222222222222',
          candidateName: 'Bob Smith',
          status: 'promoted',
        },
      ],
    });

    await user.click(advanceBtn);

    expect(mocks.promoteCandidates).toHaveBeenCalledWith({
      applicationIds: ['app2222222222222222222222'],
      targetStage: 'interview-scheduled',
      reason: undefined,
      allowProvisional: true,
    });

    expect(
      await screen.findByRole('heading', { name: 'Advancement Results' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Already in Stage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('disables advance action when recruiter lacks applications.manage permission', async () => {
    renderAssessmentDetail(['assessments.view']);
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('tab', { name: 'Cohort Leaderboard & Results' }),
    );

    const aliceCheckbox = screen.getByRole('checkbox', {
      name: 'Select Alice Johnson',
    });
    await user.click(aliceCheckbox);

    expect(
      screen.getByText(/permission to advance candidates/i),
    ).toBeInTheDocument();

    const advanceBtn = screen.getByRole('button', {
      name: /Advance Selected \(1\)/,
    });
    expect(advanceBtn).toBeDisabled();
  });
});
