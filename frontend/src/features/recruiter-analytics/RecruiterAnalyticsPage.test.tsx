import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  analytics: vi.fn(),
  apiRequest: vi.fn(),
}));

vi.mock('./api', () => ({
  useRecruiterAnalyticsQuery: () => mocks.analytics(),
}));

vi.mock('../../api/client', () => ({
  apiRequest: (...args: unknown[]) => mocks.apiRequest(...args),
}));

import { RecruiterAnalyticsPage } from './RecruiterAnalyticsPage';

describe('RecruiterAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiRequest.mockImplementation((path: string) => {
      if (path === '/analytics/saved-views') {
        return Promise.resolve({ views: [] });
      }
      return Promise.resolve({});
    });
    mocks.analytics.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        hiringFunnel: {
          jobsPublished: 5,
          applications: 100,
          screened: 60,
          assessmentCompleted: 40,
          interviewed: 20,
          offers: 10,
          hired: 8,
        },
        performanceMetrics: {
          averageTimeToHire: 14,
          averageApplicationsPerJob: 20,
          offerAcceptanceRate: 80,
          recruiterProductivity: 15,
          interviewSuccessRate: 75,
        },
        jobPerformance: {
          mostViewedJobs: [
            {
              _id: '64f1a2b3c4d5e6f7a8b9c0d1',
              title: 'Senior Frontend Developer',
              viewsCount: 250,
              applicationsCount: 45,
            },
          ],
          mostAppliedJobs: [
            {
              _id: '64f1a2b3c4d5e6f7a8b9c0d2',
              title: 'Full Stack Engineer',
              viewsCount: 200,
              applicationsCount: 50,
            },
          ],
        },
        assessmentAnalytics: {
          assessmentCompletionRate: 85,
          averageScores: 78,
          passRate: 70,
          aiMatchScoreDistribution: [
            { band: '90-100%', count: 15 },
            { band: '70-89%', count: 40 },
          ],
        },
      },
    });
  });

  it('renders Recruitment Analytics page with 5 metric cards, hiring funnel, and job performance tables', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/org/analytics']}>
          <Routes>
            <Route path="/org/analytics" element={<RecruiterAnalyticsPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(screen.getByRole('heading', { name: /recruitment analytics/i })).toBeInTheDocument();
    expect(screen.getByText('Time to Hire')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Hiring Funnel Progression')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /most viewed jobs/i })).toBeInTheDocument();
    expect(screen.getByText('Senior Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText(/#JOB-B9C0D1/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /assessment completion & pass rate/i })).toBeInTheDocument();
  });

  it('triggers CSV export on Export CSV button click', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/org/analytics']}>
          <Routes>
            <Route path="/org/analytics" element={<RecruiterAnalyticsPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/analytics/recruiter/export', {
      method: 'POST',
      body: {
        reportType: 'General Recruitment',
        format: 'csv',
      },
    });
  });
});
