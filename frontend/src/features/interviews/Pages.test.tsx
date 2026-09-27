import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  candidate: vi.fn(),
  processes: vi.fn(),
  auth: vi.fn(),
  calendar: vi.fn(),
}));
vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => mocks.auth() }));
vi.mock('./api', () => ({
  useCandidateProcess: () => mocks.candidate(),
  useProcesses: (...a: unknown[]) => mocks.processes(...a),
  useCalendar: (...a: unknown[]) => mocks.calendar(...a),
  useProcess: () => ({ isLoading: false }),
  useProcessAction: () => ({}),
  useTemplate: () => ({ isLoading: false }),
  useTemplateAction: () => ({}),
  useTemplates: () => ({ isLoading: false, data: { items: [] } }),
  useTemplateSave: () => ({}),
  useCandidateProcesses: () => ({ isLoading: false, data: [] }),
}));
import { CandidateInterviewDetailPage } from './CandidatePages';
import { ProcessesPage, CalendarPage } from './Pages';
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

  it('renders redesigned interview processes page with metric summary cards and toolbar', () => {
    mocks.auth.mockReturnValue({
      recruiter: { permissions: ['interviews.view', 'interviews.manage'] },
    });
    mocks.processes.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: '64f1a2b3c4d5e6f7a8b9c0d1',
            applicationId: 'app12345678',
            status: 'active',
            rounds: [{ id: 'r1', name: 'Technical Round' }],
            createdAt: '2026-09-25T10:00:00.000Z',
          },
        ],
        pagination: { total: 1 },
      },
    });

    render(
      <MemoryRouter>
        <ProcessesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /interview processes/i })).toBeInTheDocument();
    expect(screen.getByText('Total Processes')).toBeInTheDocument();
    expect(screen.getByText('Active Execution')).toBeInTheDocument();
    expect(screen.getByText('Draft Processes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search processes by application/i)).toBeInTheDocument();
    expect(screen.getByText('#PRC-B9C0D1')).toBeInTheDocument();
    expect(screen.getByText('Open Process')).toBeInTheDocument();
  });

  it('renders interview calendar page with valid from and to query parameters', () => {
    mocks.auth.mockReturnValue({
      recruiter: { permissions: ['interviews.view'] },
    });
    mocks.calendar.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [],
    });

    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /recruiter interview calendar/i })).toBeInTheDocument();
    expect(mocks.calendar).toHaveBeenCalledWith(
      expect.stringMatching(/^from=.+&to=.+$/),
      true,
    );
  });
});

