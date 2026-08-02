import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LandingPage } from './LandingPage';

// Mock the Auth hook to test in isolation
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    status: 'anonymous',
    signIn: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
  homeForRole: (role: string) => {
    if (role === 'candidate') return '/candidate';
    if (role === 'recruiter') return '/org';
    return '/admin';
  },
}));

describe('LandingPage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
  };

  it('renders landing page with hero, statistics, journeys, and comparison sections', () => {
    renderComponent();

    // Verify main Hero heading
    expect(
      screen.getByRole('heading', { name: /AI-Powered Skills-First Recruitment Platform/i })
    ).toBeInTheDocument();

    // Verify some value propositions
    expect(screen.getByText(/AI Resume Parsing/i)).toBeInTheDocument();
    expect(screen.getByText(/Skills-first Matching/i)).toBeInTheDocument();

    // Verify statistics are present
    expect(screen.getByText(/Candidates Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Partner Organizations/i)).toBeInTheDocument();

    // Verify Journey Timelines headings
    expect(screen.getByText(/Candidate Journey/i)).toBeInTheDocument();
    expect(screen.getByText(/Recruiter Journey/i)).toBeInTheDocument();

    // Verify Comparison table header
    expect(screen.getByRole('columnheader', { name: /Traditional ATS/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Talvix Platform/i })).toBeInTheDocument();
  });

  it('switches showcase tabs and changes content accordingly', async () => {
    renderComponent();

    // Initial state should be candidate showcase
    expect(screen.getByText(/Hello, Asha Rao/i)).toBeInTheDocument();
    expect(screen.queryByText(/Talvix Admin Dashboard/i)).not.toBeInTheDocument();

    // Click Admin tab
    const adminTab = screen.getByRole('button', { name: 'Admin' });
    fireEvent.click(adminTab);

    // Verify state updated
    await waitFor(() => {
      expect(screen.getByText(/Talvix Admin Dashboard/i)).toBeInTheDocument();
      expect(screen.queryByText(/Hello, Asha Rao/i)).not.toBeInTheDocument();
    });
  });

  it('expands FAQ Accordion on click', async () => {
    renderComponent();

    // Check first FAQ item
    const faqButton = screen.getByRole('button', { name: /How does Talvix work\?/i });
    expect(faqButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open
    fireEvent.click(faqButton);

    await waitFor(() => {
      expect(faqButton).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('has no automated accessibility violations', async () => {
    const { container } = renderComponent();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  }, 20000);
});
