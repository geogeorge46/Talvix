import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useCreateAssignment, useQuestionSave, useQuestions } from './api';
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
          {!['long-answer', 'coding'].includes(type) && (
            <Alert tone="info" title="Answer configuration required">
              Choice and short-answer questions require answer configuration
              supported by the backend. Create them only after configuring their
              answer data.
            </Alert>
          )}
          <Button
            onClick={() =>
              void save.mutateAsync({
                type,
                prompt,
                difficulty,
                defaultMarks: Number(marks),
                skills: [],
                options: [],
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
              })
            }
            loading={save.isPending}
            disabled={
              !prompt.trim() || !['long-answer', 'coding'].includes(type)
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
  const [assessmentId, setAssessmentId] = useState(''),
    [applicationId, setApplicationId] = useState(''),
    [availableFrom, setAvailableFrom] = useState(''),
    [expiresAt, setExpiresAt] = useState('');
  if (!can)
    return (
      <PermissionState description="The assessments.assign permission is required." />
    );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x = await create.mutateAsync({
      assessmentId,
      applicationId,
      availableFrom: new Date(availableFrom).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    });
    const id = (x.assignment as { _id?: string } | undefined)?._id;
    if (id) nav(`/org/assessments/assignments/${id}`);
  };
  return (
    <form className="as-page" onSubmit={(e) => void submit(e)}>
      <PageHeader
        title="Assign assessment"
        description="Assign a published assessment to an existing application."
      />
      <Card heading="Assignment" headingLevel={2}>
        <TextField
          label="Assessment ID"
          required
          value={assessmentId}
          onChange={(e) => setAssessmentId(e.target.value)}
        />
        <TextField
          label="Application ID"
          required
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
        />
        <DateField
          label="Available date"
          required
          value={availableFrom}
          onChange={(e) => setAvailableFrom(e.target.value)}
        />
        <DateField
          label="Expiry date"
          required
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <Button
          type="submit"
          loading={create.isPending}
          disabled={
            !assessmentId || !applicationId || !availableFrom || !expiresAt
          }
        >
          Assign candidate
        </Button>
        {create.isError && (
          <Alert tone="danger" title="Assignment not created">
            {create.error instanceof Error
              ? create.error.message
              : 'Check the fields.'}
          </Alert>
        )}
      </Card>
    </form>
  );
}
