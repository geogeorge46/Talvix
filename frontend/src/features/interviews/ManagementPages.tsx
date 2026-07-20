import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  Select,
  StatusTag,
  TextField,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import {
  useFeedback,
  useProcessCreate,
  useRoundFeedback,
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
  submitted?: boolean;
  submittedAt?: string;
  lastEditedAt?: string;
  recommendation?: string;
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
        description="Only feedback records returned for your interviewer identity are shown."
      />
      {q.isError ? (
        <ErrorState detail={msg(q.error)} retry={() => void q.refetch()} />
      ) : (
        <>
          <Alert tone="info" title="Completion and overdue boundary">
            The API returns existing scorecards only. Missing pending
            scorecards, due dates and authoritative overdue flags are
            unavailable, so Talvix does not invent overdue work.
          </Alert>
          <DataTable
            caption="My scorecards"
            rows={(q.data ?? []) as FeedbackRow[]}
            rowKey={(x) => String(x.id ?? x._id)}
            isLoading={q.isLoading}
            empty={
              <EmptyState
                title="No scorecards returned"
                description="This does not prove there is no pending work; the backend does not return missing assignments."
              />
            }
            columns={[
              {
                id: 'round',
                header: 'Round ID',
                render: (x) => <code>{String(x.round ?? 'Unavailable')}</code>,
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
                render: () => <span>Unavailable</span>,
              },
            ]}
            renderNarrow={(x) => (
              <article className="iv-record">
                <strong>Round {String(x.round)}</strong>
                <StatusTag tone={x.submitted ? 'success' : 'warning'}>
                  {x.submitted ? 'Submitted' : 'Draft'}
                </StatusTag>
                <Link to={`/org/interviews/feedback/${String(x.round)}`}>
                  Review
                </Link>
              </article>
            )}
            rowActions={(x) => (
              <Link
                className="tvx-button tvx-button--secondary tvx-button--compact"
                to={`/org/interviews/feedback/${String(x.round)}`}
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
    q = useRoundFeedback(roundId, can);
  if (!can)
    return (
      <PermissionState description="The interviews.evaluate permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading scorecard" />;
  if (q.isError)
    return <ErrorState detail={msg(q.error)} retry={() => void q.refetch()} />;
  const rows = (q.data ?? []) as FeedbackRow[];
  return (
    <div className="iv-page">
      <PageHeader title="Round scorecard" description={`Round ${roundId}`} />
      <Alert tone="warning" title="Scorecard criteria unavailable">
        This endpoint returns feedback documents, not the live round scorecard
        definition. Talvix will not manufacture criterion IDs or scoring maxima,
        so scoring and submission are unavailable until the API provides
        authoritative criteria.
      </Alert>
      {rows.length ? (
        rows.map((x, i) => (
          <Card
            key={String(x.id ?? x._id ?? i)}
            heading={x.submitted ? 'Submitted feedback' : 'Draft feedback'}
            headingLevel={2}
          >
            <p>
              Recommendation: {label(String(x.recommendation ?? 'pending'))}
            </p>
            <p>
              {x.submitted
                ? 'This feedback is immutable.'
                : 'A feedback record exists, but criteria are unavailable for safe editing.'}
            </p>
          </Card>
        ))
      ) : (
        <EmptyState
          title="No feedback documents"
          description="No scorecard can be rendered from this response."
        />
      )}
    </div>
  );
}
