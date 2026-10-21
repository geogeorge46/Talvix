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

// Mock apiRequest so tests don't make real network calls
vi.mock('../../api/client', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    jobs: [
      {
        _id: 'mock-job-1',
        title: 'Senior Full-Stack Engineer',
        company: { name: 'Acme Corp' },
        department: 'Engineering',
        location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' },
        workplaceType: 'Remote',
        skills: [
          { name: 'React', level: 'senior' },
          { name: 'Node.js', level: 'intermediate' },
        ],
        salary: { minimum: 120000, maximum: 160000 },
      },
    ],
  }),
}));

describe('LandingPage Component', () => {
  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>,
    );
  };

  it('renders landing page with hero, value propositions, and role sections matching the design', () => {
    renderComponent();

    // Verify main Hero heading
    expect(
      screen.getByRole('heading', {
        name: /Smarter Hiring for a Brighter Future/i,
      }),
    ).toBeInTheDocument();

    // Verify badge
    expect(
      screen.getByText(/AI-Powered Recruitment & Assessment/i),
    ).toBeInTheDocument();

    // Verify quick feature pills from mockup
    expect(screen.getAllByText(/AI Matching/i)[0]).toBeInTheDocument();
    expect(screen.getAllByText(/WebRTC Interviews/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Secure & Compliant/i)).toBeInTheDocument();

    // Verify the 4 role cards from mockup
    expect(
      screen.getByRole('heading', { name: /For Candidates/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /For Recruiters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /For Teams/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /For Administrators/i }),
    ).toBeInTheDocument();

    // Verify industry ticker
    expect(
      screen.getByText(/Empowering Talent Across Industries:/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/IT & Software/i)).toBeInTheDocument();
  });

  it('safely parses and displays database jobs with object locations and skill objects', async () => {
    renderComponent();

    // Verify database job title and formatted location string from { city, state, country } object
    await waitFor(() => {
      expect(
        screen.getAllByText(/Senior Full-Stack Engineer/i)[0],
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Bengaluru, Karnataka, India/i),
      ).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
    });
  });

  it('switches showcase tabs and changes content accordingly', async () => {
    renderComponent();

    // Initial state should be candidate showcase
    expect(screen.getByText(/Hello, Asha Rao/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Talvix Admin Dashboard/i),
    ).not.toBeInTheDocument();

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
    const faqButton = screen.getByRole('button', {
      name: /How does Talvix work\?/i,
    });
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
