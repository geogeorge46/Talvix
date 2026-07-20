import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  candidate: vi.fn(),
  processes: vi.fn(),
  auth: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useCandidateProcess: () => mocks.candidate(),
  useProcesses: (...a: unknown[]) => mocks.processes(...a),
  useProcess: () => ({ isLoading: false }),
  useProcessAction: () => ({}),
  useTemplate: () => ({ isLoading: false }),
  useTemplateAction: () => ({}),
  useTemplates: () => ({ isLoading: false, data: { items: [] } }),
  useTemplateSave: () => ({}),
  useCandidateProcesses: () => ({ isLoading: false, data: [] }),
}));
import { CandidateInterviewDetailPage } from './CandidatePages';
import { ProcessesPage } from './Pages';
describe('interview pages', () => {
  it('renders ordered candidate timeline without private feedback', () => {
    mocks.candidate.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: '111111111111111111111111',
        status: 'active',
        jobId: 'job',
        feedbackReleased: false,
        rounds: [
          {
            id: 'r1',
            name: 'Screen',
            type: 'screening',
            status: 'completed',
            order: 0,
            feedback: [],
          },
          {
            id: 'r2',
            name: 'Technical',
            type: 'technical',
            status: 'pending',
            order: 1,
            feedback: [],
          },
        ],
      },
    });
    render(
      <MemoryRouter
        initialEntries={['/candidate/interviews/111111111111111111111111']}
      >
        <Routes>
          <Route
            path="/candidate/interviews/:processId"
            element={<CandidateInterviewDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Screen');
    expect(
      screen.getByText(/private interviewer feedback/i),
    ).toBeInTheDocument();
  });
  it('suppresses process request without interviews.view', () => {
    mocks.auth.mockReturnValue({ recruiter: { permissions: [] } });
    mocks.processes.mockReturnValue({ isLoading: false, data: { items: [] } });
    render(
      <MemoryRouter>
        <ProcessesPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/interviews.view permission/i)).toBeInTheDocument();
    expect(mocks.processes).toHaveBeenCalledWith(expect.any(String), false);
  });
});
