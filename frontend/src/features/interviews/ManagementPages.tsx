import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  PermissionState,
  SearchField,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import {
  useFeedback,
  useProcessCreate,
  useScorecard,
  useFeedbackAction,
  useTemplates,
} from './api';
import { useApplication } from '../ats-workspace/api';
import { label, type Process, type Template } from './model';
import { InterviewTabs } from './Pages';

const has = (items: string[], item: string) => items.includes(item),
  msg = (e: unknown) =>
    e instanceof Error ? e.message : 'The request could not be completed.';

const PRESETS: Record<string, { label: string; rounds: unknown[] }> = {
  'preset:standard-tech': {
    label: 'Standard Technical Round (1 Round — 45 mins)',
    rounds: [
      {
        name: 'Technical Round',
        description: 'Evaluates technical proficiency, problem solving, and role knowledge.',
        type: 'technical',
        durationMinutes: 45,
        order: 1,
        required: true,
        scorecardTemplate: {
          criteria: [
            { name: 'Technical Skills', category: 'technical', weight: 1, maximumScore: 5, required: true },
            { name: 'Problem Solving', category: 'problem-solving', weight: 1, maximumScore: 5, required: true },
            { name: 'Communication', category: 'communication', weight: 1, maximumScore: 5, required: true },
          ],
        },
        defaultInterviewers: [],
        minimumInterviewers: 1,
        maximumInterviewers: 3,
      },
    ],
  },
  'preset:full-loop': {
    label: 'Full Hiring Loop (Technical Round 45m + HR Round 30m)',
    rounds: [
      {
        name: 'Technical Interview',
        description: 'Comprehensive technical and problem-solving assessment.',
        type: 'technical',
        durationMinutes: 45,
        order: 1,
        required: true,
        scorecardTemplate: {
          criteria: [
            { name: 'Technical Depth', category: 'technical', weight: 1, maximumScore: 5, required: true },
            { name: 'Problem Solving', category: 'problem-solving', weight: 1, maximumScore: 5, required: true },
          ],
        },
        defaultInterviewers: [],
        minimumInterviewers: 1,
        maximumInterviewers: 3,
      },
      {
        name: 'HR & Culture Round',
        description: 'Culture fit, communication, and expectation alignment.',
        type: 'hr',
        durationMinutes: 30,
        order: 2,
        required: true,
        scorecardTemplate: {
          criteria: [
            { name: 'Communication', category: 'communication', weight: 1, maximumScore: 5, required: true },
            { name: 'Culture Fit', category: 'culture', weight: 1, maximumScore: 5, required: true },
          ],
        },
        defaultInterviewers: [],
        minimumInterviewers: 1,
        maximumInterviewers: 2,
      },
    ],
  },
  'preset:screening': {
    label: 'Initial Screening Round (30 mins)',
    rounds: [
      {
        name: 'Initial Screening',
        description: 'Initial background review, availability, and expectations.',
        type: 'screening',
        durationMinutes: 30,
        order: 1,
        required: true,
        scorecardTemplate: {
          criteria: [
            { name: 'Role Fit', category: 'role-fit', weight: 1, maximumScore: 5, required: true },
            { name: 'Communication', category: 'communication', weight: 1, maximumScore: 5, required: true },
          ],
        },
        defaultInterviewers: [],
        minimumInterviewers: 1,
        maximumInterviewers: 2,
      },
    ],
  },
};

export function ProcessCreatePage() {
  const [searchParams] = useSearchParams(),
    { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.manage'),
    templates = useTemplates('page=1&limit=50&sort=name&active=true', can),
    create = useProcessCreate(),
    nav = useNavigate(),
    [applicationId, setApplicationId] = useState(searchParams.get('applicationId') || ''),
    [templateId, setTemplateId] = useState('preset:standard-tech');

  const appQuery = useApplication(applicationId, Boolean(applicationId) && can);

  if (!can)
    return (
      <PermissionState description="The interviews.manage permission is required." />
    );

  const customTemplates = ((templates.data?.items ?? []) as Template[]).map((t) => ({
    value: t.id,
    label: t.name,
  }));

  const templateOptions = [
    { value: 'preset:standard-tech', label: '⚡ Standard Technical Round (1 Round — 45 mins)' },
    { value: 'preset:full-loop', label: '⚡ Full Loop (Technical Round 45m + HR Round 30m)' },
    { value: 'preset:screening', label: '⚡ Initial Screening Round (30 mins)' },
    ...customTemplates,
  ];

  return (
    <form
      className="iv-page"
      onSubmit={(e) => {
        e.preventDefault();
        const payload = templateId.startsWith('preset:')
          ? { applicationId, rounds: PRESETS[templateId]?.rounds }
          : { applicationId, templateId };
        void create.mutateAsync(payload).then((r) => {
          const x = r as { process?: { _id?: string; id?: string } };
          nav(`/org/interviews/${x.process?.id ?? x.process?._id ?? ''}`);
        });
      }}
    >
      <PageHeader
        title="Create interview process"
        description="Start from an eligible application and select an interview round structure."
      />
      <Card heading="Process source" headingLevel={2}>
        {appQuery.data && (
          <div
            style={{
              padding: '14px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '1rem', display: 'block', color: '#0f172a' }}>
                  {appQuery.data.candidateName || 'Candidate Application'}
                </strong>
                <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                  {appQuery.data.jobTitle ? `${appQuery.data.jobTitle} · ` : ''}
                  {appQuery.data.candidateEmail || ''}
                </span>
              </div>
              {appQuery.data.status && <StatusTag>{appQuery.data.status}</StatusTag>}
            </div>
          </div>
        )}
        <TextField
          required
          label="Application ID"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          hint="Use the application identifier from the ATS workspace."
        />
        <Select
          required
          label="Interview round structure / template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          options={templateOptions}
        />
        {customTemplates.length === 0 && (
          <small style={{ display: 'block', marginTop: '-8px', marginBottom: '12px', color: '#64748b' }}>
            Tip: You can use preset round structures above or{' '}
            <Link to="/org/interviews/templates/new" style={{ color: '#3b82f6', underline: 'always' }}>
              create custom organization templates
            </Link>.
          </small>
        )}
        {create.isError && (
          <Alert
            tone="danger"
            title={
              create.error instanceof Error &&
              create.error.message.includes('409')
                ? 'Process conflict'
                : 'Could not create process'
            }
          >
            {msg(create.error)} Your selections remain available for review.
          </Alert>
        )}
        <Button
          type="submit"
          loading={create.isPending}
          disabled={!applicationId || !templateId}
        >
          Create process
        </Button>
      </Card>
    </form>
  );
}
interface FeedbackRow {
  _id?: string;
  id?: string;
  round?: string;
  roundId?: string;
  submitted?: boolean;
  submittedAt?: string;
  lastEditedAt?: string;
  recommendation?: string;
  name?: string;
  dueAt?: string;
  overdue?: boolean;
}
export function FeedbackQueuePage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'interviews.evaluate');
  const q = useFeedback(can);
  const [searchParams, setSearchParams] = useSearchParams();

  const currentSearch = searchParams.get('search') || '';
  const currentStatus = searchParams.get('status') || '';
  const [searchDraft, setSearchDraft] = useState(currentSearch);

  useEffect(() => {
    setSearchDraft(currentSearch);
  }, [currentSearch]);

  if (!can)
    return (
      <PermissionState description="The interviews.evaluate permission is required." />
    );

  const allRows = ((q.data ?? []) as FeedbackRow[]);
  const totalCount = allRows.length;
  const pendingCount = allRows.filter((x) => !x.submitted).length;
  const overdueCount = allRows.filter((x) => x.overdue).length;
  const submittedCount = allRows.filter((x) => x.submitted).length;

  const filteredRows = allRows.filter((row) => {
    const nameStr = (row.name || String(row.roundId ?? row.round ?? '')).toLowerCase();
    const searchMatch = !currentSearch || nameStr.includes(currentSearch.toLowerCase());

    if (!searchMatch) return false;
    if (currentStatus === 'pending') return !row.submitted;
    if (currentStatus === 'overdue') return row.overdue;
    if (currentStatus === 'submitted') return row.submitted;
    return true;
  });

  const hasFilters = Boolean(currentSearch || currentStatus);

  const updateFilters = (patch: { search?: string; status?: string }) => {
    const next = new URLSearchParams(searchParams);
    if (patch.search !== undefined) {
      if (patch.search) next.set('search', patch.search);
      else next.delete('search');
    }
    if (patch.status !== undefined) {
      if (patch.status) next.set('status', patch.status);
      else next.delete('status');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="iv-page">
      <PageHeader
        title="My interview scorecards"
        description="Assigned scorecards are ordered with overdue evaluations prioritized."
        secondaryActions={<InterviewTabs />}
      />

      <section className="org-metrics-grid-5" aria-label="Scorecard summary statistics">
        <MetricCard
          label="Total Assigned"
          value={totalCount}
          metadata="My scorecards"
          icon={<FileText />}
        />
        <MetricCard
          label="Pending Review"
          value={pendingCount}
          metadata="Draft evaluations"
          icon={<Clock />}
          variant="ice"
        />
        <MetricCard
          label="Overdue Attention"
          value={overdueCount}
          metadata="Action required"
          icon={<AlertTriangle />}
          variant="dark"
        />
        <MetricCard
          label="Submitted"
          value={submittedCount}
          metadata="Completed reviews"
          icon={<CheckCircle2 />}
        />
        <MetricCard
          label="Queue Health"
          value={`${totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 100}%`}
          metadata="Completion rate"
          icon={<Sparkles />}
        />
      </section>

      <Toolbar
        label="Scorecard filters"
        start={
          <SearchField
            label="Search scorecards"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={(value) => updateFilters({ search: value.trim() })}
          />
        }
        end={
          <div className="tvx-dashboard-filter-actions">
            <Select
              aria-label="Filter by evaluation status"
              value={currentStatus}
              options={[
                { value: '', label: 'All scorecards' },
                { value: 'pending', label: 'Pending / Draft' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'submitted', label: 'Submitted' },
              ]}
              onChange={(e) => updateFilters({ status: e.target.value })}
            />
            {hasFilters && (
              <Button
                variant="quiet"
                onClick={() => {
                  setSearchDraft('');
                  setSearchParams({}, { replace: true });
                }}
              >
                Reset filters
              </Button>
            )}
          </div>
        }
      />

      {q.isError ? (
        <ErrorState detail={msg(q.error)} retry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="My scorecards"
          rows={filteredRows}
          rowKey={(x) => String(x.id ?? x._id)}
          isLoading={q.isLoading}
          empty={
            hasFilters ? (
              <FilteredEmptyState
                title="No matching scorecards"
                description="Try broadening your search term or status filter."
                onClear={() => {
                  setSearchDraft('');
                  setSearchParams({}, { replace: true });
                }}
              />
            ) : (
              <EmptyState
                title="No scorecards returned"
                description="You have no pending or overdue assigned scorecards at this time."
              />
            )
          }
          columns={[
            {
              id: 'round',
              header: 'Round / Scorecard',
              render: (x) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: x.overdue ? '#fef2f2' : '#f0f9ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: x.overdue ? '#dc2626' : '#0284c7',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#0f172a' }}>
                      {x.name || `Round ${String(x.roundId ?? x.round ?? 'Evaluation')}`}
                    </strong>
                    <small style={{ color: '#64748b', fontSize: '0.75rem' }}>
                      ID: {String(x.id ?? x._id ?? x.roundId).slice(-8)}
                    </small>
                  </div>
                </div>
              ),
            },
            {
              id: 'status',
              header: 'Completion',
              render: (x) => (
                <StatusTag tone={x.submitted ? 'success' : 'warning'}>
                  {x.submitted ? 'Submitted' : 'Draft'}
                </StatusTag>
              ),
            },
            {
              id: 'overdue',
              header: 'Due Status',
              render: (x) => (
                <StatusTag tone={x.overdue ? 'danger' : x.submitted ? 'success' : 'neutral'}>
                  {x.overdue
                    ? 'Overdue'
                    : x.dueAt
                      ? new Date(x.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Pending'}
                </StatusTag>
              ),
            },
          ]}
          renderNarrow={(x) => (
            <article className="iv-record">
              <strong>{x.name || `Round ${String(x.roundId ?? x.round)}`}</strong>
              <StatusTag tone={x.submitted ? 'success' : 'warning'}>
                {x.submitted ? 'Submitted' : 'Draft'}
              </StatusTag>
              <Link to={`/org/interviews/feedback/${String(x.id ?? x.roundId ?? x.round)}`}>
                Review
              </Link>
            </article>
          )}
          rowActions={(x) => (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`/org/interviews/feedback/${String(x.id ?? x.roundId ?? x.round)}`}
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
export function FeedbackDetailPage() {
  const { roundId = '' } = useParams(),
    { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.evaluate'),
    q = useScorecard(roundId, can),
    action = useFeedbackAction(roundId),
    [scores, setScores] = useState<Record<string, { score: string; comment: string }>>({}),
    [recommendation, setRecommendation] = useState(''),
    [strengths, setStrengths] = useState(''),
    [concerns, setConcerns] = useState(''),
    [privateNotes, setPrivateNotes] = useState(''),
    [visibleFeedback, setVisibleFeedback] = useState(''),
    [attachments, setAttachments] = useState<string[]>([]),
    [newAttachmentId, setNewAttachmentId] = useState('');
  useEffect(() => {
    const feedback = q.data?.feedback;
    if (!q.data || !feedback) return;
    // Server state intentionally hydrates this persistent editing buffer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScores(Object.fromEntries(feedback.scores.map((x) => [x.criterionId, { score: String(x.score), comment: x.comment ?? '' }])));
    setRecommendation(feedback.recommendation);
    setStrengths(feedback.strengths.join('\n'));
    setConcerns(feedback.concerns.join('\n'));
    setPrivateNotes(feedback.privateNotes);
    setVisibleFeedback(feedback.candidateVisibleFeedback);
    setAttachments(feedback.attachments ?? []);
  }, [q.data]);
  if (!can)
    return (
      <PermissionState description="The interviews.evaluate permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading scorecard" />;
  if (q.isError)
    return <ErrorState detail={msg(q.error)} retry={() => void q.refetch()} />;
  const scorecard = q.data;
  if (!scorecard) return <ErrorState detail="The scorecard was not returned." retry={() => void q.refetch()} />;
  const immutable = scorecard.feedback?.submitted === true;
  const payload = {
    scores: scorecard.criteria.flatMap((criterion) => {
      const value = scores[criterion.id];
      return value?.score !== undefined && value.score !== '' ? [{
        criterionId: criterion.id,
        score: Number(value.score),
        ...(value.comment.trim() ? { comment: value.comment.trim() } : {}),
      }] : [];
    }),
    ...(recommendation ? { recommendation } : {}),
    strengths: strengths.split('\n').map((x) => x.trim()).filter(Boolean),
    concerns: concerns.split('\n').map((x) => x.trim()).filter(Boolean),
    ...(privateNotes.trim() ? { privateNotes: privateNotes.trim() } : {}),
    ...(visibleFeedback.trim() ? { candidateVisibleFeedback: visibleFeedback.trim() } : {}),
    attachments,
  };
  const missing = scorecard.criteria.filter((x) => x.required && !scores[x.id]?.score).map((x) => x.name);
  const save = () => action.mutateAsync({ body: payload });
  const submit = async () => { await save(); await action.mutateAsync({ submit: true }); };
  const addAttachment = () => {
    if (newAttachmentId.trim() && !attachments.includes(newAttachmentId.trim())) {
      setAttachments([...attachments, newAttachmentId.trim()]);
      setNewAttachmentId('');
    }
  };
  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter((x) => x !== id));
  };
  return (
    <div className="iv-page">
      <PageHeader title={scorecard.name} description={`${label(scorecard.type)} scorecard · ${label(scorecard.status)}`} secondaryActions={<StatusTag tone={immutable ? 'success' : scorecard.overdue ? 'danger' : 'warning'}>{immutable ? 'Submitted' : scorecard.overdue ? 'Overdue' : 'Draft'}</StatusTag>} />
      {immutable && <Alert tone="success" title="Feedback submitted">This scorecard is immutable. Submitted feedback cannot be edited.</Alert>}
      {action.isError && <Alert tone="danger" title="Draft not saved">{msg(action.error)} Your edits remain in this form. {msg(action.error).includes('409') && <Button variant="secondary" onClick={() => void q.refetch()}>Reconcile with server</Button>}</Alert>}
      {!immutable && missing.length > 0 && <Alert tone="warning" title={`${missing.length} required ${missing.length === 1 ? 'criterion' : 'criteria'} incomplete`}>{missing.join(', ')}</Alert>}
      <section className="iv-scorecard" aria-label="Scoring criteria">
        {scorecard.criteria.map((criterion, index) => (
          <Card key={criterion.id} heading={`${index + 1}. ${criterion.name}`} headingLevel={2}>
            <p>{criterion.description || label(criterion.category)}</p>
            <div className="iv-score-row">
              <TextField type="number" min={0} max={criterion.maximumScore} step={1} required={criterion.required} disabled={immutable} label={`Score out of ${criterion.maximumScore}${criterion.required ? ' (required)' : ''}`} value={scores[criterion.id]?.score ?? ''} onChange={(e) => setScores((old) => ({ ...old, [criterion.id]: { score: e.target.value, comment: old[criterion.id]?.comment ?? '' } }))} />
              <TextArea disabled={immutable} label="Criterion comment" value={scores[criterion.id]?.comment ?? ''} onChange={(e) => setScores((old) => ({ ...old, [criterion.id]: { score: old[criterion.id]?.score ?? '', comment: e.target.value } }))} />
            </div>
          </Card>
        ))}
      </section>
      <Card heading="Overall recommendation" headingLevel={2}>
        <Select required disabled={immutable} label="Recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} options={['strong-hire', 'hire', 'neutral', 'hold', 'no-hire', 'strong-no-hire'].map((value) => ({ value, label: label(value) }))} />
        <TextArea disabled={immutable} label="Strengths (one per line)" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        <TextArea disabled={immutable} label="Concerns (one per line)" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
        <TextArea disabled={immutable} label="Private notes" hint="Visible only to you and authorized internal users." value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} />
        <TextArea disabled={immutable} label="Candidate-visible feedback" value={visibleFeedback} onChange={(e) => setVisibleFeedback(e.target.value)} />
        <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: 'var(--space-4)' }}>
          <h3 style={{ marginBlock: 'var(--space-2)' }}>Attachments</h3>
          {attachments.length > 0 && (
            <ul style={{ marginBlock: 'var(--space-2)', paddingLeft: 'var(--space-4)' }}>
              {attachments.map((id) => (
                <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBlock: 'var(--space-1)' }}>
                  <code>{id}</code>
                  {!immutable && (
                    <Button type="button" variant="danger" size="compact" onClick={() => removeAttachment(id)}>Remove</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!immutable && (
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end', marginTop: 'var(--space-2)' }}>
              <TextField label="Document ID to attach" value={newAttachmentId} onChange={(e) => setNewAttachmentId(e.target.value)} />
              <Button type="button" onClick={addAttachment}>Attach Document</Button>
            </div>
          )}
        </div>
        {!immutable && <div className="iv-actions" style={{ marginTop: 'var(--space-4)' }}><Button variant="secondary" loading={action.isPending} disabled={!recommendation} onClick={() => void save()}>Save draft</Button><ConfirmDialog title="Submit this scorecard?" description="Submission makes your feedback immutable." confirmLabel="Submit feedback" onConfirm={submit} trigger={<Button disabled={!recommendation || missing.length > 0}>Submit scorecard</Button>} /></div>}
      </Card>
    </div>
  );
}
