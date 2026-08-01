import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
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
  useFeedback,
  useProcessCreate,
  useScorecard,
  useFeedbackAction,
  useTemplates,
} from './api';
import { label, type Template } from './model';
const has = (p: string[], v: string) => p.includes(v),
  msg = (e: unknown) =>
    e instanceof Error ? e.message : 'The request could not be completed.';
export function ProcessCreatePage() {
  const { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.manage'),
    templates = useTemplates('page=1&limit=50&sort=name&active=true', can),
    create = useProcessCreate(),
    nav = useNavigate(),
    [applicationId, setApplicationId] = useState(''),
    [templateId, setTemplateId] = useState('');
  if (!can)
    return (
      <PermissionState description="The interviews.manage permission is required." />
    );
  return (
    <form
      className="iv-page"
      onSubmit={(e) => {
        e.preventDefault();
        void create.mutateAsync({ applicationId, templateId }).then((r) => {
          const x = r as { process?: { _id?: string; id?: string } };
          nav(`/org/interviews/${x.process?.id ?? x.process?._id ?? ''}`);
        });
      }}
    >
      <PageHeader
        title="Create interview process"
        description="Start from an eligible application and an active interview template."
      />
      <Card heading="Process source" headingLevel={2}>
        <TextField
          required
          label="Application ID"
          value={applicationId}
          onChange={(e) => setApplicationId(e.target.value)}
          hint="Use the application identifier from the ATS workspace."
        />
        <Select
          required
          label="Interview template"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          options={((templates.data?.items ?? []) as Template[]).map((t) => ({
            value: t.id,
            label: t.name,
          }))}
        />
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
  const { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.evaluate'),
    q = useFeedback(can);
  if (!can)
    return (
      <PermissionState description="The interviews.evaluate permission is required." />
    );
  return (
    <div className="iv-page">
      <PageHeader
        title="My interview scorecards"
        description="Assigned scorecards are ordered with overdue work first."
      />
      {q.isError ? (
        <ErrorState detail={msg(q.error)} retry={() => void q.refetch()} />
      ) : (
        <>
          <DataTable
            caption="My scorecards"
            rows={(q.data ?? []) as FeedbackRow[]}
            rowKey={(x) => String(x.id ?? x._id)}
            isLoading={q.isLoading}
            empty={
              <EmptyState
                title="No scorecards returned"
                description="You have no pending or overdue assigned scorecards."
              />
            }
            columns={[
              {
                id: 'round',
                header: 'Round ID',
                render: (x) => (
                  <span>{x.name || String(x.roundId ?? x.round ?? 'Unavailable')}</span>
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
                header: 'Due status',
                render: (x) => (
                  <StatusTag tone={x.overdue ? 'danger' : 'neutral'}>
                    {x.overdue
                      ? 'Overdue'
                      : x.dueAt
                        ? new Date(x.dueAt).toLocaleString()
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
        </>
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
    [visibleFeedback, setVisibleFeedback] = useState('');
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
    recommendation,
    strengths: strengths.split('\n').map((x) => x.trim()).filter(Boolean),
    concerns: concerns.split('\n').map((x) => x.trim()).filter(Boolean),
    ...(privateNotes.trim() ? { privateNotes: privateNotes.trim() } : {}),
    ...(visibleFeedback.trim() ? { candidateVisibleFeedback: visibleFeedback.trim() } : {}),
  };
  const missing = scorecard.criteria.filter((x) => x.required && !scores[x.id]?.score).map((x) => x.name);
  const save = () => action.mutateAsync({ body: payload });
  const submit = async () => { await save(); await action.mutateAsync({ submit: true }); };
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
        <Select required disabled={immutable} label="Recommendation" value={recommendation} onChange={(e) => setRecommendation(e.target.value)} options={['strong-hire', 'hire', 'neutral', 'no-hire', 'strong-no-hire'].map((value) => ({ value, label: label(value) }))} />
        <TextArea disabled={immutable} label="Strengths (one per line)" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
        <TextArea disabled={immutable} label="Concerns (one per line)" value={concerns} onChange={(e) => setConcerns(e.target.value)} />
        <TextArea disabled={immutable} label="Private notes" hint="Visible only to you and authorized internal users." value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} />
        <TextArea disabled={immutable} label="Candidate-visible feedback" value={visibleFeedback} onChange={(e) => setVisibleFeedback(e.target.value)} />
        {!immutable && <div className="iv-actions"><Button variant="secondary" loading={action.isPending} disabled={!recommendation} onClick={() => void save()}>Save draft</Button><ConfirmDialog title="Submit this scorecard?" description="Submission makes your feedback immutable." confirmLabel="Submit feedback" onConfirm={submit} trigger={<Button disabled={!recommendation || missing.length > 0}>Submit scorecard</Button>} /></div>}
      </Card>
    </div>
  );
}
