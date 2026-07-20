import { useEffect, useState } from 'react';
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
function Timeline({ p }: { p: CandidateProcess }) {
  return (
    <section className="iv-rail">
      <div className="iv-rail__head">
        <h2>Interview timeline</h2>
        <span>{p.rounds.length} rounds</span>
      </div>
      <ol>
        {p.rounds.map((r, i) => (
          <li key={r.id}>
            <span className="iv-rail__number">{i + 1}</span>
            <div>
              <strong>{r.name}</strong>
              <p>{label(r.type)}</p>
              <StatusTag tone={tone(r.status)}>{label(r.status)}</StatusTag>
              {r.schedule && (
                <>
                  <p>
                    {formatZoned(r.schedule.startTime, r.schedule.timezone)}
                  </p>
                  <Link to={`/candidate/interviews/schedules/${r.schedule.id}`}>
                    View schedule
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function CandidateInterviewsPage() {
  const q = useCandidateProcesses();
  return (
    <div className="iv-page">
      <PageHeader
        title="My interviews"
        description="Review schedules, respond to invitations and prepare for each round."
        primaryAction={
          <Link
            className="tvx-button tvx-button--secondary"
            to="/candidate/interviews/availability"
          >
            Edit availability
          </Link>
        }
      />
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
  return (
    <div className="iv-page">
      <PageHeader
        title="Interview process"
        description={`Job ${p.jobId}`}
        secondaryActions={
          <StatusTag tone={tone(p.status)}>{label(p.status)}</StatusTag>
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
          p.rounds.flatMap((r) =>
            r.feedback.map((f, i) => (
              <div key={`${r.id}-${i}`} className="iv-feedback">
                <strong>{r.name}</strong>
                {f.weightedScore !== undefined && (
                  <span>{f.weightedScore}%</span>
                )}
                <p>{f.text || 'No written candidate feedback.'}</p>
              </div>
            )),
          )
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
        {s.mode === 'video' && s.meetingUrl && (
          <a href={s.meetingUrl} rel="noreferrer" target="_blank">
            Open meeting link
          </a>
        )}
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
