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
  useAssessment: () => ({ isLoading: false }),
  useAssessmentAction: () => ({}),
  useAssessmentSave: () => ({}),
  useAssignment: () => ({ isLoading: false }),
  useAssignments: () => ({ isLoading: false, data: { items: [] } }),
  useResult: () => ({ isLoading: false }),
  useReviews: () => ({ isLoading: false, data: [] }),
  useStart: () => ({}),
}));
import { AssessmentsPage, AttemptPage } from './Pages';

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
