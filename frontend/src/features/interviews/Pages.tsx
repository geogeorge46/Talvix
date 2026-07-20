import { useState } from 'react';
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
import { useAuth } from '../../auth/AuthProvider';
import {
  useProcess,
  useProcessAction,
  useProcesses,
  useTemplate,
  useTemplateAction,
  useTemplates,
  useTemplateSave,
} from './api';
import {
  label,
  type CandidateProcess,
  type Process,
  type RoundPlan,
  type Template,
} from './model';
import './interviews.css';
const has = (p: string[], v: string) => p.includes(v),
  oid = /^[a-f\d]{24}$/i;
const err = (e: unknown) =>
  e instanceof Error ? e.message : 'The request could not be completed.';
const tone = (s: string) =>
  ['completed', 'confirmed', 'accepted', 'active'].includes(s)
    ? 'success'
    : ['cancelled', 'no-show', 'declined'].includes(s)
      ? 'danger'
      : ['reschedule-requested', 'awaiting-feedback', 'proposed'].includes(s)
        ? 'warning'
        : 'neutral';
function InterviewTabs() {
  return (
    <nav className="iv-tabs" aria-label="Interview sections">
      <Link to="/org/interviews">Processes</Link>
      <Link to="/org/interviews/templates">Templates</Link>
      <Link to="/org/interviews/feedback">Scorecards</Link>
    </nav>
  );
}
function Rail({
  rounds,
  definition = false,
}: {
  rounds: (RoundPlan | CandidateProcess['rounds'][number])[];
  definition?: boolean;
}) {
  return (
    <section className="iv-rail" aria-labelledby="round-timeline">
      <div className="iv-rail__head">
        <h2 id="round-timeline">
          {definition ? 'Interview definition' : 'Process timeline'}
        </h2>
        <span>{rounds.length} rounds</span>
      </div>
      {definition && (
        <Alert tone="info" title="Definition snapshot">
          This ordered plan is immutable. Live round status, interviewer
          assignment and scheduling are unavailable from this recruiter
          endpoint.
        </Alert>
      )}
      <ol>
        {[...rounds]
          .sort((a, b) => a.order - b.order)
          .map((r, i) => (
            <li key={r.id || `${r.name}-${i}`}>
              <span className="iv-rail__number">{i + 1}</span>
              <div>
                <strong>{r.name}</strong>
                <p>
                  {label(r.type)}
                  {'durationMinutes' in r
                    ? ` · ${r.durationMinutes} minutes`
                    : ''}
                </p>
                {'status' in r && (
                  <StatusTag tone={tone(r.status)}>{label(r.status)}</StatusTag>
                )}
              </div>
            </li>
          ))}
      </ol>
    </section>
  );
}
function TemplateCard({ t }: { t: Template }) {
  return (
    <article className="iv-record">
      <div>
        <strong>{t.name}</strong>
        <small>
          {t.rounds.length} rounds · used {t.usageCount} times
        </small>
      </div>
      <StatusTag tone={t.isActive ? 'success' : 'neutral'}>
        {t.isActive ? 'Active' : 'Inactive'}
      </StatusTag>
      <Link
        className="tvx-button tvx-button--secondary"
        to={`/org/interviews/templates/${t.id}`}
      >
        Open
      </Link>
    </article>
  );
}
export function TemplatesPage() {
  const { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    [p, setP] = useSearchParams();
  const q = useTemplates(
    `page=${p.get('page') || 1}&limit=10&sort=${p.get('sort') || 'newest'}${p.get('search') ? `&search=${encodeURIComponent(p.get('search') ?? '')}` : ''}`,
    view,
  );
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  return (
    <div className="iv-page">
      <PageHeader
        title="Interview templates"
        description="Reusable, ordered interview plans and scorecard definitions."
        secondaryActions={<InterviewTabs />}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to="/org/interviews/templates/new"
            >
              Create template
            </Link>
          ) : undefined
        }
      />
      <Toolbar
        label="Template filters"
        start={
          <TextField
            label="Search templates"
            value={p.get('search') || ''}
            onChange={(e) => {
              const n = new URLSearchParams(p);
              if (e.target.value) n.set('search', e.target.value);
              else n.delete('search');
              setP(n);
            }}
          />
        }
      />
      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="Interview templates"
          rows={(q.data?.items ?? []) as Template[]}
          rowKey={(x) => x.id}
          isLoading={q.isLoading}
          empty={
            p.has('search') ? (
              <FilteredEmptyState
                title="No matching templates"
                description="Adjust the search."
                onClear={() => setP({})}
              />
            ) : (
              <EmptyState
                title="No templates"
                description="Create a structured interview plan."
              />
            )
          }
          columns={[
            {
              id: 'name',
              header: 'Template',
              render: (x) => (
                <>
                  <strong>{x.name}</strong>
                  <small>{x.rounds.length} rounds</small>
                </>
              ),
            },
            {
              id: 'usage',
              header: 'Usage',
              render: (x) => <>{x.usageCount}</>,
            },
            {
              id: 'status',
              header: 'Status',
              render: (x) => (
                <StatusTag tone={x.isActive ? 'success' : 'neutral'}>
                  {x.isActive ? 'Active' : 'Inactive'}
                </StatusTag>
              ),
            },
          ]}
          renderNarrow={(x) => <TemplateCard t={x} />}
          rowActions={(x) => (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`/org/interviews/templates/${x.id}`}
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
export function TemplateDetailPage() {
  const { templateId = '' } = useParams(),
    { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    q = useTemplate(templateId, view && oid.test(templateId)),
    action = useTemplateAction(templateId),
    nav = useNavigate();
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading interview template" />;
  if (q.isError || !q.data) return <ErrorState detail={err(q.error)} />;
  const t = q.data;
  return (
    <div className="iv-page">
      <PageHeader
        title={t.name}
        description={t.description || 'Reusable interview definition.'}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to={`/org/interviews/templates/${t.id}/edit`}
            >
              Edit template
            </Link>
          ) : undefined
        }
      />
      <Card heading="Template details" headingLevel={2}>
        <DescriptionList
          items={[
            { term: 'Status', description: t.isActive ? 'Active' : 'Inactive' },
            { term: 'Usage', description: `${t.usageCount} processes` },
            { term: 'Reusable', description: t.isReusable ? 'Yes' : 'No' },
          ]}
        />
        {manage && (
          <div className="iv-actions">
            <Button
              variant="secondary"
              loading={action.isPending}
              onClick={() =>
                void action
                  .mutateAsync('clone')
                  .then(() => nav('/org/interviews/templates'))
              }
            >
              Clone
            </Button>
            <Button
              variant="danger"
              disabled={!t.isActive}
              onClick={() => void action.mutateAsync('delete')}
            >
              Deactivate
            </Button>
          </div>
        )}
      </Card>
      <Rail rounds={t.rounds} />
      {t.rounds.map((r) => (
        <Card
          key={r.id}
          heading={`${r.order + 1}. ${r.name}`}
          headingLevel={2}
          description={`${label(r.type)} · ${r.durationMinutes} minutes`}
        >
          <ul className="iv-criteria">
            {r.criteria.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <span>
                  {label(c.category)} · {c.weight} weight · max {c.maximumScore}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
export function TemplateFormPage() {
  const { templateId } = useParams(),
    edit = Boolean(templateId),
    { recruiter } = useAuth(),
    can = has(recruiter?.permissions ?? [], 'interviews.manage'),
    q = useTemplate(templateId ?? '', edit && can);
  if (!can)
    return (
      <PermissionState description="The interviews.manage permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading template" />;
  return q.data ? <TemplateEditor existing={q.data} /> : <TemplateEditor />;
}
function TemplateEditor({ existing }: { existing?: Template }) {
  const nav = useNavigate();
  const [name, setName] = useState(existing?.name ?? ''),
    [description, setDescription] = useState(existing?.description ?? ''),
    [rounds, setRounds] = useState<RoundPlan[]>(
      existing?.rounds ?? [
        {
          id: 'new-1',
          name: 'Screening',
          description: '',
          type: 'screening',
          durationMinutes: 30,
          order: 0,
          required: true,
          criteria: [
            {
              id: 'communication',
              name: 'Communication',
              category: 'communication',
              weight: 1,
              maximumScore: 5,
              required: true,
            },
          ],
        },
      ],
    );
  const save = useTemplateSave(existing?.id);
  const move = (i: number, d: number) => {
    const n = [...rounds],
      j = i + d;
    if (j < 0 || j >= n.length) return;
    const current = n[i],
      target = n[j];
    if (!current || !target) return;
    n[i] = target;
    n[j] = current;
    setRounds(n.map((r, k) => ({ ...r, order: k })));
  };
  return (
    <form
      className="iv-page"
      onSubmit={(e) => {
        e.preventDefault();
        void save
          .mutateAsync({
            name,
            description,
            isReusable: true,
            rounds: rounds.map((r) => ({
              name: r.name,
              description: r.description,
              type: r.type,
              durationMinutes: r.durationMinutes,
              order: r.order,
              required: r.required,
              scorecardTemplate: { criteria: r.criteria },
              defaultInterviewers: [],
              minimumInterviewers: 1,
              maximumInterviewers: 1,
            })),
          })
          .then(() => nav('/org/interviews/templates'));
      }}
    >
      <PageHeader
        title={
          existing ? 'Edit interview template' : 'Create interview template'
        }
        description="Build an ordered, keyboard-operable interview plan."
      />
      <Card heading="Template details" headingLevel={2}>
        <TextField
          required
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextArea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Card>
      <Card
        heading="Rounds"
        headingLevel={2}
        description="Use Move up and Move down; dragging is never required."
      >
        <ol className="iv-editor-rounds">
          {rounds.map((r, i) => (
            <li key={r.id}>
              <TextField
                label={`Round ${i + 1} name`}
                value={r.name}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
              <Select
                label="Type"
                value={r.type}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i ? { ...x, type: e.target.value } : x,
                    ),
                  )
                }
                options={[
                  'screening',
                  'technical',
                  'coding',
                  'behavioral',
                  'managerial',
                  'hr',
                  'culture-fit',
                  'case-study',
                  'final',
                  'other',
                ].map((x) => ({ value: x, label: label(x) }))}
              />
              <TextField
                type="number"
                min="10"
                max="480"
                label="Duration (minutes)"
                value={String(r.durationMinutes)}
                onChange={(e) =>
                  setRounds(
                    rounds.map((x, j) =>
                      j === i
                        ? { ...x, durationMinutes: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <div className="iv-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!i}
                  onClick={() => move(i, -1)}
                >
                  Move up
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={i === rounds.length - 1}
                  onClick={() => move(i, 1)}
                >
                  Move down
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {save.isError && (
          <Alert tone="danger" title="Could not save">
            {err(save.error)}
          </Alert>
        )}
        <Button type="submit" loading={save.isPending} disabled={!name.trim()}>
          Save template
        </Button>
      </Card>
    </form>
  );
}

export function ProcessesPage() {
  const { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    [p, setP] = useSearchParams();
  const q = useProcesses(
    `page=${p.get('page') || 1}&limit=10&sort=${p.get('sort') || 'newest'}${p.get('status') ? `&status=${p.get('status')}` : ''}`,
    view,
  );
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  return (
    <div className="iv-page">
      <PageHeader
        title="Interview processes"
        description="Track structured interview plans without obscuring execution-data gaps."
        secondaryActions={<InterviewTabs />}
        primaryAction={
          manage ? (
            <Link
              className="tvx-button tvx-button--primary"
              to="/org/interviews/new"
            >
              Create process
            </Link>
          ) : undefined
        }
      />
      <Toolbar
        label="Process filters"
        start={
          <Select
            label="Status"
            value={p.get('status') || ''}
            onChange={(e) => {
              const n = new URLSearchParams(p);
              if (e.target.value) n.set('status', e.target.value);
              else n.delete('status');
              setP(n);
            }}
            options={[
              'draft',
              'active',
              'completed',
              'cancelled',
              'archived',
            ].map((x) => ({ value: x, label: label(x) }))}
          />
        }
      />
      {q.isError ? (
        <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
      ) : (
        <DataTable
          caption="Interview processes"
          rows={(q.data?.items ?? []) as Process[]}
          rowKey={(x) => x.id}
          isLoading={q.isLoading}
          empty={
            p.has('status') ? (
              <FilteredEmptyState
                title="No matching processes"
                description="Clear the current filter."
                onClear={() => setP({})}
              />
            ) : (
              <EmptyState
                title="No interview processes"
                description="Create one from an eligible application."
              />
            )
          }
          columns={[
            {
              id: 'application',
              header: 'Application',
              render: (x) => <code>{x.applicationId}</code>,
            },
            {
              id: 'status',
              header: 'Status',
              render: (x) => (
                <StatusTag tone={tone(x.status)}>{label(x.status)}</StatusTag>
              ),
            },
            {
              id: 'rounds',
              header: 'Plan',
              render: (x) => <>{x.rounds.length} rounds</>,
            },
          ]}
          renderNarrow={(x) => (
            <article className="iv-record">
              <strong>Application {x.applicationId}</strong>
              <StatusTag tone={tone(x.status)}>{label(x.status)}</StatusTag>
              <Link to={`/org/interviews/${x.id}`}>Open</Link>
            </article>
          )}
          rowActions={(x) => (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--compact"
              to={`/org/interviews/${x.id}`}
            >
              Open
            </Link>
          )}
        />
      )}
    </div>
  );
}
export function ProcessDetailPage() {
  const { processId = '' } = useParams(),
    { recruiter } = useAuth(),
    view = has(recruiter?.permissions ?? [], 'interviews.view'),
    manage = has(recruiter?.permissions ?? [], 'interviews.manage'),
    q = useProcess(processId, view && oid.test(processId)),
    action = useProcessAction(processId);
  if (!view)
    return (
      <PermissionState description="The interviews.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading interview process" />;
  if (q.isError || !q.data)
    return <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />;
  const p = q.data;
  return (
    <div className="iv-page">
      <PageHeader
        title="Interview process"
        description={`Application ${p.applicationId}`}
        secondaryActions={
          <StatusTag tone={tone(p.status)}>{label(p.status)}</StatusTag>
        }
      />
      {p.status === 'cancelled' && (
        <Alert tone="danger" title="Process cancelled">
          {p.cancellationReason || 'This process is cancelled.'}
        </Alert>
      )}
      <div className="iv-split">
        <Card heading="Process summary" headingLevel={2}>
          <DescriptionList
            items={[
              { term: 'Candidate ID', description: p.candidateId },
              { term: 'Job ID', description: p.jobId },
              {
                term: 'Feedback',
                description: p.feedbackReleased ? 'Released' : 'Not released',
              },
              {
                term: 'Recommendation',
                description: label(p.overallRecommendation || 'pending'),
              },
            ]}
          />
          {manage && (
            <div className="iv-actions">
              {['draft', 'active'].includes(p.status) && (
                <Button
                  variant="danger"
                  onClick={() =>
                    void action.mutateAsync({
                      action: 'cancel',
                      body: { reason: 'Cancelled by recruiter' },
                    })
                  }
                >
                  Cancel process
                </Button>
              )}
              {p.status === 'completed' && !p.feedbackReleased && (
                <Button
                  onClick={() =>
                    void action.mutateAsync({ action: 'release-feedback' })
                  }
                >
                  Release feedback
                </Button>
              )}
              {['completed', 'cancelled'].includes(p.status) && (
                <Button
                  variant="secondary"
                  onClick={() => void action.mutateAsync({ action: 'archive' })}
                >
                  Archive
                </Button>
              )}
            </div>
          )}
        </Card>
        <Card heading="Live workflow unavailable" headingLevel={2}>
          <Alert
            tone="warning"
            title="Scheduling and interviewer assignment cannot be opened here"
          >
            The API returns round identifiers but no live round records. Talvix
            will not infer statuses or pair snapshot rounds to IDs. Scheduling
            becomes available when the backend provides an authoritative
            recruiter round endpoint.
          </Alert>
        </Card>
      </div>
      <Rail rounds={p.rounds} definition />
    </div>
  );
}
