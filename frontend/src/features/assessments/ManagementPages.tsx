import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DataTable,
  DateField,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  Select,
  TextArea,
  TextField,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import { useCreateAssignment, useQuestionSave, useQuestions, useAssessments, useAssessment } from './api';
import { label, type Question } from './model';

export function QuestionBankPage() {
  const { recruiter } = useAuth();
  const canView = Boolean(recruiter?.permissions.includes('assessments.view'));
  const canManage = Boolean(
    recruiter?.permissions.includes('assessments.manage'),
  );
  const query = useQuestions(canView);
  const save = useQuestionSave();
  const [prompt, setPrompt] = useState(''),
    [type, setType] = useState('long-answer'),
    [difficulty, setDifficulty] = useState('medium'),
    [marks, setMarks] = useState('10');
  const [optionsList, setOptionsList] = useState<{ text: string }[]>([{ text: '' }, { text: '' }]);
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState<number | null>(null);
  const [selectedCorrectIndices, setSelectedCorrectIndices] = useState<Record<number, boolean>>({});
  const [correctBoolean, setCorrectBoolean] = useState<boolean | null>(null);
  const [acceptedAnswersText, setAcceptedAnswersText] = useState('');
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
  return (
    <div className="as-page">
      <PageHeader
        title="Question bank"
        description="Manage reusable questions. Coding questions store source text only; no compiler is provided."
      />
      {canManage && (
        <Card heading="Create question" headingLevel={2}>
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

              let correctAnswer: any = undefined;
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
              });
            }}
            loading={save.isPending}
            disabled={
              !prompt.trim() ||
              (type === 'single-choice' && (optionsList.filter(o => o.text.trim()).length < 2 || selectedCorrectIndex === null)) ||
              (type === 'multiple-choice' && (optionsList.filter(o => o.text.trim()).length < 2 || !Object.values(selectedCorrectIndices).some(Boolean))) ||
              (type === 'true-false' && correctBoolean === null) ||
              (type === 'short-answer' && !acceptedAnswersText.trim())
            }
          >
            Create question
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
      {query.isLoading ? (
        <LoadingState label="Loading question bank" />
      ) : (
        <DataTable
          caption="Reusable assessment questions"
          rows={(query.data?.items ?? []) as Question[]}
          rowKey={(q) => q.id}
          empty={
            <EmptyState
              title="No questions"
              description="Create the first reusable question."
            />
          }
          columns={[
            {
              id: 'prompt',
              header: 'Question',
              render: (q) => <strong>{q.title || q.prompt}</strong>,
            },
            { id: 'type', header: 'Type', render: (q) => label(q.type) },
            { id: 'marks', header: 'Marks', accessor: (q) => String(q.marks) },
          ]}
          renderNarrow={(question) => (
            <article className="as-record">
              <strong>{question.title || question.prompt}</strong>
              <span>
                {label(question.type)} · {question.marks} marks
              </span>
            </article>
          )}
        />
      )}
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

  const [assessmentId, setAssessmentId] = useState('');
  const [applicationId, setApplicationId] = useState(initialAppId);
  const [availableFrom, setAvailableFrom] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const assessmentsQuery = useAssessments('page=1&limit=50&status=published', can);
  const selectedAssessmentQuery = useAssessment(assessmentId, can && Boolean(assessmentId));

  if (!can) {
    return (
      <PermissionState description="The assessments.assign permission is required." />
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentId) return;
    const x = await create.mutateAsync({
      assessmentId,
      applicationId,
      availableFrom: new Date(availableFrom).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    });
    const id = (x.assignment as { _id?: string } | undefined)?._id;
    if (id) nav(`/org/assessments/assignments/${id}`);
  };

  const assessments = (assessmentsQuery.data?.items ?? []) as any[];

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

        <Card heading="Assignment Configuration" headingLevel={2}>
          <div className="space-y-4">
            <TextField
              label="Application ID"
              required
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              disabled={Boolean(initialAppId)}
            />
            <DateField
              label="Available date"
              required
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
            />
            <DateField
              label="Expiry date (Deadline)"
              required
              value={expiresAt}
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
                  !assessmentId || !applicationId || !availableFrom || !expiresAt
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
