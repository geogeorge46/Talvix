import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  HelpCircle,
  CheckSquare,
  Code2,
  AlignLeft,
  Search,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Briefcase,
} from 'lucide-react';
import { useApplications } from '../ats-workspace/api';
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateField,
  Dialog,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  Select,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import {
  useCreateAssignment,
  useQuestionSave,
  useQuestions,
  useAssessments,
  useAssessment,
  useCheckEligibility,
  useGenerateQuestions,
} from './api';
import { label, type Question, type EligibilityCheckResult } from './model';
import { Tabs } from './Pages';

function AIGenerateQuestionsModal({
  open,
  onClose,
  onQuestionsGenerated,
}: {
  open: boolean;
  onClose: () => void;
  onQuestionsGenerated?: () => void;
}) {
  const generate = useGenerateQuestions();
  const [topic, setTopic] = useState('');
  const [skills, setSkills] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [type, setType] = useState<'mixed' | 'single-choice' | 'multiple-choice' | 'coding' | 'work-sample'>('mixed');
  const [count, setCount] = useState('3');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    const skillsList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const numCount = Math.min(Math.max(parseInt(count, 10) || 3, 1), 10);
    try {
      const res = await generate.mutateAsync({
        topic: topic.trim(),
        ...(skillsList.length ? { skills: skillsList } : {}),
        difficulty,
        type,
        count: numCount,
      });
      setGeneratedQuestions(res.questions);
      setHasGenerated(true);
      onQuestionsGenerated?.();
    } catch {
      // Handled by generate.isError
    }
  };

  const handleReset = () => {
    setTopic('');
    setSkills('');
    setDifficulty('medium');
    setType('mixed');
    setCount('3');
    setGeneratedQuestions([]);
    setHasGenerated(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleReset();
          onClose();
        }
      }}
      title="✨ Generate Questions with AI"
      description="Leverage AI to create production-ready assessment questions directly in your Question Bank."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!hasGenerated ? (
          <form
            onSubmit={handleGenerate}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            <TextField
              label="Topic or Focus Area"
              required
              placeholder="e.g. React Performance & Virtualization, PostgreSQL Indexing, Python Async"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <TextField
              label="Key Skills (comma-separated, optional)"
              placeholder="e.g. React, TypeScript, Concurrent Mode"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <Select
                label="Difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
              <Select
                label="Question Type"
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as
                      | 'mixed'
                      | 'single-choice'
                      | 'multiple-choice'
                      | 'coding'
                      | 'work-sample',
                  )
                }
                options={[
                  { value: 'mixed', label: 'Mixed Types' },
                  { value: 'single-choice', label: 'Single Choice' },
                  { value: 'multiple-choice', label: 'Multiple Choice' },
                  { value: 'coding', label: 'Coding Challenge' },
                  { value: 'work-sample', label: 'Work Sample' },
                ]}
              />
              <Select
                label="Count"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                options={[
                  { value: '1', label: '1 question' },
                  { value: '2', label: '2 questions' },
                  { value: '3', label: '3 questions' },
                  { value: '5', label: '5 questions' },
                ]}
              />
            </div>

            {generate.isError && (
              <Alert tone="danger" title="Generation failed">
                {generate.error instanceof Error
                  ? generate.error.message
                  : 'An error occurred during question generation.'}
              </Alert>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <Button variant="secondary" onClick={onClose} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={generate.isPending}
                disabled={!topic.trim()}
              >
                ✨ Generate Questions
              </Button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Alert tone="success" title="Questions Generated & Saved!">
              {generatedQuestions.length} production-grade question
              {generatedQuestions.length === 1 ? '' : 's'} created and added to your Question Bank.
            </Alert>

            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              {generatedQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    padding: '12px 14px',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '6px',
                    backgroundColor: 'var(--color-bg-subtle, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ fontSize: '14px', color: 'var(--color-text-default)' }}>
                      {q.title || q.prompt}
                    </strong>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      {q.marks} marks
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        backgroundColor: 'var(--color-surface-2, #e2e8f0)',
                        color: 'var(--color-text-default)',
                      }}
                    >
                      {label(q.type)}
                    </span>
                    {q.category && (
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: '#e0f2fe',
                          color: '#0369a1',
                        }}
                      >
                        {q.category}
                      </span>
                    )}
                    {q.difficulty && (
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          backgroundColor: 'var(--color-surface-1, #f1f5f9)',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {q.difficulty}
                      </span>
                    )}
                    {q.skills && q.skills.length > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                        Skills: {q.skills.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setHasGenerated(false)}>
                ← Generate More
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  handleReset();
                  onClose();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function QuestionBankPage() {
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('assessments.view'));
  const canManage = Boolean(
    recruiter?.permissions.includes('assessments.manage'),
  );
  const query = useQuestions(canView);
  const save = useQuestionSave();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [prompt, setPrompt] = useState(''),
    [type, setType] = useState('long-answer'),
    [difficulty, setDifficulty] = useState('medium'),
    [marks, setMarks] = useState('10');
  const [optionsList, setOptionsList] = useState<{ text: string }[]>([{ text: '' }, { text: '' }]);
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState<number | null>(null);
  const [selectedCorrectIndices, setSelectedCorrectIndices] = useState<Record<number, boolean>>({});
  const [correctBoolean, setCorrectBoolean] = useState<boolean | null>(null);
  const [acceptedAnswersText, setAcceptedAnswersText] = useState('');
  const [delivType, setDelivType] = useState<'file' | 'url' | 'text' | 'mixed'>('mixed');
  const [delivInstructions, setDelivInstructions] = useState('');
  const [delivFormats, setDelivFormats] = useState('.pdf, .fig, .zip');
  const [delivMaxFiles, setDelivMaxFiles] = useState('3');
  const [rubricCriteria, setRubricCriteria] = useState<{ name: string; description: string; maxMarks: number; weight: number }[]>([
    { name: 'Quality of Execution', description: 'Overall execution and accuracy', maxMarks: 50, weight: 50 },
    { name: 'Approach & Clarity', description: 'Methodology and structure', maxMarks: 50, weight: 50 },
  ]);
  const [rubricNotes, setRubricNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  if (!canView)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  if (query.isError)
    return (
      <ErrorState
        detail={
          query.error instanceof Error
            ? query.error.message
            : 'Could not load questions.'
        }
        retry={() => void query.refetch()}
      />
    );

  const allQuestions = (query.data?.items ?? []) as Question[];
  const countTotal = allQuestions.length;
  const countChoice = allQuestions.filter((q) =>
    ['single-choice', 'multiple-choice', 'true-false'].includes(q.type),
  ).length;
  const countCoding = allQuestions.filter((q) =>
    ['coding', 'sql', 'debugging'].includes(q.type),
  ).length;
  const countText = allQuestions.filter((q) =>
    ['long-answer', 'short-answer', 'work-sample'].includes(q.type),
  ).length;

  const filteredQuestions = allQuestions.filter((q) => {
    if (filterType && q.type !== filterType) return false;
    if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (q.title || '').toLowerCase().includes(term) ||
      (q.prompt || '').toLowerCase().includes(term) ||
      (q.category || '').toLowerCase().includes(term) ||
      (q.skills || []).some((s) => s.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredQuestions.length / pageSize) || 1;
  const paginatedQuestions = filteredQuestions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <div className="as-page">
      <div className="as-page-header-row">
        <div>
          <PageHeader
            title="Question Bank"
            description="Manage reusable questions. Coding questions store source text only; no compiler is provided."
          />
        </div>
        <Tabs />
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="as-metrics-grid">
        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <HelpCircle size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              Library
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Total Questions</span>
            <span className="as-metric-card__val">{countTotal}</span>
            <span className="as-metric-card__sub">Reusable item pool</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#16a34a' }}>
              <CheckSquare size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              Objective
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Choice & Boolean</span>
            <span className="as-metric-card__val">{countChoice}</span>
            <span className="as-metric-card__sub">Instant automatic grading</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#0284c7' }}>
              <Code2 size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--info">
              Technical
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Coding & SQL</span>
            <span className="as-metric-card__val">{countCoding}</span>
            <span className="as-metric-card__sub">Algorithmic & query prompts</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#7c3aed' }}>
              <AlignLeft size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--warning">
              Subjective
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Text & Work Sample</span>
            <span className="as-metric-card__val">{countText}</span>
            <span className="as-metric-card__sub">Rubric & recruiter scored</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar */}
      <div className="as-modern-toolbar">
        <div className="as-toolbar-filters">
          <div className="as-search-container">
            <Search className="as-search-icon" size={16} />
            <input
              type="text"
              className="as-search-input"
              placeholder="Search prompt, skills, category..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="as-search-clear"
                onClick={() => {
                  setSearchTerm('');
                  setPage(1);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Type</span>
            <select
              className="as-pill-select"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="single-choice">Single Choice</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="true-false">True / False</option>
              <option value="coding">Coding</option>
              <option value="sql">SQL</option>
              <option value="work-sample">Work Sample</option>
              <option value="short-answer">Short Answer</option>
              <option value="long-answer">Long Answer</option>
            </select>
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Difficulty</span>
            <select
              className="as-pill-select"
              value={filterDifficulty}
              onChange={(e) => {
                setFilterDifficulty(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {(searchTerm || filterType || filterDifficulty) && (
            <button
              type="button"
              className="as-action-link"
              onClick={() => {
                setSearchTerm('');
                setFilterType('');
                setFilterDifficulty('');
                setPage(1);
              }}
              style={{ height: '42px', borderRadius: '9999px', padding: '0 16px' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>

        <div className="as-toolbar-actions">
          {canManage && (
            <button
              type="button"
              className="as-btn-black"
              onClick={() => setIsFormOpen((prev) => !prev)}
            >
              <Plus size={16} /> {isFormOpen ? 'Close Form' : 'Add Question'}
            </button>
          )}
          <button
            type="button"
            className="as-action-link"
            onClick={() => setAiModalOpen(true)}
            style={{ height: '42px', borderRadius: '9999px', padding: '0 16px', fontWeight: 600 }}
          >
            <Sparkles size={16} /> AI Generate
          </button>
        </div>
      </div>

      {canManage && isFormOpen && (
        <Card heading="Create Question" headingLevel={2}>
          <Select
            label="Question type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[
              'long-answer',
              'short-answer',
              'single-choice',
              'multiple-choice',
              'true-false',
              'coding',
              'work-sample',
            ].map((x) => ({ value: x, label: label(x) }))}
          />
          <TextArea
            label="Prompt"
            required
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Select
            label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            options={['easy', 'medium', 'hard'].map((x) => ({
              value: x,
              label: label(x),
            }))}
          />
          <TextField
            label="Default marks"
            type="number"
            min="1"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
          />
          {['single-choice', 'multiple-choice'].includes(type) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-default)' }}>Options (at least 2 required)</strong>
              {optionsList.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {type === 'single-choice' ? (
                    <input
                      type="radio"
                      name="correct-option"
                      checked={selectedCorrectIndex === idx}
                      onChange={() => setSelectedCorrectIndex(idx)}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={!!selectedCorrectIndices[idx]}
                      onChange={(e) =>
                        setSelectedCorrectIndices({
                          ...selectedCorrectIndices,
                          [idx]: e.target.checked,
                        })
                      }
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt.text}
                    onChange={(e) => {
                      const newList = [...optionsList];
                      newList[idx] = { text: e.target.value };
                      setOptionsList(newList);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      border: '1px solid var(--color-border-default)',
                      borderRadius: '4px',
                      backgroundColor: 'var(--color-bg-default)',
                      color: 'var(--color-text-default)',
                    }}
                  />
                  {optionsList.length > 2 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const newList = optionsList.filter((_, i) => i !== idx);
                        setOptionsList(newList);
                        if (type === 'single-choice') {
                          if (selectedCorrectIndex === idx) setSelectedCorrectIndex(null);
                          else if (selectedCorrectIndex !== null && selectedCorrectIndex > idx)
                            setSelectedCorrectIndex(selectedCorrectIndex - 1);
                        } else {
                          const newCorrects: Record<number, boolean> = {};
                          Object.keys(selectedCorrectIndices).forEach((k) => {
                            const keyNum = Number(k);
                            if (keyNum < idx) newCorrects[keyNum] = !!selectedCorrectIndices[keyNum];
                            else if (keyNum > idx) newCorrects[keyNum - 1] = !!selectedCorrectIndices[keyNum];
                          });
                          setSelectedCorrectIndices(newCorrects);
                        }
                      }}
                      style={{ padding: '6px 12px' }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setOptionsList([...optionsList, { text: '' }])}
                style={{ alignSelf: 'flex-start', marginTop: '4px' }}
              >
                Add Option
              </Button>
            </div>
          )}
          {type === 'true-false' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '12px 0' }}>
              <strong style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-default)' }}>Correct Answer</strong>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="correct-tf"
                    checked={correctBoolean === true}
                    onChange={() => setCorrectBoolean(true)}
                  />
                  True
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="correct-tf"
                    checked={correctBoolean === false}
                    onChange={() => setCorrectBoolean(false)}
                  />
                  False
                </label>
              </div>
            </div>
          )}
          {type === 'short-answer' && (
            <div style={{ margin: '12px 0' }}>
              <TextField
                label="Correct Answer (accepted answers, comma-separated)"
                required
                placeholder="e.g. JavaScript, JS"
                value={acceptedAnswersText}
                onChange={(e) => setAcceptedAnswersText(e.target.value)}
              />
            </div>
          )}
          {type === 'work-sample' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '16px 0', padding: '16px', border: '1px solid var(--color-border-default)', borderRadius: '6px', background: 'var(--color-bg-subtle)' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Deliverable Configuration</h4>
              <Select
                label="Deliverable Type"
                value={delivType}
                onChange={(e) => setDelivType(e.target.value as 'file' | 'url' | 'text' | 'mixed')}
                options={[
                  { value: 'mixed', label: 'Mixed (File + URL/Text)' },
                  { value: 'file', label: 'File Upload Only' },
                  { value: 'url', label: 'URL Link Only' },
                  { value: 'text', label: 'Text Strategy Only' },
                ]}
              />
              <TextArea
                label="Candidate Submission Instructions"
                required
                placeholder="Specify what assets or links the candidate needs to submit..."
                value={delivInstructions}
                onChange={(e) => setDelivInstructions(e.target.value)}
              />
              {['file', 'mixed'].includes(delivType) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <TextField
                    label="Allowed File Formats (comma-separated)"
                    value={delivFormats}
                    onChange={(e) => setDelivFormats(e.target.value)}
                  />
                  <TextField
                    label="Maximum Files (1-10)"
                    type="number"
                    min="1"
                    max="10"
                    value={delivMaxFiles}
                    onChange={(e) => setDelivMaxFiles(e.target.value)}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Rubric Criteria</h4>
                <span style={{ fontSize: '13px', fontWeight: 600, color: rubricCriteria.reduce((acc, c) => acc + c.weight, 0) === 100 ? 'green' : 'red' }}>
                  Total Weight: {rubricCriteria.reduce((acc, c) => acc + c.weight, 0)}% (must be 100%)
                </span>
              </div>
              {rubricCriteria.map((c, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', alignItems: 'flex-end', background: 'var(--color-bg-default)', padding: '10px', borderRadius: '4px', border: '1px solid var(--color-border-default)' }}>
                  <TextField
                    label={idx === 0 ? 'Criterion Name' : ''}
                    placeholder="e.g. Design Execution"
                    value={c.name}
                    onChange={(e) => {
                      setRubricCriteria(
                        rubricCriteria.map((item, i) =>
                          i === idx ? { ...item, name: e.target.value } : item,
                        ),
                      );
                    }}
                  />
                  <TextField
                    label={idx === 0 ? 'Max Marks' : ''}
                    type="number"
                    min="1"
                    value={String(c.maxMarks)}
                    onChange={(e) => {
                      setRubricCriteria(
                        rubricCriteria.map((item, i) =>
                          i === idx
                            ? { ...item, maxMarks: Number(e.target.value) || 0 }
                            : item,
                        ),
                      );
                    }}
                  />
                  <TextField
                    label={idx === 0 ? 'Weight (%)' : ''}
                    type="number"
                    min="1"
                    max="100"
                    value={String(c.weight)}
                    onChange={(e) => {
                      setRubricCriteria(
                        rubricCriteria.map((item, i) =>
                          i === idx
                            ? { ...item, weight: Number(e.target.value) || 0 }
                            : item,
                        ),
                      );
                    }}
                  />
                  {rubricCriteria.length > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => setRubricCriteria(rubricCriteria.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setRubricCriteria([...rubricCriteria, { name: '', description: '', maxMarks: 20, weight: 0 }])}
              >
                + Add Criterion
              </Button>
              <TextArea
                label="Recruiter-Only Evaluation Notes"
                placeholder="Internal grading guidelines or expectations (not shown to candidate)"
                value={rubricNotes}
                onChange={(e) => setRubricNotes(e.target.value)}
              />
            </div>
          )}
          <Button
            onClick={() => {
              const finalOptions = ['single-choice', 'multiple-choice'].includes(type)
                ? optionsList
                    .filter((o) => o.text.trim())
                    .map((o, idx) => ({ id: `opt_${idx}_${Date.now()}`, text: o.text.trim() }))
                : type === 'true-false'
                  ? [
                      { id: 'true', text: 'True' },
                      { id: 'false', text: 'False' },
                    ]
                  : [];

              let correctAnswer: unknown = undefined;
              if (type === 'single-choice' && selectedCorrectIndex !== null) {
                const opt = finalOptions[selectedCorrectIndex];
                if (opt) correctAnswer = { optionId: opt.id };
              } else if (type === 'multiple-choice') {
                const optionIds = finalOptions
                  .filter((_, idx) => selectedCorrectIndices[idx])
                  .map((o) => o.id);
                correctAnswer = { optionIds };
              } else if (type === 'true-false' && correctBoolean !== null) {
                correctAnswer = { value: correctBoolean };
              } else if (type === 'short-answer') {
                const acceptedAnswers = acceptedAnswersText
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean);
                correctAnswer = {
                  acceptedAnswers,
                  caseSensitive: false,
                  trimWhitespace: true,
                };
              }

              void save.mutateAsync({
                type,
                prompt,
                difficulty,
                defaultMarks: Number(marks),
                skills: [],
                options: finalOptions,
                correctAnswer,
                isReusable: true,
                ...(type === 'work-sample'
                  ? {
                      deliverable: {
                        type: delivType,
                        instructions: delivInstructions,
                        allowedFormats: delivFormats.split(',').map((s) => s.trim()).filter(Boolean),
                        maxFiles: Number(delivMaxFiles) || 1,
                        maxFileSizeBytes: 50 * 1024 * 1024,
                        referenceAssets: [],
                      },
                      rubric: {
                        criteria: rubricCriteria,
                        evaluationNotes: rubricNotes,
                      },
                    }
                  : {}),
                ...(type === 'coding'
                  ? {
                      coding: {
                        languageSupport: ['javascript'],
                        starterCode: { javascript: '' },
                        functionName: 'solution',
                        testCases: [
                          {
                            input: null,
                            expectedOutput: null,
                            isHidden: false,
                            weight: 1,
                          },
                        ],
                      },
                    }
                  : {}),
              }).then(() => {
                setPrompt('');
                setOptionsList([{ text: '' }, { text: '' }]);
                setSelectedCorrectIndex(null);
                setSelectedCorrectIndices({});
                setCorrectBoolean(null);
                setAcceptedAnswersText('');
                setDelivInstructions('');
              });
            }}
            loading={save.isPending}
            disabled={
              !prompt.trim() ||
              (type === 'single-choice' && (optionsList.filter(o => o.text.trim()).length < 2 || selectedCorrectIndex === null)) ||
              (type === 'multiple-choice' && (optionsList.filter(o => o.text.trim()).length < 2 || !Object.values(selectedCorrectIndices).some(Boolean))) ||
              (type === 'true-false' && correctBoolean === null) ||
              (type === 'short-answer' && !acceptedAnswersText.trim()) ||
              (type === 'work-sample' && (!delivInstructions.trim() || rubricCriteria.reduce((sum, c) => sum + c.weight, 0) !== 100))
            }
          >
            Create question
          </Button>
          <Button
            variant="secondary"
            onClick={() => setAiModalOpen(true)}
            type="button"
            style={{ marginLeft: '12px' }}
          >
            ✨ Generate Questions with AI
          </Button>
          {save.isError && (
            <Alert tone="danger" title="Question not created">
              {save.error instanceof Error
                ? save.error.message
                : 'Check the fields.'}
            </Alert>
          )}
        </Card>
      )}
      <div className="as-table-card">
        {query.isError ? (
          <div style={{ padding: '24px' }}>
            <ErrorState
              detail={
                query.error instanceof Error
                  ? query.error.message
                  : 'Could not load questions.'
              }
              retry={() => void query.refetch()}
            />
          </div>
        ) : query.isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <LoadingState label="Loading question bank..." />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              title="No questions found"
              description="Create your first question or adjust your filters."
            />
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-modern-table">
              <thead>
                <tr>
                  <th>Question ID</th>
                  <th>Prompt & Skills</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Difficulty</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuestions.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <span className="as-code-badge">
                        #QST-{q.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="as-entity-cell">
                        <div className="as-entity-icon">
                          {['coding', 'sql'].includes(q.type) ? (
                            <Code2 size={18} />
                          ) : q.type === 'work-sample' ? (
                            <Briefcase size={18} />
                          ) : (
                            <HelpCircle size={18} />
                          )}
                        </div>
                        <div className="as-entity-info">
                          <strong className="as-entity-title">
                            {q.title || q.prompt}
                          </strong>
                          {q.skills && q.skills.length > 0 && (
                            <div className="as-chip-list" style={{ marginTop: '4px' }}>
                              {q.skills.map((s, idx) => (
                                <span key={idx} className="as-chip">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          textTransform: 'capitalize',
                        }}
                      >
                        {label(q.type)}
                      </span>
                    </td>
                    <td>
                      {q.category ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#0f172a',
                          }}
                        >
                          {q.category}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`as-diff-badge as-diff-badge--${q.difficulty || 'medium'}`}
                      >
                        {q.difficulty || 'medium'}
                      </span>
                    </td>
                    <td>
                      <span className="as-code-badge">{q.marks} pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Custom Pagination Footer */}
            <div className="as-pagination-footer">
              <div className="as-pagination-info">
                Showing{' '}
                <strong>
                  {filteredQuestions.length > 0 ? (page - 1) * pageSize + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(page * pageSize, filteredQuestions.length)}
                </strong>{' '}
                of <strong>{filteredQuestions.length}</strong> questions
              </div>

              <div className="as-pagination-controls">
                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`as-page-btn ${pageNum === page ? 'as-page-btn--active' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AIGenerateQuestionsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onQuestionsGenerated={() => void query.refetch()}
      />
    </div>
  );
}

export function CreateAssignmentPage() {
  const { recruiter } = useAuth();
  const can = Boolean(recruiter?.permissions.includes('assessments.assign'));
  const create = useCreateAssignment();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const initialAppId = searchParams.get('applicationId') || '';
  const initialAssessmentId = searchParams.get('assessmentId') || '';

  const [assessmentId, setAssessmentId] = useState(initialAssessmentId);
  const [applicationId, setApplicationId] = useState(initialAppId);
  const [manualInput, setManualInput] = useState(Boolean(initialAppId));
  const [todayStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [availableFrom, setAvailableFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState(() => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [rawEligibilityResult, setEligibilityResult] =
    useState<EligibilityCheckResult | null>(null);

  const checkEligibility = useCheckEligibility();
  const assessmentsQuery = useAssessments('page=1&limit=50&status=published', can);
  const selectedAssessmentQuery = useAssessment(assessmentId, can && Boolean(assessmentId));
  const applicationsQuery = useApplications(
    'page=1&limit=50&sort=newest',
    can && !initialAppId && !manualInput,
  );

  const isAppIdValid = Boolean(
    assessmentId && applicationId && /^[a-f\d]{24}$/i.test(applicationId),
  );
  const eligibilityResult = isAppIdValid ? rawEligibilityResult : null;

  const minExpiryStr = availableFrom
    ? new Date(new Date(availableFrom).getTime() + 86400000).toISOString().slice(0, 10)
    : todayStr;

  const isAvailableDatePast = Boolean(availableFrom && availableFrom < todayStr);
  const isExpiryDateBeforeOrEqual = Boolean(
    availableFrom && expiresAt && expiresAt <= availableFrom,
  );
  const isDateRangeValid = !isAvailableDatePast && !isExpiryDateBeforeOrEqual && Boolean(availableFrom && expiresAt);

  const availableDateError = isAvailableDatePast
    ? 'Available date cannot be in the past. Please select today or a future date.'
    : undefined;

  const expiryDateError = isExpiryDateBeforeOrEqual
    ? 'Expiry date must be strictly after the available date.'
    : undefined;

  const lastCheckedKeyRef = useRef<string>('');
  const checkEligibilityMutate = checkEligibility.mutate;

  useEffect(() => {
    const key = `${assessmentId}:${applicationId}`;
    if (isAppIdValid && lastCheckedKeyRef.current !== key) {
      lastCheckedKeyRef.current = key;
      checkEligibilityMutate(
        { assessmentId, applicationIds: [applicationId] },
        {
          onSuccess: (data) => setEligibilityResult(data),
          onError: () => {
            lastCheckedKeyRef.current = '';
            setEligibilityResult(null);
          },
        },
      );
    } else if (!isAppIdValid) {
      lastCheckedKeyRef.current = '';
    }
  }, [assessmentId, applicationId, isAppIdValid, checkEligibilityMutate]);

  if (!can) {
    return (
      <PermissionState description="The assessments.assign permission is required." />
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentId) return;
    const now = new Date();
    const todayLocalStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fromDate = availableFrom === todayLocalStr ? now : new Date(`${availableFrom}T00:00:00`);
    const toDate = expiresAt.includes('T') ? new Date(expiresAt) : new Date(`${expiresAt}T23:59:59`);

    const x = await create.mutateAsync({
      assessmentId,
      applicationId,
      availableFrom: fromDate.toISOString(),
      expiresAt: toDate.toISOString(),
    });
    const assignmentObj = x.assignment as { _id?: string; id?: string } | undefined;
    const id = assignmentObj?._id || assignmentObj?.id;
    if (id) nav(`/org/assessments/assignments/${id}`);
  };

  const assessments = assessmentsQuery.data?.items ?? [];

  if (!assessmentId) {
    return (
      <div className="as-page">
        <PageHeader
          title="Assign assessment"
          description="Choose a published assessment to assign to the candidate application."
        />
        {assessmentsQuery.isLoading ? (
          <LoadingState label="Loading published assessments" />
        ) : assessmentsQuery.isError ? (
          <ErrorState
            detail={
              assessmentsQuery.error instanceof Error
                ? assessmentsQuery.error.message
                : 'Could not load assessments.'
            }
            retry={() => void assessmentsQuery.refetch()}
          />
        ) : assessments.length === 0 ? (
          <EmptyState
            title="No published assessments"
            description="You need to create and publish an assessment before assigning it to a candidate."
          />
        ) : (
          <Card heading="Select Assessment" headingLevel={2}>
            <DataTable
              rows={assessments}
              rowKey={(r) => r.id}
              columns={[
                {
                  id: 'title',
                  header: 'Title',
                  render: (r) => (
                    <div>
                      <strong>{r.title}</strong>
                      <div className="text-sm text-slate-500">{r.description || 'No description'}</div>
                    </div>
                  ),
                },
                {
                  id: 'type',
                  header: 'Type',
                  render: (r) => r.type,
                },
                {
                  id: 'duration',
                  header: 'Duration',
                  render: (r) => `${r.durationMinutes} mins`,
                },
                {
                  id: 'passingPercentage',
                  header: 'Passing Criteria',
                  render: (r) => `${r.passingPercentage}% score`,
                },
                {
                  id: 'action',
                  header: 'Action',
                  render: (r) => (
                    <Button variant="secondary" onClick={() => setAssessmentId(r.id)}>
                      Select
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        )}
      </div>
    );
  }

  const selectedAssessment = selectedAssessmentQuery.data;
  const questionsList = selectedAssessment?.questions ?? [];
  const mcqCount = questionsList.filter((q) =>
    ['single-choice', 'multiple-choice', 'true-false'].includes(q.type)
  ).length;
  const codingCount = questionsList.filter((q) => q.type === 'coding').length;

  return (
    <form className="as-page" onSubmit={(e) => void submit(e)}>
      <PageHeader
        title="Configure assignment details"
        description="Configure availability timeline and instructions for this assessment assignment."
      />

      <div className="space-y-6">
        {selectedAssessmentQuery.isLoading ? (
          <LoadingState label="Loading selected assessment details" />
        ) : selectedAssessment ? (
          <Card heading="Selected Assessment" headingLevel={2}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">{selectedAssessment.title}</h3>
                <p className="text-slate-600 mt-1">{selectedAssessment.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Type:</strong> {selectedAssessment.type}</div>
                  <div><strong>Duration:</strong> {selectedAssessment.durationMinutes} minutes</div>
                  <div><strong>MCQ Questions:</strong> {mcqCount}</div>
                  <div><strong>Coding Challenges:</strong> {codingCount}</div>
                  <div><strong>Passing Score:</strong> {selectedAssessment.passingPercentage}%</div>
                </div>
              </div>
              <Button variant="secondary" onClick={() => setAssessmentId('')}>
                Change Assessment
              </Button>
            </div>
          </Card>
        ) : null}

        <div
          style={{
            padding: '14px 16px',
            backgroundColor: 'var(--color-bg-subtle, #f0f9ff)',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <strong style={{ color: '#0369a1', fontSize: '14px' }}>
              Assigning to multiple candidates?
            </strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#0c4a6e' }}>
              You don&apos;t need to manually type IDs! Go to the ATS Pipeline, select multiple candidates using checkboxes, and click <strong>&quot;Assign Assessment&quot;</strong> to bulk-assign with live eligibility preview.
            </p>
          </div>
          <Link
            to="/org/applications"
            className="tvx-button tvx-button--secondary"
            style={{ backgroundColor: '#ffffff', whiteSpace: 'nowrap' }}
          >
            Open ATS Pipeline →
          </Link>
        </div>

        <Card heading="Candidate & Timeline Configuration" headingLevel={2}>
          <div className="space-y-4">
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Candidate Application
                </span>
                {!initialAppId && (
                  <button
                    type="button"
                    onClick={() => setManualInput(!manualInput)}
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-primary, #0284c7)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {manualInput
                      ? '← Select from pipeline candidates'
                      : 'Enter Application ID manually'}
                  </button>
                )}
              </div>

              {!manualInput && !initialAppId ? (
                applicationsQuery.isLoading ? (
                  <small className="text-slate-500">
                    Loading pipeline candidates...
                  </small>
                ) : (
                  <Select
                    label=""
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    options={[
                      {
                        value: '',
                        label: '-- Select a candidate from your pipeline --',
                      },
                      ...(applicationsQuery.data?.items ?? []).map((app) => ({
                        value: app.id,
                        label: `${app.candidateName} — ${app.jobTitle} [${label(app.status)}]`,
                      })),
                    ]}
                  />
                )
              ) : (
                <TextField
                  label="Application ID"
                  required
                  placeholder="24-character hexadecimal MongoDB ID"
                  value={applicationId}
                  onChange={(e) => setApplicationId(e.target.value)}
                  disabled={Boolean(initialAppId)}
                />
              )}
            </div>

            {checkEligibility.isPending && (
              <small className="text-slate-500">Evaluating candidate eligibility...</small>
            )}

            {eligibilityResult && (
              <div style={{ padding: '12px', border: '1px solid var(--color-border-subtle, #e2e8f0)', borderRadius: '6px', background: 'var(--color-surface-subtle, #f8fafc)', fontSize: '0.875rem' }}>
                {eligibilityResult.eligible[0] && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{eligibilityResult.eligible[0].candidateName}</strong>
                      <span style={{ color: 'var(--color-text-secondary, #64748b)', marginLeft: '8px' }}>
                        ({eligibilityResult.eligible[0].email})
                      </span>
                      {eligibilityResult.eligible[0].jobTitle && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary, #64748b)', marginTop: '2px' }}>
                          Job: {eligibilityResult.eligible[0].jobTitle}
                        </div>
                      )}
                    </div>
                    <StatusTag tone="success">Eligible for Assignment</StatusTag>
                  </div>
                )}

                {eligibilityResult.alreadyAssigned[0] && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{eligibilityResult.alreadyAssigned[0].candidateName}</strong>
                      <StatusTag tone="warning">
                        Already Assigned ({eligibilityResult.alreadyAssigned[0].existingStatus})
                      </StatusTag>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '6px 0 0 0' }}>
                      An active assignment already exists for this application. Reassigning is blocked until the existing assignment finishes or expires.
                    </p>
                  </div>
                )}

                {eligibilityResult.ineligible[0] && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{eligibilityResult.ineligible[0].candidateName}</strong>
                      <StatusTag tone="danger">Ineligible</StatusTag>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: '6px 0 0 0' }}>
                      {eligibilityResult.ineligible[0].reason || 'Application is not in an eligible pipeline stage.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DateField
              label="Available date"
              required
              min={todayStr}
              value={availableFrom}
              error={availableDateError}
              onChange={(e) => {
                const nextAvail = e.target.value;
                setAvailableFrom(nextAvail);
                if (expiresAt && nextAvail && expiresAt <= nextAvail) {
                  const nextMinExpiry = new Date(new Date(nextAvail).getTime() + 86400000)
                    .toISOString()
                    .slice(0, 10);
                  setExpiresAt(nextMinExpiry);
                }
              }}
            />
            <DateField
              label="Expiry date (Deadline)"
              required
              min={minExpiryStr}
              value={expiresAt}
              error={expiryDateError}
              onChange={(e) => setExpiresAt(e.target.value)}
            />

            {selectedAssessment && (
              <TextArea
                label="Immutable Instructions for Candidate"
                disabled
                value={selectedAssessment.instructions || 'Follow the test screen rules.'}
              />
            )}

            <div className="pt-4 flex gap-4">
              <Button variant="secondary" onClick={() => setAssessmentId('')}>
                Back
              </Button>
              <Button
                type="submit"
                loading={create.isPending}
                disabled={
                  !assessmentId ||
                  !applicationId ||
                  !isDateRangeValid ||
                  Boolean(eligibilityResult && (eligibilityResult.eligible?.length ?? 0) === 0)
                }
              >
                Confirm Assignment
              </Button>
            </div>

            {create.isError && (
              <Alert tone="danger" title="Assignment not created">
                {create.error instanceof Error
                  ? create.error.message
                  : 'Check the fields.'}
              </Alert>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
