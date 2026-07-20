import { useEffect, useRef, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DataTable,
  DescriptionList,
  Dialog,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  LoadingState,
  PageHeader,
  PermissionState,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  useAssessment,
  useAssessments,
  useAssessmentAction,
  useAssessmentSave,
  useAssignment,
  useAssignments,
  useAttempt,
  useResult,
  useReviews,
  useSaveAnswer,
  useStart,
  useSubmit,
} from './api';
import {
  formatDate,
  label,
  type Assessment,
  type Assignment,
  type Question,
} from './model';
import './assessments.css';
const err = (e: unknown) =>
  e instanceof Error ? e.message : 'The request could not be completed.';
const oid = /^[a-f\d]{24}$/i;
const has = (p: string[], v: string) => p.includes(v);
const statusTone = (s: string) =>
  s === 'completed' || s === 'published'
    ? 'success'
    : s === 'expired' || s === 'cancelled'
      ? 'danger'
      : s === 'evaluating' || s === 'submitted'
        ? 'warning'
        : 'neutral';
function Tabs() {
  return (
    <nav className="as-tabs" aria-label="Assessment sections">
      <Link to="/org/assessments">Definitions</Link>
      <Link to="/org/assessments/assignments">Assignments</Link>
      <Link to="/org/assessments/reviews">Reviews</Link>
    </nav>
  );
}
function Empty({ filtered = false }: { filtered?: boolean }) {
  return filtered ? (
    <FilteredEmptyState
      title="No matching assessments"
      description="Clear or adjust the current filters."
      onClear={() => location.assign(location.pathname)}
    />
  ) : (
    <EmptyState
      title="Nothing here yet"
      description="New assessment activity will appear here."
    />
  );
}
function AssessmentCard({ a }: { a: Assessment }) {
  return (
    <article className="as-record">
      <div>
        <strong>{a.title}</strong>
        <span>{label(a.type)}</span>
      </div>
      <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
      <span>
        {a.questionCount} questions · {a.durationMinutes} min
      </span>
      <Link
        className="tvx-button tvx-button--secondary"
        to={`/org/assessments/${a.id}`}
      >
        Open
      </Link>
    </article>
  );
}
export function AssessmentsPage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.view');
  const manage = has(recruiter?.permissions ?? [], 'assessments.manage');
  const [p, setP] = useSearchParams();
  const search = p.get('search');
  const q = useAssessments(
    `page=${p.get('page') || 1}&limit=10&sort=${p.get('sort') || 'newest'}${search ? `&search=${encodeURIComponent(search)}` : ''}${p.get('status') ? `&status=${p.get('status')}` : ''}`,
    can,
  );
  if (!can)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  return (
    <div className="as-page">
      <PageHeader
        title="Assessments"
        description="Create, publish and monitor structured candidate assessments."
        secondaryActions={<Tabs />}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to="/org/assessments/new"
            >
              Create assessment
            </Link>
          ) : undefined
        }
      />
      <Toolbar
        label="Assessment filters"
        start={
          <div className="as-filters">
            <TextField
              label="Search"
              value={p.get('search') || ''}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                if (e.target.value) n.set('search', e.target.value);
                else n.delete('search');
                n.set('page', '1');
                setP(n);
              }}
            />
            <Select
              label="Status"
              value={p.get('status') || ''}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                if (e.target.value) n.set('status', e.target.value);
                else n.delete('status');
                setP(n);
              }}
              options={['draft', 'published', 'archived'].map((x) => ({
                value: x,
                label: label(x),
              }))}
            />
          </div>
        }
      />
      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="Assessment definitions"
          rows={(q.data?.items ?? []) as Assessment[]}
          rowKey={(a) => a.id}
          isLoading={q.isLoading}
          empty={<Empty filtered={p.has('search') || p.has('status')} />}
          columns={[
            {
              id: 'title',
              header: 'Assessment',
              render: (a) => (
                <>
                  <strong>{a.title}</strong>
                  <small>{label(a.type)}</small>
                </>
              ),
            },
            {
              id: 'status',
              header: 'Status',
              render: (a) => (
                <StatusTag tone={statusTone(a.status)}>
                  {label(a.status)}
                </StatusTag>
              ),
            },
            {
              id: 'questions',
              header: 'Questions',
              accessor: (a) => String(a.questionCount),
            },
            {
              id: 'duration',
              header: 'Duration',
              render: (a) => <>{a.durationMinutes} minutes</>,
            },
          ]}
          renderNarrow={(a) => <AssessmentCard a={a} />}
          rowActions={(a) => (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`/org/assessments/${a.id}`}
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
const initial = {
  title: '',
  description: '',
  instructions: '',
  type: 'general',
  durationMinutes: '30',
  passingPercentage: '70',
};
export function AssessmentFormPage() {
  const { assessmentId } = useParams();
  const edit = Boolean(assessmentId);
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.manage');
  const q = useAssessment(assessmentId ?? '', edit && can);
  const save = useAssessmentSave(assessmentId);
  const nav = useNavigate();
  const [d, setD] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [initializedAssessmentId, setInitializedAssessmentId] = useState('');
  if (q.data && initializedAssessmentId !== q.data.id) {
    setInitializedAssessmentId(q.data.id);
    setD({
      title: q.data.title,
      description: q.data.description,
      instructions: q.data.instructions,
      type: q.data.type,
      durationMinutes: String(q.data.durationMinutes),
      passingPercentage: String(q.data.passingPercentage),
    });
  }
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [dirty]);
  if (!can)
    return (
      <PermissionState description="The assessments.manage permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading assessment" />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await save.mutateAsync({
        ...d,
        durationMinutes: Number(d.durationMinutes),
        passingPercentage: Number(d.passingPercentage),
        skills: [],
        maximumAttempts: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
        showResultImmediately: false,
        allowBackNavigation: true,
        negativeMarking: false,
        negativeMarkValue: 0,
        attachments: {
          enabled: false,
          maximumFiles: 0,
          maximumFileBytes: 10485760,
          maximumTotalBytes: 20971520,
          allowedMimeTypes: [],
        },
      });
      setDirty(false);
      const id = (result as { assessment?: { _id?: string } }).assessment?._id;
      nav(
        edit
          ? `/org/assessments/${assessmentId}`
          : `/org/assessments/${id ?? ''}`,
      );
    } catch {
      /* rendered */
    }
  };
  return (
    <form className="as-page as-form" onSubmit={submit}>
      <PageHeader
        title={edit ? 'Edit assessment' : 'Create assessment'}
        description="Configure the candidate-facing instructions and assessment rules."
      />
      <Card heading="Assessment details" headingLevel={2}>
        <TextField
          required
          label="Title"
          value={d.title}
          onChange={(e) => {
            setD({ ...d, title: e.target.value });
            setDirty(true);
          }}
        />
        <TextArea
          label="Description"
          value={d.description}
          onChange={(e) => {
            setD({ ...d, description: e.target.value });
            setDirty(true);
          }}
        />
        <TextArea
          label="Candidate instructions"
          value={d.instructions}
          onChange={(e) => {
            setD({ ...d, instructions: e.target.value });
            setDirty(true);
          }}
        />
        <div className="as-grid">
          <Select
            label="Type"
            value={d.type}
            onChange={(e) => setD({ ...d, type: e.target.value })}
            options={[
              'general',
              'technical',
              'aptitude',
              'behavioral',
              'custom',
            ].map((x) => ({ value: x, label: label(x) }))}
          />
          <TextField
            label="Duration (minutes)"
            type="number"
            min="5"
            max="300"
            value={d.durationMinutes}
            onChange={(e) => setD({ ...d, durationMinutes: e.target.value })}
          />
          <TextField
            label="Passing percentage"
            type="number"
            min="0"
            max="100"
            value={d.passingPercentage}
            onChange={(e) => setD({ ...d, passingPercentage: e.target.value })}
          />
        </div>
        {save.isError && (
          <Alert tone="danger" title="Could not save">
            {err(save.error)}
          </Alert>
        )}
        <div className="as-actions">
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!d.title.trim()}
          >
            Save assessment
          </Button>
          <Button type="button" variant="secondary" onClick={() => nav(-1)}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  );
}
function QuestionList({ a }: { a: Assessment }) {
  return (
    <Card
      heading="Questions"
      headingLevel={2}
      description="Use the explicit controls to review composition. Dragging is never required."
    >
      {a.questions.length ? (
        <ol className="as-questions">
          {a.questions.map((q, i) => (
            <li key={q.id}>
              <span>{i + 1}</span>
              <div>
                <strong>{q.title || q.prompt}</strong>
                <small>
                  {label(q.type)} · {q.marks} marks
                </small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No questions added"
          description="Add questions from the reusable question bank before publishing."
        />
      )}
    </Card>
  );
}
export function AssessmentDetailPage() {
  const { assessmentId = '' } = useParams();
  const { recruiter } = useAuth();
  const view = has(recruiter?.permissions ?? [], 'assessments.view'),
    manage = has(recruiter?.permissions ?? [], 'assessments.manage');
  const q = useAssessment(assessmentId, view && oid.test(assessmentId));
  const action = useAssessmentAction(assessmentId);
  if (!view)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading assessment" />;
  if (q.isError)
    return <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />;
  if (!q.data) return null;
  const a = q.data;
  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        description={a.description || 'No description provided.'}
        metadata={
          <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
        }
        primaryAction={
          manage && a.status === 'draft' ? (
            <Button onClick={() => void action.mutateAsync('publish')}>
              Publish
            </Button>
          ) : undefined
        }
        secondaryActions={
          manage ? (
            <>
              <Link
                className="tvx-button tvx-button--secondary"
                to={`/org/assessments/${a.id}/edit`}
              >
                Edit
              </Link>
              {a.status === 'published' && (
                <Button
                  variant="secondary"
                  onClick={() => void action.mutateAsync('archive')}
                >
                  Archive
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {action.isError && (
        <Alert
          tone={
            (action.error as ApiError).status === 409 ? 'warning' : 'danger'
          }
          title="Assessment changed"
        >
          {err(action.error)} Refresh before trying again.
        </Alert>
      )}
      <div className="as-layout">
        <Card heading="Definition" headingLevel={2}>
          <DescriptionList
            items={[
              { term: 'Type', description: label(a.type) },
              { term: 'Duration', description: `${a.durationMinutes} minutes` },
              { term: 'Passing score', description: `${a.passingPercentage}%` },
              {
                term: 'Back navigation',
                description: a.allowBackNavigation ? 'Allowed' : 'Not allowed',
              },
            ]}
          />
          <h3>Candidate instructions</h3>
          <p className="as-preserve">
            {a.instructions || 'No instructions provided.'}
          </p>
        </Card>
        <QuestionList a={a} />
      </div>
    </div>
  );
}
function AssignmentCard({
  a,
  candidate = false,
}: {
  a: Assignment;
  candidate?: boolean;
}) {
  return (
    <article className="as-record">
      <div>
        <strong>{a.title}</strong>
        {!candidate && <span>{a.candidateName}</span>}
      </div>
      <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
      <span>Due {formatDate(a.expiresAt)}</span>
      <Link
        className="tvx-button tvx-button--secondary"
        to={`${candidate ? '/candidate/assessments' : '/org/assessments/assignments'}/${a.id}`}
      >
        Open
      </Link>
    </article>
  );
}
export function AssignmentsPage({
  candidate = false,
}: {
  candidate?: boolean;
}) {
  const { recruiter } = useAuth();
  const can =
    candidate || has(recruiter?.permissions ?? [], 'assessments.view');
  const [p, setP] = useSearchParams();
  const q = useAssignments(
    `page=${p.get('page') || 1}&limit=10${p.get('status') ? `&status=${p.get('status')}` : ''}`,
    can,
    candidate,
  );
  if (!can)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  const rows = (q.data?.items ?? []) as Assignment[];
  return (
    <div className="as-page">
      <PageHeader
        title={candidate ? 'My assessments' : 'Assessment assignments'}
        description={
          candidate
            ? 'Review instructions, deadlines and your assessment progress.'
            : 'Monitor candidate assignments and result readiness.'
        }
        secondaryActions={!candidate ? <Tabs /> : undefined}
      />
      <Select
        label="Status filter"
        value={p.get('status') || ''}
        onChange={(e) => {
          const n = new URLSearchParams(p);
          if (e.target.value) n.set('status', e.target.value);
          else n.delete('status');
          setP(n);
        }}
        options={[
          'assigned',
          'available',
          'in-progress',
          'submitted',
          'evaluating',
          'completed',
          'expired',
          'cancelled',
        ].map((x) => ({ value: x, label: label(x) }))}
      />
      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption={
            candidate
              ? 'Assigned assessments'
              : 'Candidate assessment assignments'
          }
          rows={rows}
          rowKey={(a) => a.id}
          isLoading={q.isLoading}
          empty={<Empty filtered={p.has('status')} />}
          columns={[
            {
              id: 'assessment',
              header: 'Assessment',
              render: (a) => <strong>{a.title}</strong>,
            },
            ...(!candidate
              ? [
                  {
                    id: 'candidate',
                    header: 'Candidate',
                    accessor: (a: Assignment) => a.candidateName,
                  },
                ]
              : []),
            {
              id: 'status',
              header: 'Status',
              render: (a) => (
                <StatusTag tone={statusTone(a.status)}>
                  {label(a.status)}
                </StatusTag>
              ),
            },
            {
              id: 'expiry',
              header: 'Deadline',
              render: (a) => formatDate(a.expiresAt),
            },
          ]}
          renderNarrow={(a) => <AssignmentCard a={a} candidate={candidate} />}
          rowActions={(a) => (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`${candidate ? '/candidate/assessments' : '/org/assessments/assignments'}/${a.id}`}
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
export function CandidateAssignmentPage() {
  const { assignmentId = '' } = useParams();
  const q = useAssignment(assignmentId, true, oid.test(assignmentId));
  const start = useStart();
  const nav = useNavigate();
  const [loadedAt] = useState(() => Date.now());
  if (q.isLoading)
    return <LoadingState label="Loading assessment instructions" />;
  if (q.isError)
    return (
      <ErrorState
        title="Assessment unavailable"
        detail={err(q.error)}
        retry={() => void q.refetch()}
      />
    );
  const a = q.data;
  if (!a) return null;
  const expired = Date.parse(a.expiresAt) <= loadedAt || a.status === 'expired';
  const begin = async () => {
    const x = await start.mutateAsync(a.id);
    const id = (x.attempt as { _id?: string })?._id;
    if (id) nav(`/candidate/assessments/${a.id}/attempt/${id}`);
  };
  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        eyebrow="Assessment instructions"
        description={`Available from ${formatDate(a.availableFrom)} · deadline ${formatDate(a.expiresAt)}`}
        metadata={
          <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
        }
      />
      {expired && (
        <Alert tone="danger" title="Deadline passed">
          This assessment can no longer be started or changed.
        </Alert>
      )}
      <Card heading="Before you begin" headingLevel={2}>
        <ul>
          <li>Your answers are saved only when you select Save answer.</li>
          <li>Keep this page open during recoverable connection failures.</li>
          <li>Submitting is final and requires confirmation.</li>
          <li>No proctoring, compiler or AI evaluation is provided.</li>
        </ul>
        {a.attemptId ? (
          <Link
            className="tvx-button tvx-button--primary"
            to={`/candidate/assessments/${a.id}/attempt/${a.attemptId}`}
          >
            Continue attempt
          </Link>
        ) : (
          <Button
            onClick={() => void begin()}
            loading={start.isPending}
            disabled={expired || !['assigned', 'available'].includes(a.status)}
          >
            Start assessment
          </Button>
        )}
        {start.isError && (
          <Alert tone="danger" title="Could not start">
            {err(start.error)}
          </Alert>
        )}
      </Card>
    </div>
  );
}
function Answer({
  q,
  value,
  onChange,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (q.type === 'single-choice' || q.type === 'true-false')
    return (
      <fieldset>
        <legend>{q.prompt}</legend>
        {(q.type === 'true-false'
          ? [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' },
            ]
          : q.options
        ).map((o) => (
          <label className="as-choice" key={o.id}>
            <input
              type="radio"
              name={q.id}
              checked={String(value) === o.id}
              onChange={() =>
                onChange(q.type === 'true-false' ? o.id === 'true' : o.id)
              }
            />
            {o.text}
          </label>
        ))}
      </fieldset>
    );
  if (q.type === 'multiple-choice')
    return (
      <fieldset>
        <legend>{q.prompt}</legend>
        {q.options.map((o) => (
          <label className="as-choice" key={o.id}>
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(o.id)}
              onChange={(e) => {
                const a = Array.isArray(value) ? (value as string[]) : [];
                onChange(
                  e.target.checked ? [...a, o.id] : a.filter((x) => x !== o.id),
                );
              }}
            />
            {o.text}
          </label>
        ))}
      </fieldset>
    );
  return (
    <TextArea
      label={q.prompt}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      rows={q.type === 'short-answer' ? 3 : 10}
      hint={
        q.type === 'coding'
          ? 'Code is saved as text only. Talvix does not execute or compile it.'
          : undefined
      }
    />
  );
}
function Timer({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Date.parse(deadline) - Date.now()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      const n = Math.max(0, Date.parse(deadline) - Date.now());
      setLeft(n);
      if (n === 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);
  const m = Math.ceil(left / 60000);
  return (
    <div
      role="timer"
      aria-live={m <= 5 ? 'assertive' : 'off'}
      className={m <= 5 ? 'as-timer as-timer--risk' : 'as-timer'}
    >
      <strong>{left ? `${m} minutes remaining` : 'Time expired'}</strong>
      <span>Deadline {formatDate(deadline)}</span>
    </div>
  );
}
export function AttemptPage() {
  const { assignmentId = '', attemptId = '' } = useParams();
  const q = useAttempt(attemptId, oid.test(attemptId));
  const save = useSaveAnswer(attemptId);
  const submit = useSubmit(attemptId);
  const nav = useNavigate();
  const [attemptLoadedAt] = useState(() => Date.now());
  const [index, setIndex] = useState(0),
    [drafts, setDrafts] = useState<Record<string, unknown>>({}),
    [saved, setSaved] = useState<Record<string, string>>({}),
    [expired, setExpired] = useState(false),
    [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    // Restore the server's persisted answers after session recovery.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.data) setDrafts(q.data.answers);
  }, [q.data]);
  if (q.isLoading) return <LoadingState label="Restoring assessment attempt" />;
  if (q.isError)
    return (
      <ErrorState
        title="Attempt unavailable"
        detail={err(q.error)}
        retry={() => void q.refetch()}
      />
    );
  const a = q.data;
  if (!a) return null;
  const question = a.questions[index];
  const deadlineExpired = Date.parse(a.expiresAt) <= attemptLoadedAt;
  const disabled = expired || deadlineExpired || a.status !== 'in-progress';
  const doSave = async () => {
    if (!question || disabled) return;
    try {
      const v = drafts[question.id];
      await save.mutateAsync({
        questionId: question.id,
        ...(question.type === 'coding'
          ? { code: v ?? '', language: question.languages[0] ?? 'javascript' }
          : { answer: v }),
        timeSpentSeconds: 0,
        flaggedForReview: false,
      });
      setSaved({ ...saved, [question.id]: new Date().toISOString() });
      setNotice(`Answer ${index + 1} saved.`);
    } catch {
      setNotice(
        'Save failed. Your answer remains in this browser; retry when the connection returns.',
      );
    }
  };
  const final = async () => {
    if (lock.current || disabled) return;
    lock.current = true;
    try {
      await submit.mutateAsync();
      setConfirm(false);
      setNotice('Assessment submitted successfully.');
      nav(`/candidate/assessments/${assignmentId}/result/${attemptId}`);
    } catch (e) {
      if (e instanceof ApiError && [409, 422].includes(e.status)) {
        setNotice(
          'This assessment was already submitted or changed. Refreshing its status.',
        );
        await q.refetch();
      } else setNotice(`Submission failed. ${err(e)}`);
    } finally {
      lock.current = false;
    }
  };
  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        eyebrow={`Question ${index + 1} of ${a.questions.length}`}
        description="Manual save is required for each answer."
      />
      <Timer deadline={a.expiresAt} onExpire={() => setExpired(true)} />
      <div className="as-attempt">
        <nav aria-label="Question navigation" className="as-navigator">
          {a.questions.map((x, i) => (
            <Button
              key={x.id}
              variant={i === index ? 'primary' : 'secondary'}
              onClick={() => {
                if (a.allowBackNavigation || i > index) setIndex(i);
              }}
              disabled={!a.allowBackNavigation && i < index}
              aria-label={`Question ${i + 1}${saved[x.id] ? ', saved' : ''}`}
            >
              {i + 1}
            </Button>
          ))}
        </nav>
        {question ? (
          <Card
            heading={question.title || `Question ${index + 1}`}
            headingLevel={2}
          >
            <Answer
              q={question}
              value={drafts[question.id]}
              onChange={(v) => setDrafts({ ...drafts, [question.id]: v })}
            />
            <div className="as-save-status" role="status">
              {save.isPending
                ? 'Saving…'
                : saved[question.id]
                  ? `Saved ${formatDate(saved[question.id] ?? '')}`
                  : 'Not saved'}
            </div>
            <div className="as-actions">
              <Button
                onClick={() => void doSave()}
                loading={save.isPending}
                disabled={disabled}
              >
                Save answer
              </Button>
              {index < a.questions.length - 1 && (
                <Button variant="secondary" onClick={() => setIndex(index + 1)}>
                  Next question
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => setConfirm(true)}
                disabled={disabled || submit.isPending}
              >
                Submit assessment
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="No questions available"
            description="Contact the hiring organization."
          />
        )}
      </div>
      <div className="visually-hidden" aria-live="polite">
        {notice}
      </div>
      {(expired || deadlineExpired) && (
        <Alert tone="danger" title="Time expired">
          Saving and submission are disabled. Contact the hiring organization if
          you need help.
        </Alert>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit assessment?"
        description="This is final. You will not be able to change answers after submission."
        busy={submit.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep working
            </Button>
            <Button onClick={() => void final()} loading={submit.isPending}>
              Submit final answers
            </Button>
          </>
        }
      >
        <p>Confirm only when every intended answer has been saved.</p>
      </Dialog>
    </div>
  );
}
export function ResultPage() {
  const { attemptId = '' } = useParams();
  const q = useResult(attemptId, oid.test(attemptId));
  if (q.isLoading) return <LoadingState label="Loading released result" />;
  if (q.isError) {
    const status = (q.error as ApiError).status;
    return status === 403 ? (
      <PermissionState
        title="Result not released"
        description="The hiring organization has not released this result to you."
      />
    ) : (
      <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
    );
  }
  if (!q.data) return null;
  return (
    <div className="as-page">
      <PageHeader
        title={q.data.title}
        eyebrow="Assessment result"
        description="Only information released by the hiring organization is shown."
      />
      <Card heading="Result summary" headingLevel={2}>
        <DescriptionList
          items={[
            { term: 'Status', description: label(q.data.status) },
            { term: 'Score', description: `${q.data.score}%` },
            {
              term: 'Outcome',
              description:
                q.data.passed === undefined
                  ? 'Not disclosed'
                  : q.data.passed
                    ? 'Passed'
                    : 'Not passed',
            },
            {
              term: 'Feedback',
              description: q.data.feedback || 'No candidate feedback released.',
            },
          ]}
        />
      </Card>
    </div>
  );
}
export function ReviewsPage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.review');
  const q = useReviews(can);
  if (!can)
    return (
      <PermissionState description="The assessments.review permission is required." />
    );
  return (
    <div className="as-page">
      <PageHeader
        title="Assessment reviews"
        description="Review submitted answers using the assessment snapshot."
        secondaryActions={<Tabs />}
      />
      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : q.isLoading ? (
        <LoadingState label="Loading review queue" />
      ) : q.data?.length ? (
        <div className="as-records">
          {q.data.map((a) => (
            <Card key={a.id} heading={a.title} headingLevel={2}>
              <StatusTag tone={statusTone(a.status)}>
                {label(a.status)}
              </StatusTag>
              <Link
                className="tvx-button tvx-button--secondary"
                to={`/org/assessments/reviews/${a.id}`}
              >
                Review submission
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Review queue is clear"
          description="Manually scored submissions will appear here."
        />
      )}
    </div>
  );
}
export function ReviewDetailPage() {
  const { attemptId = '' } = useParams();
  return (
    <div className="as-page">
      <PageHeader
        title="Assessment review"
        description={`Review ${attemptId} using the immutable submitted snapshot.`}
      />
      <Alert tone="info" title="Structured review boundary">
        Question scoring and feedback are sent only through the supported
        per-question review API. Automated or AI evaluation is not available.
      </Alert>
    </div>
  );
}
