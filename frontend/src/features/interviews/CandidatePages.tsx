import { CalendarDays, ArrowLeft, CheckCircle2, Award, MessageSquare } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system';
import {
  useAvailability,
  useAvailabilityDelete,
  useAvailabilitySave,
  useCandidateProcess,
  useCandidateProcesses,
  useCandidateSchedule,
  useScheduleResponse,
} from './api';
import {
  formatZoned,
  label,
  validateSlots,
  zonedLocalToIso,
  type CandidateProcess,
  type SafeSchedule,
} from './model';
const oid = /^[a-f\d]{24}$/i,
  message = (e: unknown) =>
    e instanceof Error ? e.message : 'The request could not be completed.';
const tone = (s: string) =>
  ['completed', 'confirmed', 'accepted', 'active'].includes(s)
    ? 'success'
    : ['cancelled', 'no-show', 'declined'].includes(s)
      ? 'danger'
      : ['reschedule-requested', 'proposed'].includes(s)
        ? 'warning'
        : 'neutral';
function isInterviewJoinable(schedule?: any) {
  if (!schedule) return false;
  if (['completed', 'cancelled', 'expired', 'no-show'].includes(schedule.status)) return false;
  const schedTime = schedule.scheduledAt || schedule.startTime;
  if (!schedTime) return true;
  const joinAvailableAt = schedule.joinAvailableAt
    ? new Date(schedule.joinAvailableAt).getTime()
    : new Date(schedTime).getTime() - 5 * 60 * 1000;
  return new Date().getTime() >= joinAvailableAt;
}

function Timeline({ p }: { p: CandidateProcess }) {
  return (
    <section className="iv-rail">
      <div className="iv-rail__head">
        <h2>Interview timeline</h2>
        <span>{p.rounds.length} rounds</span>
      </div>
      <ol>
        {p.rounds.map((r, i) => {
          const canJoin = isInterviewJoinable(r.schedule);
          const isFinished = ['completed', 'cancelled', 'expired', 'no-show'].includes(r.status ?? '');
          return (
            <li key={r.id}>
              <span className="iv-rail__number">{i + 1}</span>
              <div>
                <strong>{r.name}</strong>
                <p>{label(r.type)}</p>
                <StatusTag tone={tone(r.status)}>{label(r.status)}</StatusTag>
                {r.schedule && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
                      📅 {formatZoned(r.schedule.startTime, r.schedule.timezone)}
                    </p>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {!isFinished && (
                        canJoin ? (
                          <Link
                            to={`/candidate/interviews/schedules/${r.schedule.id}/room`}
                            className="tvx-button tvx-button--primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '6px', textDecoration: 'none' }}
                          >
                            🎥 Enter Native Video Interview ↗
                          </Link>
                        ) : (
                          <span
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#94a3b8', color: '#ffffff', borderRadius: '6px', cursor: 'not-allowed' }}
                            title="Interview room opens 5 minutes before scheduled start time"
                          >
                            🎥 Room Opens 5m Before Start
                          </span>
                        )
                      )}
                      <Link to={`/candidate/interviews/schedules/${r.schedule.id}`} style={{ fontSize: '0.85rem', textDecoration: 'underline' }}>
                        Schedule details
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export function CandidateInterviewsPage() {
  const q = useCandidateProcesses();
  return (
    <div className="candidate-page candidate-domain-container">
      <div className="candidate-hero-banner-mindease">
        <div className="banner-left-content">
          <div className="banner-icon-badge theme-indigo">
            <CalendarDays size={22} />
          </div>
          <div className="banner-text-details">
            <h1 className="banner-title">My Interviews</h1>
            <p className="banner-subtext">Review schedules, respond to invitations and prepare for each round.</p>
          </div>
        </div>
        <div className="banner-right-actions">
          <Link
            className="banner-action-pill secondary"
            to="/candidate/interviews/availability"
          >
            Edit availability
          </Link>
        </div>
      </div>
      {q.isLoading ? (
        <LoadingState label="Loading interviews" />
      ) : q.isError ? (
        <ErrorState detail={message(q.error)} retry={() => void q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState
          title="No interviews scheduled"
          description="Interview processes will appear here when a recruiting team creates one."
        />
      ) : (
        <div className="iv-process-grid">
          {q.data.map((p) => (
            <Card
              key={p.id}
              heading={`Interview process ${p.id.slice(-6)}`}
              headingLevel={2}
            >
              <StatusTag tone={tone(p.status)}>{label(p.status)}</StatusTag>
              <p>
                {p.rounds.length} rounds · Job {p.jobId}
              </p>
              <Link
                className="tvx-button tvx-button--secondary"
                to={`/candidate/interviews/${p.id}`}
              >
                View process
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
export function CandidateInterviewDetailPage() {
  const { processId = '' } = useParams(),
    q = useCandidateProcess(processId, oid.test(processId));
  if (q.isLoading) return <LoadingState label="Loading interview details" />;
  if (q.isError || !q.data)
    return (
      <ErrorState detail={message(q.error)} retry={() => void q.refetch()} />
    );
  const p = q.data;
  const jobDisplay = (p as any).jobTitle
    ? `Job: ${(p as any).jobTitle}`
    : p.jobId?.length === 24
      ? `Job Application #${p.jobId.slice(-6)}`
      : `Job ${p.jobId}`;

  return (
    <div className="iv-page">
      <PageHeader
        eyebrow={
          <Link
            to="/candidate/interviews"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
              marginBottom: '4px',
            }}
          >
            <ArrowLeft size={14} /> Back to My Interviews
          </Link>
        }
        title="Interview Process Details"
        description={jobDisplay}
        secondaryActions={
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Link
              to="/candidate/interviews"
              className="tvx-button tvx-button--secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: '#334155',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
              }}
            >
              <ArrowLeft size={14} /> Back to List
            </Link>
            <StatusTag tone={tone(p.status)}>{label(p.status)}</StatusTag>
          </div>
        }
      />
      {p.status === 'cancelled' && (
        <Alert tone="danger" title="Interview process cancelled">
          No further action is required.
        </Alert>
      )}
      <Timeline p={p} />
      <Card heading="Result and feedback" headingLevel={2}>
        {!p.feedbackReleased ? (
          <Alert tone="info" title="Feedback has not been released">
            Private interviewer feedback and internal recommendations are never
            shown. Candidate-visible feedback will appear only if the recruiting
            team releases it.
          </Alert>
        ) : p.rounds.some((r) => r.feedback.length) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            {p.rounds.flatMap((r) =>
              r.feedback.map((f, i) => (
                <div
                  key={`${r.id}-${i}`}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{r.name}</strong>
                    </div>
                    {f.weightedScore !== undefined && (
                      <span
                        style={{
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          padding: '4px 10px',
                          borderRadius: '9999px',
                        }}
                      >
                        {f.weightedScore}% Score
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontStyle: (f as any).candidateVisibleFeedback || f.text ? 'normal' : 'italic' }}>
                    {(f as any).candidateVisibleFeedback || f.text || 'No written candidate feedback.'}
                  </p>
                </div>
              )),
            )}
          </div>
        ) : (
          <EmptyState
            title="No candidate feedback"
            description="Feedback was released without candidate-visible comments."
          />
        )}
      </Card>
    </div>
  );
}
function ScheduleSummary({ s }: { s: SafeSchedule }) {
  return (
    <DescriptionList
      items={[
        { term: 'Starts', description: formatZoned(s.startTime, s.timezone) },
        { term: 'Ends', description: formatZoned(s.endTime, s.timezone) },
        { term: 'Timezone', description: s.timezone },
        { term: 'Mode', description: label(s.mode) },
        { term: 'Status', description: label(s.status) },
        { term: 'Your response', description: label(s.candidateResponse) },
      ]}
    />
  );
}
export function CandidateSchedulePage() {
  const { scheduleId = '' } = useParams(),
    q = useCandidateSchedule(scheduleId, oid.test(scheduleId)),
    respond = useScheduleResponse(scheduleId),
    [response, setResponse] = useState('accepted'),
    [reason, setReason] = useState(''),
    [slots, setSlots] = useState([{ startTime: '', endTime: '' }]),
    [locked, setLocked] = useState(false);
  if (q.isLoading) return <LoadingState label="Loading interview schedule" />;
  if (q.isError || !q.data)
    return (
      <ErrorState detail={message(q.error)} retry={() => void q.refetch()} />
    );
  const s = q.data,
    cancelled = ['cancelled', 'no-show'].includes(s.status),
    slotError = response === 'reschedule-requested' ? validateSlots(slots) : '';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked || slotError) return;
    setLocked(true);
    try {
      await respond.mutateAsync({
        response,
        ...(reason && { reason }),
        ...(response === 'reschedule-requested' && {
          preferredSlots: slots.map((x) => ({
            startTime: zonedLocalToIso(x.startTime, s.timezone),
            endTime: zonedLocalToIso(x.endTime, s.timezone),
          })),
        }),
      });
    } finally {
      setLocked(false);
    }
  };
  return (
    <form className="iv-page" onSubmit={(e) => void submit(e)}>
      <PageHeader
        title="Interview schedule"
        description="All consequential times include the stored IANA timezone."
      />
      <Card heading="Schedule" headingLevel={2}>
        <ScheduleSummary s={s} />
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#1e3a8a', fontSize: '1rem', fontWeight: 600 }}>🎥 Native Video Interview Room</h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: '#1e40af' }}>
            {isInterviewJoinable(s)
              ? 'Click the button below to enter the waiting room or video interview call inside Talvix.'
              : 'The interview room unlocks 5 minutes prior to the scheduled start time.'}
          </p>
          {isInterviewJoinable(s) ? (
            <Link
              to={`/candidate/interviews/schedules/${s.id}/room`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              }}
            >
              🎥 Enter Native Interview Room ↗
            </Link>
          ) : (
            <button
              type="button"
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#94a3b8',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.95rem',
                border: 'none',
                cursor: 'not-allowed',
              }}
            >
              🎥 Room Opens 5m Before Start
            </button>
          )}
        </div>

        {s.mode === 'phone' && s.phoneNumber && <p>Phone: {s.phoneNumber}</p>}
        {s.mode === 'onsite' && (
          <p>
            {s.locationName}: {s.locationAddress}
          </p>
        )}
        {s.candidateInstructions && (
          <Alert tone="info" title="Instructions">
            {s.candidateInstructions}
          </Alert>
        )}
        {cancelled && (
          <Alert
            tone="danger"
            title={
              s.status === 'no-show'
                ? 'Marked as no-show'
                : 'Interview cancelled'
            }
          >
            This schedule can no longer be changed.
          </Alert>
        )}
      </Card>
      {!cancelled && (
        <Card heading="Respond to schedule" headingLevel={2}>
          <Select
            label="Response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            options={['accepted', 'declined', 'reschedule-requested'].map(
              (x) => ({ value: x, label: label(x) }),
            )}
          />
          {response !== 'accepted' && (
            <TextArea
              required={response === 'reschedule-requested'}
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}{' '}
          {response === 'reschedule-requested' && (
            <div>
              <Alert tone="info" title="Preferred times">
                Times are submitted as instants. Confirm the displayed
                browser-local values against schedule timezone {s.timezone}.
              </Alert>
              {slots.map((x, i) => (
                <div className="iv-slot" key={i}>
                  <TextField
                    required
                    type="datetime-local"
                    label={`Preferred slot ${i + 1} start`}
                    value={x.startTime}
                    onChange={(e) =>
                      setSlots(
                        slots.map((v, j) =>
                          j === i ? { ...v, startTime: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <TextField
                    required
                    type="datetime-local"
                    label={`Preferred slot ${i + 1} end`}
                    value={x.endTime}
                    onChange={(e) =>
                      setSlots(
                        slots.map((v, j) =>
                          j === i ? { ...v, endTime: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </div>
              ))}
              {slots.length < 5 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSlots([...slots, { startTime: '', endTime: '' }])
                  }
                >
                  Add preferred slot
                </Button>
              )}
              {slotError && (
                <Alert tone="danger" title="Check preferred times">
                  {slotError}
                </Alert>
              )}
            </div>
          )}
          {respond.isError && (
            <Alert tone="danger" title="Could not respond">
              {message(respond.error)} Your response has been preserved.
            </Alert>
          )}
          <Button type="submit" loading={locked} disabled={Boolean(slotError)}>
            Submit response
          </Button>
        </Card>
      )}
    </form>
  );
}
export function AvailabilityPage() {
  const q = useAvailability(),
    save = useAvailabilitySave(),
    remove = useAvailabilityDelete(),
    [timezone, setTimezone] = useState(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    [date, setDate] = useState(''),
    [slots, setSlots] = useState([{ startTime: '', endTime: '' }]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (date || slots.some((x) => x.startTime || x.endTime))
        e.preventDefault();
    };
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [date, slots]);
  const invalid = validateSlots(slots);
  return (
    <div className="iv-page">
      <PageHeader
        title="Interview availability"
        description="Publish non-overlapping availability with an explicit IANA timezone."
      />
      <div className="iv-split">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            void save.mutateAsync({
              timezone,
              date: zonedLocalToIso(`${date}T00:00`, timezone),
              slots: slots.map((x) => ({
                startTime: zonedLocalToIso(x.startTime, timezone),
                endTime: zonedLocalToIso(x.endTime, timezone),
              })),
            });
          }}
        >
          <Card heading="Add availability" headingLevel={2}>
            <TextField
              required
              label="IANA timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
            <TextField
              required
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {slots.map((x, i) => (
              <div className="iv-slot" key={i}>
                <TextField
                  required
                  type="datetime-local"
                  label={`Slot ${i + 1} start (${timezone})`}
                  value={x.startTime}
                  onChange={(e) =>
                    setSlots(
                      slots.map((v, j) =>
                        j === i ? { ...v, startTime: e.target.value } : v,
                      ),
                    )
                  }
                />
                <TextField
                  required
                  type="datetime-local"
                  label={`Slot ${i + 1} end (${timezone})`}
                  value={x.endTime}
                  onChange={(e) =>
                    setSlots(
                      slots.map((v, j) =>
                        j === i ? { ...v, endTime: e.target.value } : v,
                      ),
                    )
                  }
                />
              </div>
            ))}
            {invalid && (
              <Alert tone="danger" title="Check availability">
                {invalid}
              </Alert>
            )}
            {save.isError && (
              <Alert tone="danger" title="Availability was not saved">
                {message(save.error)} Your entered times remain in this form.
              </Alert>
            )}
            <Button
              type="submit"
              loading={save.isPending}
              disabled={Boolean(invalid)}
            >
              Save availability
            </Button>
          </Card>
        </form>
        <Card heading="Published availability" headingLevel={2}>
          {q.isLoading ? (
            <LoadingState label="Loading availability" />
          ) : q.isError ? (
            <ErrorState detail={message(q.error)} />
          ) : !q.data?.length ? (
            <EmptyState
              title="No availability published"
              description="Add times when you can interview."
            />
          ) : (
            <ul className="iv-availability">
              {q.data.map((v, i) => {
                const x = v as Record<string, unknown>,
                  id = String(x.id ?? x._id ?? i);
                return (
                  <li key={id}>
                    <strong>{String(x.date ?? 'Availability')}</strong>
                    <span>{String(x.timezone ?? '')}</span>
                    <Button
                      variant="quiet"
                      onClick={() => void remove.mutateAsync(id)}
                    >
                      Delete
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
