import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TechnicalAssessmentWorkspace } from './components/technical/TechnicalAssessmentWorkspace';
import { Question } from './model';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options }: any) => (
    <textarea
      data-testid="monaco-editor"
      value={value || ''}
      onChange={(e: any) => onChange?.(e.target.value)}
      disabled={options?.readOnly}
    />
  ),
}));

vi.mock('./services/technicalAssessmentApi', () => ({
  technicalAssessmentApi: {
    getTechnicalDraft: vi.fn().mockResolvedValue(null),
    saveTechnicalDraft: vi.fn().mockResolvedValue({}),
    submitTechnicalResponse: vi.fn().mockResolvedValue({}),
    runCodingQuestion: vi.fn().mockResolvedValue({
      status: 'unavailable',
      message: 'Execution service unavailable in Phase 1',
    }),
  },
}));

vi.mock('./hooks/useTechnicalDraft', () => ({
  useTechnicalDraft: () => ({
    draft: {},
    setDraft: vi.fn(),
    saveStatus: 'saved',
    lastSavedAt: null,
  }),
}));

const mockAttempt = {
  id: 'attempt11111111111111111111',
  assignmentId: 'assign11111111111111111111',
  title: 'Full Stack Coding Challenge',
  status: 'in-progress' as const,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  allowBackNavigation: true,
  currentQuestion: 0,
  answers: {},
  questions: [
    {
      id: 'q111111111111111111111111',
      type: 'coding' as const,
      title: 'Two Sum Problem',
      prompt: 'Write a function twoSum(nums, target) that returns indices of two numbers adding up to target.',
      marks: 25,
      required: true,
      languages: ['javascript', 'python'],
      starterCode: { javascript: 'function twoSum(nums, target) {\n  // your code here\n}' },
      coding: {
        languageSupport: ['javascript', 'python'],
        starterCode: { javascript: 'function twoSum(nums, target) {\n  // your code here\n}' },
        functionName: 'twoSum',
        testCases: [{ input: '[2, 7, 11, 15], 9', expectedOutput: '[0, 1]', weight: 1, isHidden: false }],
      },
    },
  ],
};

describe('TechnicalAssessmentWorkspace Component', () => {
  it('renders problem header, prompt, sample test cases, and Monaco editor', () => {
    const { unmount } = render(
      <TechnicalAssessmentWorkspace
        attemptId={mockAttempt.id}
        assessmentTitle={mockAttempt.title}
        expiresAt={mockAttempt.expiresAt}
        questions={mockAttempt.questions as Question[]}
        initialIndex={0}
        onSubmitAttempt={vi.fn()}
      />
    );

    expect(screen.getAllByText('Two Sum Problem').length).toBeGreaterThan(0);
    expect(screen.getByText(/Write a function twoSum/i)).toBeInTheDocument();
    expect(screen.getByTestId('monaco-editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit Technical Task/i })).toBeInTheDocument();
    unmount();
  });

  it('triggers execution and displays unavailable state in console when Run Code is clicked', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <TechnicalAssessmentWorkspace
        attemptId={mockAttempt.id}
        assessmentTitle={mockAttempt.title}
        expiresAt={mockAttempt.expiresAt}
        questions={mockAttempt.questions as Question[]}
        initialIndex={0}
        onSubmitAttempt={vi.fn()}
      />
    );

    const runBtn = screen.getByRole('button', { name: /Run Code/i });
    await user.click(runBtn);

    expect(await screen.findByText(/Execution service unavailable in Phase 1/i)).toBeInTheDocument();
    unmount();
  });
});
